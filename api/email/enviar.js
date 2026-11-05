import { getDb } from "../_lib/firebase-admin.js";
import { requireAdmin } from "../_lib/auth-admin.js";
import { resendConfigurado } from "../_lib/resend.js";
import { enviarBienvenidaSiCorresponde } from "../_lib/welcome-email.js";
import { enviarAbandonadoSiCorresponde } from "../_lib/abandoned-email.js";

const MAX_POR_LOTE = 25;
const PAUSA_ENTRE_ENVIOS_MS = 350;

const ENVIADORES = {
  bienvenida: enviarBienvenidaSiCorresponde,
  abandonados: enviarAbandonadoSiCorresponde,
};

const MOTIVOS_OMITIDOS = new Set([
  "ya_enviada",
  "suscripcion_inactiva",
  "envio_en_proceso",
  "sin_email",
  "no_abandonado",
  "suscripcion_activa",
  "ya_contactado_mes",
  "esperando_antiguedad",
]);

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarIds(body) {
  const crudos = Array.isArray(body?.ids)
    ? body.ids
    : body?.id
      ? [body.id]
      : [];

  return Array.from(
    new Set(
      crudos
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_POR_LOTE);
}

function clasificarResultado(resultado) {
  if (resultado?.enviado) return "enviados";
  if (MOTIVOS_OMITIDOS.has(resultado?.motivo)) return "omitidos";
  return "errores";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (!resendConfigurado()) {
      return res.status(500).json({ message: "Resend no está configurado." });
    }

    const body = req.body || {};
    const tipo = body.tipo || "bienvenida";
    const reenviar = body.reenviar === true;
    const ids = normalizarIds(body);

    const enviador = ENVIADORES[tipo];

    if (!enviador) {
      return res
        .status(400)
        .json({ message: `Tipo de email no soportado: ${tipo}` });
    }

    if (ids.length === 0) {
      return res
        .status(400)
        .json({ message: "Seleccioná al menos un suscriptor." });
    }

    const db = getDb();
    const resultados = [];

    for (let i = 0; i < ids.length; i += 1) {
      const suscriptorId = ids[i];
      const docRef = db.collection("clubvinilos").doc(suscriptorId);

      try {
        const resultado = await enviador(docRef, {
          forzar: tipo === "bienvenida" && reenviar,
          disparo: reenviar ? "reenvio_manual" : "manual",
          actor: admin.email || null,
        });
        resultados.push({ suscriptorId, ...resultado });
      } catch (error) {
        console.error(
          `Error enviando email manual a ${suscriptorId}:`,
          error.message
        );
        resultados.push({
          suscriptorId,
          enviado: false,
          motivo: "error_envio",
          error: error.message,
        });
      }

      if (i < ids.length - 1) {
        await dormir(PAUSA_ENTRE_ENVIOS_MS);
      }
    }

    const resumen = {
      enviados: 0,
      omitidos: 0,
      errores: 0,
    };

    resultados.forEach((resultado) => {
      resumen[clasificarResultado(resultado)] += 1;
    });

    return res.status(200).json({
      tipo,
      procesados: resultados.length,
      ...resumen,
      resultados,
    });
  } catch (error) {
    console.error("No se pudieron enviar los emails manuales:", error);
    return res.status(500).json({
      message: "No se pudieron enviar los emails.",
      detail: error.message,
    });
  }
}

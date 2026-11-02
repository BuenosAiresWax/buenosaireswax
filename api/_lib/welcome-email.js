import { enviarEmailBienvenida, resendConfigurado } from "./resend.js";
import { registrarEnvioEmail } from "./email-log.js";

const RECLAMO_VALIDO_MS = 15 * 60 * 1000;

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function emailDeFicha(data, docId) {
  const candidatos = [
    data?.correo,
    data?.email,
    data?.mercadopago_email,
    docId,
  ];

  for (const candidato of candidatos) {
    const email = normalizarEmail(candidato);
    if (email.includes("@")) return email;
  }

  return null;
}

async function reclamarEnvio(docRef, opciones = {}) {
  const db = docRef.firestore;
  const ahora = Date.now();
  const forzar = opciones.forzar === true;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);

    if (!snap.exists) {
      return { omitir: "ficha_no_existe" };
    }

    const data = snap.data() || {};

    if (!forzar && data.bienvenidaEmailEnviadaEn) {
      return { omitir: "ya_enviada" };
    }

    if (data.activo !== true) {
      return { omitir: "suscripcion_inactiva" };
    }

    if (data.bienvenidaEmailEnProceso) {
      const intento = new Date(data.bienvenidaEmailIntentoEn || 0).getTime();
      const enCurso = Number.isFinite(intento) && ahora - intento < RECLAMO_VALIDO_MS;
      if (enCurso) return { omitir: "envio_en_proceso" };
    }

    const email = emailDeFicha(data, snap.id);
    if (!email) {
      return { omitir: "sin_email" };
    }

    tx.update(docRef, {
      bienvenidaEmailEnProceso: true,
      bienvenidaEmailIntentoEn: new Date(ahora).toISOString(),
    });

    return {
      email,
      nombre: data.nombre || "",
      forzado: forzar,
    };
  });
}

export async function enviarBienvenidaSiCorresponde(docRef, opciones = {}) {
  if (!docRef) {
    return { enviado: false, motivo: "sin_documento" };
  }

  if (!resendConfigurado()) {
    console.warn("Bienvenida omitida: RESEND_API_KEY no configurada.");
    return { enviado: false, motivo: "resend_no_configurado" };
  }

  let reclamo;

  try {
    reclamo = await reclamarEnvio(docRef, opciones);
  } catch (error) {
    console.error("No se pudo reclamar el envío de bienvenida:", error.message);
    return { enviado: false, motivo: "error_reclamo" };
  }

  if (reclamo.omitir) {
    return { enviado: false, motivo: reclamo.omitir };
  }

  const disparo = opciones.disparo || "automatico";
  const actor = opciones.actor || null;
  const idempotencyKey =
    opciones.idempotencyKey ||
    (reclamo.forzado
      ? `welcome-club/${docRef.id}/${Date.now()}`
      : `welcome-club/${docRef.id}`);

  try {
    const resultado = await enviarEmailBienvenida({
      to: reclamo.email,
      nombre: reclamo.nombre,
      idempotencyKey,
    });

    await docRef.set(
      {
        bienvenidaEmailEnviadaEn: new Date().toISOString(),
        bienvenidaEmailId: resultado?.id || null,
        bienvenidaEmailEnProceso: false,
        bienvenidaEmailError: null,
      },
      { merge: true }
    );

    await registrarEnvioEmail(docRef.firestore, {
      tipo: "bienvenida",
      estado: "enviado",
      email: reclamo.email,
      nombre: reclamo.nombre,
      suscriptorId: docRef.id,
      asunto: resultado?.asunto || null,
      resendId: resultado?.id || null,
      disparo,
      actor,
      idempotencyKey,
    });

    return { enviado: true, id: resultado?.id || null, email: reclamo.email };
  } catch (error) {
    console.error(
      `Error enviando bienvenida a ${reclamo.email}:`,
      error.message
    );

    try {
      await docRef.set(
        {
          bienvenidaEmailEnProceso: false,
          bienvenidaEmailError: String(error.message || error).slice(0, 300),
        },
        { merge: true }
      );
    } catch (updateError) {
      console.error(
        "No se pudo registrar el error de bienvenida:",
        updateError.message
      );
    }

    await registrarEnvioEmail(docRef.firestore, {
      tipo: "bienvenida",
      estado: "error",
      email: reclamo.email,
      nombre: reclamo.nombre,
      suscriptorId: docRef.id,
      disparo,
      actor,
      idempotencyKey,
      error: error.message || error,
    });

    return { enviado: false, motivo: "error_envio", error: error.message };
  }
}

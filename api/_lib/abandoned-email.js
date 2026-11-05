import { enviarEmailAbandonados, resendConfigurado } from "./resend.js";
import { registrarEnvioEmail } from "./email-log.js";

const RECLAMO_VALIDO_MS = 15 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_ESPERA = 3;
const MAX_POR_CORRIDA = 50;
const PAUSA_ENTRE_ENVIOS_MS = 300;

const MOTIVOS_OMITIDOS = new Set([
  "ficha_no_existe",
  "no_abandonado",
  "suscripcion_activa",
  "sin_email",
  "ya_contactado_mes",
  "envio_en_proceso",
  "esperando_antiguedad",
]);

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function aFecha(valor) {
  if (!valor) return null;

  if (typeof valor?.toDate === "function") {
    const fecha = valor.toDate();
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function mismoMes(fecha, ahora = new Date()) {
  return (
    fecha.getFullYear() === ahora.getFullYear() &&
    fecha.getMonth() === ahora.getMonth()
  );
}

export function esFichaAbandonada(data) {
  return (
    Boolean(data) &&
    data.activo !== true &&
    data.mercadopago_status === "pending"
  );
}

function fechaAbandono(data) {
  return (
    aFecha(data?.abandonadoDesde) ||
    aFecha(data?.actualizadoEn) ||
    aFecha(data?.fechaAlta)
  );
}

function fueContactadoEsteMes(data, ahora) {
  const enviado = aFecha(data?.abandonadoEmailEnviadoEn);
  return Boolean(enviado && mismoMes(enviado, ahora));
}

function reclamoVigente(data, ahora) {
  if (!data?.abandonadoEmailEnProceso) return false;
  const intento = aFecha(data?.abandonadoEmailIntentoEn);
  if (!intento) return true;
  return ahora.getTime() - intento.getTime() < RECLAMO_VALIDO_MS;
}

function estaEnEspera(data, ahora) {
  const desde = fechaAbandono(data);
  if (!desde) return true;
  return ahora.getTime() - desde.getTime() < DIAS_ESPERA * DIA_MS;
}

export function evaluarAbandonado(data, docId, ahora = new Date()) {
  const email = emailDeFicha(data, docId);
  const abandonado = esFichaAbandonada(data);
  const contactado = fueContactadoEsteMes(data, ahora);
  const esperando = estaEnEspera(data, ahora);
  const enProceso = reclamoVigente(data, ahora);
  const puedeEnviar =
    abandonado && Boolean(email) && !contactado && !esperando && !enProceso;

  return {
    abandonado,
    email,
    contactado,
    esperando,
    enProceso,
    puedeEnviar,
  };
}

export function calcularCamposAbandono(
  estado,
  existente = {},
  ahoraIso = new Date().toISOString()
) {
  if (estado === "pending") {
    if (existente.mercadopago_status === "pending") {
      if (existente.abandonadoDesde) {
        return { abandonadoDesde: existente.abandonadoDesde };
      }

      return {
        abandonadoDesde:
          existente.actualizadoEn || existente.fechaAlta || ahoraIso,
      };
    }

    return { abandonadoDesde: ahoraIso };
  }

  return existente.abandonadoDesde ? { abandonadoDesde: null } : {};
}

async function reclamarEnvio(docRef, ahora) {
  const db = docRef.firestore;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);

    if (!snap.exists) {
      return { omitir: "ficha_no_existe" };
    }

    const data = snap.data() || {};
    const evaluacion = evaluarAbandonado(data, snap.id, ahora);

    if (!evaluacion.abandonado) {
      return { omitir: "no_abandonado" };
    }

    if (!evaluacion.email) {
      return { omitir: "sin_email" };
    }

    if (evaluacion.contactado) {
      return { omitir: "ya_contactado_mes" };
    }

    if (evaluacion.enProceso) {
      return { omitir: "envio_en_proceso" };
    }

    if (evaluacion.esperando) {
      if (!fechaAbandono(data)) {
        tx.update(docRef, { abandonadoDesde: ahora.toISOString() });
      }
      return { omitir: "esperando_antiguedad" };
    }

    tx.update(docRef, {
      abandonadoEmailEnProceso: true,
      abandonadoEmailIntentoEn: ahora.toISOString(),
    });

    return {
      email: evaluacion.email,
      nombre: data.nombre || "",
    };
  });
}

export async function enviarAbandonadoSiCorresponde(docRef, opciones = {}) {
  if (!docRef) {
    return { enviado: false, motivo: "sin_documento" };
  }

  if (!resendConfigurado()) {
    console.warn("Abandonado omitido: RESEND_API_KEY no configurada.");
    return { enviado: false, motivo: "resend_no_configurado" };
  }

  const ahora = new Date();
  let reclamo;

  try {
    reclamo = await reclamarEnvio(docRef, ahora);
  } catch (error) {
    console.error(
      "No se pudo reclamar el envío de abandonado:",
      error.message
    );
    return { enviado: false, motivo: "error_reclamo" };
  }

  if (reclamo.omitir) {
    return { enviado: false, motivo: reclamo.omitir };
  }

  const disparo = opciones.disparo || "automatico";
  const actor = opciones.actor || null;
  const idempotencyKey = `abandoned-club/${docRef.id}/${ahora
    .toISOString()
    .slice(0, 7)}`;

  try {
    const resultado = await enviarEmailAbandonados({
      to: reclamo.email,
      nombre: reclamo.nombre,
      idempotencyKey,
    });

    await docRef.set(
      {
        abandonadoEmailEnviadoEn: new Date().toISOString(),
        abandonadoEmailId: resultado?.id || null,
        abandonadoEmailEnProceso: false,
        abandonadoEmailError: null,
      },
      { merge: true }
    );

    await registrarEnvioEmail(docRef.firestore, {
      tipo: "abandonados",
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
      `Error enviando email de abandonado a ${reclamo.email}:`,
      error.message
    );

    try {
      await docRef.set(
        {
          abandonadoEmailEnProceso: false,
          abandonadoEmailError: String(error.message || error).slice(0, 300),
        },
        { merge: true }
      );
    } catch (updateError) {
      console.error(
        "No se pudo registrar el error de abandonado:",
        updateError.message
      );
    }

    await registrarEnvioEmail(docRef.firestore, {
      tipo: "abandonados",
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

export async function procesarAbandonados(db, opciones = {}) {
  const limite = Math.min(
    200,
    Math.max(1, Number(opciones.limite) || MAX_POR_CORRIDA)
  );
  const ahora = new Date();
  const disparo = opciones.disparo || "automatico";
  const actor = opciones.actor || null;

  const snap = await db
    .collection("clubvinilos")
    .where("mercadopago_status", "==", "pending")
    .get();

  const candidatos = snap.docs
    .map((doc) => ({
      doc,
      evaluacion: evaluarAbandonado(doc.data() || {}, doc.id, ahora),
    }))
    .filter(({ evaluacion }) => evaluacion.abandonado && !evaluacion.contactado)
    .sort((a, b) => {
      const diferencia =
        Number(b.evaluacion.puedeEnviar) - Number(a.evaluacion.puedeEnviar);
      if (diferencia !== 0) return diferencia;
      return String(a.doc.id).localeCompare(String(b.doc.id));
    })
    .slice(0, limite);

  const resultados = [];

  for (let i = 0; i < candidatos.length; i += 1) {
    const { doc } = candidatos[i];

    try {
      const resultado = await enviarAbandonadoSiCorresponde(doc.ref, {
        disparo,
        actor,
      });
      resultados.push({ suscriptorId: doc.id, ...resultado });
    } catch (error) {
      console.error(
        `Error procesando abandonado ${doc.id}:`,
        error.message
      );
      resultados.push({
        suscriptorId: doc.id,
        enviado: false,
        motivo: "error_envio",
        error: error.message,
      });
    }

    if (i < candidatos.length - 1) {
      await dormir(PAUSA_ENTRE_ENVIOS_MS);
    }
  }

  const resumen = {
    procesados: resultados.length,
    enviados: 0,
    omitidos: 0,
    errores: 0,
  };

  resultados.forEach((resultado) => {
    if (resultado.enviado) resumen.enviados += 1;
    else if (MOTIVOS_OMITIDOS.has(resultado.motivo)) resumen.omitidos += 1;
    else resumen.errores += 1;
  });

  return { ...resumen, resultados };
}

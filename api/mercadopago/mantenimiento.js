import { getDb } from "../_lib/firebase-admin.js";
import { requireAdmin } from "../_lib/auth-admin.js";
import { importarPreapprovalsExternas } from "../_lib/mp-suscripciones.js";
import {
  obtenerTodasPreapprovals,
  sincronizarSuscriptor,
} from "./sync-pagos.js";

const ESTADO_DOC = "_mantenimiento_mp";
const SYNC_SAVE_EVERY = 5;
const MAX_MS = 270000;
const IMPORT_MAX_MS = 120000;

function normalizarClave(valor) {
  return String(valor || "").trim().toLowerCase();
}

function autorizadoCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  return String(header).trim() === `Bearer ${secret}`;
}

async function ejecutarImportacion(db, body) {
  const estadoRef = db.collection("clubvinilos").doc(ESTADO_DOC);
  const forzar = body.forzar === true;
  const estado = (await estadoRef.get()).data() || {};
  let offset = forzar ? 0 : Number(estado.importOffset) || 0;

  if (!forzar && estado.importCompletoEn) {
    const ultimo = new Date(estado.importCompletoEn).getTime();
    if (Date.now() - ultimo < 20 * 60 * 60 * 1000) {
      return { omitido: true, motivo: "ya_completado_hoy", offset };
    }
    offset = 0;
  }

  const inicio = Date.now();
  const resumen = {
    lotes: 0,
    creados: 0,
    actualizados: 0,
    conflictos: 0,
    omitidos: 0,
    errores: 0,
    pagos: 0,
    procesados: 0,
    bienvenidas: 0,
    bienvenidasError: 0,
  };

  while (offset != null && Date.now() - inicio < IMPORT_MAX_MS) {
    try {
      const r = await importarPreapprovalsExternas(db, { offset, limit: 10 });
      resumen.lotes += 1;
      resumen.creados += r.creados || 0;
      resumen.actualizados += r.actualizados || 0;
      resumen.conflictos += r.conflictos || 0;
      resumen.omitidos += r.omitidos || 0;
      resumen.errores += r.errores || 0;
      resumen.pagos += r.pagos || 0;
      resumen.procesados += r.procesados || 0;
      resumen.bienvenidas += r.bienvenidas || 0;
      resumen.bienvenidasError += r.bienvenidasError || 0;
      offset = r.nextOffset ?? null;

      await estadoRef.set(
        offset == null
          ? {
              importOffset: 0,
              importCompletoEn: new Date().toISOString(),
              importActualizadoEn: new Date().toISOString(),
            }
          : {
              importOffset: offset,
              importCompletoEn: null,
              importActualizadoEn: new Date().toISOString(),
            },
        { merge: true }
      );
    } catch (error) {
      console.error("Error importando lote MP:", error);
      resumen.errores += 1;
      await estadoRef.set(
        {
          importOffset: offset,
          importCompletoEn: null,
          importActualizadoEn: new Date().toISOString(),
          importUltimoError: String(error.message || error).slice(0, 300),
        },
        { merge: true }
      );
      break;
    }
  }

  return { ...resumen, nextOffset: offset, completo: offset == null };
}

function listaClavesSync(docs) {
  const vistos = new Set();
  const claves = [];
  for (const doc of docs) {
    if (doc.id === ESTADO_DOC) continue;
    const data = doc.data() || {};
    const clave = normalizarClave(
      data.correo || data.email || data.mercadopago_email || doc.id
    );
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    claves.push(clave);
  }
  return claves;
}

async function ejecutarSync(db, body) {
  const estadoRef = db.collection("clubvinilos").doc(ESTADO_DOC);
  const forzar = body.forzar === true;
  const estado = (await estadoRef.get()).data() || {};

  let cursor = forzar ? 0 : Number(estado.syncCursor) || 0;
  let claves = Array.isArray(estado.syncClaves) ? estado.syncClaves : null;

  if (!forzar && estado.syncCompletoEn) {
    const ultimo = new Date(estado.syncCompletoEn).getTime();
    if (Date.now() - ultimo < 20 * 60 * 60 * 1000) {
      return { omitido: true, motivo: "ya_completado_hoy", cursor };
    }
    cursor = 0;
    claves = null;
  }

  if (!claves || cursor === 0) {
    const snap = await db.collection("clubvinilos").get();
    claves = listaClavesSync(snap.docs);
    cursor = 0;
  }

  const cache = {};
  const cargarTodas = () => {
    if (!cache.todas) cache.todas = obtenerTodasPreapprovals();
    return cache.todas;
  };

  const inicio = Date.now();
  const resultados = [];
  let desdeGuardado = 0;

  while (cursor < claves.length && Date.now() - inicio < MAX_MS) {
    const clave = claves[cursor];
    cursor += 1;
    desdeGuardado += 1;

    try {
      resultados.push(
        await sincronizarSuscriptor(db, clave, {
          cargarTodas,
          enviarBienvenida: false,
        })
      );
    } catch (error) {
      console.error(`Error sincronizando ${clave}:`, error.message);
      resultados.push({
        email: clave,
        actualizado: false,
        motivo: error.message,
      });
    }

    if (desdeGuardado >= SYNC_SAVE_EVERY) {
      await estadoRef.set(
        {
          syncCursor: cursor,
          syncClaves: claves,
          syncCompletoEn: null,
          syncActualizadoEn: new Date().toISOString(),
          syncTotal: claves.length,
        },
        { merge: true }
      );
      desdeGuardado = 0;
    }
  }

  const completo = cursor >= claves.length;
  await estadoRef.set(
    completo
      ? {
          syncCursor: 0,
          syncClaves: null,
          syncCompletoEn: new Date().toISOString(),
          syncActualizadoEn: new Date().toISOString(),
          syncTotal: claves.length,
        }
      : {
          syncCursor: cursor,
          syncClaves: claves,
          syncCompletoEn: null,
          syncActualizadoEn: new Date().toISOString(),
          syncTotal: claves.length,
        },
    { merge: true }
  );

  return {
    procesados: resultados.length,
    actualizados: resultados.filter((r) => r.actualizado).length,
    errores: resultados.filter((r) => !r.actualizado).length,
    pagos: resultados.reduce((total, r) => total + (r.pagos || 0), 0),
    cursor,
    total: claves.length,
    completo,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    let admin = null;

    if (req.method === "POST") {
      admin = await requireAdmin(req, res);
      if (!admin) return;
    } else if (!autorizadoCron(req)) {
      return res.status(401).json({
        message:
          "No autorizado. Configurá CRON_SECRET para el mantenimiento automático.",
      });
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({ message: "MercadoPago no configurado." });
    }

    const db = getDb();
    const body =
      req.method === "POST" && req.body && typeof req.body === "object"
        ? req.body
        : {};
    const accion = String(req.query?.accion || body.accion || "ambos").toLowerCase();

    const respuesta = { accion, actor: admin?.email || "cron" };

    if (accion === "importar" || accion === "ambos") {
      try {
        respuesta.importacion = await ejecutarImportacion(db, body);
      } catch (error) {
        console.error("Error en importación MP:", error);
        respuesta.importacion = { error: error.message };
      }
    }

    if (accion === "sync" || accion === "ambos") {
      try {
        respuesta.pagos = await ejecutarSync(db, body);
      } catch (error) {
        console.error("Error en sync de pagos MP:", error);
        respuesta.pagos = { error: error.message };
      }
    }

    if (!respuesta.importacion && !respuesta.pagos) {
      return res.status(400).json({ message: "Acción no válida." });
    }

    return res.status(200).json(respuesta);
  } catch (error) {
    console.error("Error en mantenimiento MP:", error);
    return res.status(500).json({
      message: "No se pudo ejecutar el mantenimiento de MercadoPago.",
      detail: error.message,
    });
  }
}

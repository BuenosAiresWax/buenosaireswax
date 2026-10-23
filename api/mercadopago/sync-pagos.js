import { getDb } from "../_lib/firebase-admin.js";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_API_URL = "https://api.mercadopago.com";

async function fetchMp(path) {
  try {
    const res = await fetch(`${MP_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`MercadoPago ${path} returned ${res.status} ${body}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`Error fetching MercadoPago ${path}:`, e.message);
    return null;
  }
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function siguienteMes(fecha) {
  const iso = toIso(fecha);
  if (!iso) return null;
  const date = new Date(iso);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

async function fetchMpResult(path) {
  try {
    const res = await fetch(`${MP_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const body = await res.text().catch(() => "");

    if (!res.ok) {
      console.error(`MercadoPago ${path} returned ${res.status} ${body}`);
      return { error: `HTTP ${res.status}: ${body}` };
    }

    return { data: body ? JSON.parse(body) : null };
  } catch (e) {
    console.error(`Error fetching MercadoPago ${path}:`, e.message);
    return { error: e.message };
  }
}

async function obtenerFacturas(preapprovalId) {
  const facturas = [];
  let offset = 0;
  const limit = 20;

  while (true) {
    const { data, error } = await fetchMpResult(
      `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&limit=${limit}&offset=${offset}`
    );

    if (error) {
      return { facturas, error };
    }

    const pagina = data?.results || [];
    facturas.push(...pagina);

    const total = data?.paging?.total ?? facturas.length;
    offset += pagina.length;

    if (!pagina.length || offset >= total) break;
  }

  return { facturas, error: null };
}

function facturaPagada(factura) {
  const pagoEstado = factura?.payment?.status;
  if (pagoEstado) {
    return ["approved", "authorized", "processed"].includes(pagoEstado);
  }
  if (factura?.status) {
    return ["approved", "authorized", "processed", "paid", "accredited"].includes(
      factura.status
    );
  }
  if (factura?._raw_payment?.status) {
    return ["approved", "authorized", "processed", "paid", "accredited"].includes(
      factura._raw_payment.status
    );
  }
  return false;
}

function historialId(factura) {
  const paymentId = factura.payment?.id || factura?._raw_payment?.id || factura?.id;
  if (paymentId && String(paymentId).match(/^\d+$/)) {
    return `payment_${paymentId}`;
  }
  if (factura.payment?.id) {
    return `payment_${factura.payment.id}`;
  }
  if (factura?._raw_payment?.id) {
    return `payment_${factura._raw_payment.id}`;
  }
  return factura.id ? `authorized_${factura.id}` : null;
}

async function sincronizarSuscriptor(db, email) {
  const docRef = db.collection("clubvinilos").doc(email);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return { email, actualizado: false, motivo: "no_existe" };
  }

  const data = docSnap.data();
  const preapprovalId = data.mercadopago_preapproval_id;

  if (!preapprovalId) {
    return { email, actualizado: false, motivo: "sin_preapproval" };
  }

  const [preapproval, resultadoFacturas] = await Promise.all([
    fetchMp(`/preapproval/${preapprovalId}`),
    obtenerFacturas(preapprovalId),
  ]);

  if (!preapproval) {
    return { email, actualizado: false, motivo: "preapproval_no_encontrado" };
  }

  if (resultadoFacturas.error) {
    return {
      email,
      actualizado: false,
      motivo: `error_facturas: ${String(resultadoFacturas.error).slice(0, 180)}`,
    };
  }

  const facturas = resultadoFacturas.facturas;

  const pagadas = facturas.filter(facturaPagada);
  const batch = db.batch();
  const historialRef = docRef.collection("historialPagos");

  pagadas.forEach((factura) => {
    const fecha =
      toIso(factura.debit_date) ||
      toIso(factura.date_approved) ||
      toIso(factura.date_created) ||
      toIso(factura?._raw_payment?.date_approved) ||
      toIso(factura?._raw_payment?.date_created);
    if (!fecha) return;

    const id = historialId(factura);
    if (!id) return;

    const monto = Number(
      factura.transaction_amount ??
        factura?._raw_payment?.transaction_amount ??
        factura?._raw_payment?.transaction_details?.net_received_amount ??
        0
    );
    const estado =
      factura.payment?.status ||
      factura.status ||
      factura?._raw_payment?.status ||
      "approved";
    const paymentId = factura.payment?.id || factura?._raw_payment?.id || null;
    const moneda = factura.currency_id || factura?._raw_payment?.currency_id || "ARS";

    batch.set(
      historialRef.doc(id),
      {
        fecha,
        estado,
        monto: Number.isFinite(monto) ? monto : 0,
        moneda,
        mercadopago_payment_id: paymentId,
        mercadopago_authorized_payment_id:
          factura.id && !String(factura.id).startsWith?.("payment_")
            ? factura.id
            : null,
        mercadopago_preapproval_id: preapprovalId,
        type: "payment",
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true }
    );
  });

  const fechas = pagadas
    .map(
      (factura) =>
        toIso(factura.debit_date) ||
        toIso(factura.date_approved) ||
        toIso(factura.date_created) ||
        toIso(factura?._raw_payment?.date_approved) ||
        toIso(factura?._raw_payment?.date_created)
    )
    .filter(Boolean)
    .sort();

  const fechaPrimerPago = fechas[0] || null;
  const fechaUltimoPago = fechas[fechas.length - 1] || null;
  const fechaProximoCobro =
    toIso(preapproval?.next_payment_date) ||
    (fechaUltimoPago ? siguienteMes(fechaUltimoPago) : null);

  const updates = {
    mercadopago_preapproval_id: preapprovalId,
  };

  if (fechas.length > 0) {
    updates.fechaPrimerPago = fechaPrimerPago;
    updates.fechaUltimoPago = fechaUltimoPago;
  }

  if (fechaProximoCobro) {
    updates.fechaProximoCobro = fechaProximoCobro;
  }

  if (preapproval?.status === "authorized" && fechas.length > 0) {
    updates.activo = true;
    updates.pendiente = false;
    updates.mercadopago_status = "authorized";
  }

  batch.update(docRef, updates);
  await batch.commit();

  return {
    email,
    actualizado: true,
    pagos: pagadas.length,
    eliminados: 0,
    fechaPrimerPago,
    fechaUltimoPago,
    fechaProximoCobro,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ message: "MercadoPago no configurado." });
  }

  try {
    const { email, emails } = req.body || {};
    const lista = Array.isArray(emails) ? emails : email ? [email] : [];
    const normalizados = Array.from(
      new Set(
        lista
          .map((item) => String(item || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (normalizados.length === 0) {
      return res.status(400).json({ message: "Enviá al menos un email." });
    }

    const db = getDb();
    const resultados = await Promise.all(
      normalizados.map(async (item) => {
        try {
          return await sincronizarSuscriptor(db, item);
        } catch (error) {
          console.error(`Error sincronizando ${item}:`, error.message);
          return { email: item, actualizado: false, motivo: error.message };
        }
      })
    );

    const actualizados = resultados.filter((r) => r.actualizado).length;
    const errores = resultados.filter((r) => !r.actualizado).length;
    const pagos = resultados.reduce((total, r) => total + (r.pagos || 0), 0);
    const eliminados = resultados.reduce((total, r) => total + (r.eliminados || 0), 0);

    return res.status(200).json({
      procesados: resultados.length,
      actualizados,
      errores,
      pagos,
      eliminados,
      resultados,
    });
  } catch (error) {
    console.error("Sync pagos error:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

import { getDb } from "../_lib/firebase-admin.js";
import { fetchMp } from "../_lib/mp-http.js";
import {
  crearOActualizarFichaDesdePreapproval,
  esDelClub,
} from "../_lib/mp-suscripciones.js";

function fetchPreapprovalStatus(preapprovalId) {
  return fetchMp(`/preapproval/${preapprovalId}`);
}

function fetchPayment(paymentId) {
  return fetchMp(`/v1/payments/${paymentId}`);
}

function fetchAuthorizedPayment(authorizedPaymentId) {
  return fetchMp(`/authorized_payments/${authorizedPaymentId}`);
}

async function fetchAuthorizedPaymentByPaymentId(paymentId) {
  const data = await fetchMp(
    `/authorized_payments/search?payment_id=${encodeURIComponent(paymentId)}`
  );
  return data?.results?.[0] || null;
}

async function fetchAuthorizedPayments(preapprovalId) {
  const data = await fetchMp(
    `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`
  );
  return data?.results || [];
}

function facturaPagada(factura) {
  const pagoEstado = factura?.payment?.status;
  if (pagoEstado) return pagoEstado === "approved" || pagoEstado === "authorized";
  return ["processed", "approved", "authorized"].includes(factura?.status);
}

function fechaFactura(factura) {
  return toIso(factura?.debit_date) || toIso(factura?.date_created);
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fechaMasReciente(actual, nueva) {
  const actualIso = toIso(actual);
  const nuevaIso = toIso(nueva);
  if (!actualIso) return nuevaIso;
  if (!nuevaIso) return actualIso;
  return new Date(actualIso) > new Date(nuevaIso) ? actualIso : nuevaIso;
}

function fechaMasAntigua(actual, nueva) {
  const actualIso = toIso(actual);
  const nuevaIso = toIso(nueva);
  if (!actualIso) return nuevaIso;
  if (!nuevaIso) return actualIso;
  return new Date(actualIso) < new Date(nuevaIso) ? actualIso : nuevaIso;
}

function siguienteMes(fecha) {
  const iso = toIso(fecha);
  if (!iso) return null;
  const date = new Date(iso);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

async function buscarPorEmail(db, email) {
  if (!email) return null;
  const normalizado = String(email).trim().toLowerCase();

  const ref = await db.collection("clubvinilos").doc(normalizado).get();
  if (ref.exists) return ref;

  const snapshot = await db
    .collection("clubvinilos")
    .where("correo", "==", normalizado)
    .limit(1)
    .get();

  if (!snapshot.empty) return snapshot.docs[0];

  return null;
}

async function buscarSuscriptor(db, { preapprovalId, externalReference, payerEmail }) {
  if (preapprovalId) {
    const snapshot = await db
      .collection("clubvinilos")
      .where("mercadopago_preapproval_id", "==", preapprovalId)
      .limit(1)
      .get();
    if (!snapshot.empty) return snapshot.docs[0];
  }

  if (externalReference) {
    const ref = await buscarPorEmail(db, externalReference);
    if (ref) return ref;
  }

  if (payerEmail) {
    const ref = await buscarPorEmail(db, payerEmail);
    if (ref) return ref;
  }

  return null;
}

async function guardarHistorial(docRef, historialId, datos) {
  if (!historialId) return;
  await docRef
    .collection("historialPagos")
    .doc(String(historialId))
    .set(datos, { merge: true });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-signature");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ status: "ok" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("Webhook received:", JSON.stringify({ type: body?.type, action: body?.action, id: body?.id, data: body?.data }));

    if (!body || !body.type) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    if (body.type === "subscription_preapproval" || body.type === "preapproval") {
      const preapprovalId = body.data?.id;

      if (!preapprovalId) {
        return res.status(400).json({ message: "Missing preapproval ID" });
      }

      const db = getDb();
      const mpData = await fetchPreapprovalStatus(preapprovalId);
      const externalReference = mpData?.external_reference || body.data?.external_reference;
      const payerEmail = mpData?.payer_email || body.data?.payer_email;

      let doc = await buscarSuscriptor(db, {
        preapprovalId,
        externalReference,
        payerEmail,
      });

      if (!doc && mpData && esDelClub(mpData)) {
        const creado = await crearOActualizarFichaDesdePreapproval(db, mpData, {
          requerirNombre: true,
        });
        if (creado?.docId) {
          doc = await db.collection("clubvinilos").doc(creado.docId).get();
        }
      }

      if (!doc || !doc.exists) {
        console.warn("Webhook for unknown preapproval:", preapprovalId);
        return res.status(200).json({ status: "ignored", reason: "unknown_preapproval" });
      }

      const data = doc.data();
      const status = body.data?.status || mpData?.status || data.mercadopago_status;

      const statusMap = {
        authorized: { activo: true, pendiente: false },
        paused: { activo: false, pendiente: true },
        cancelled: { activo: false, pendiente: true },
      };

      const updates = {
        mercadopago_status: status,
        mercadopago_preapproval_id: data.mercadopago_preapproval_id || preapprovalId,
        ...(statusMap[status] || {}),
      };

      if (status === "authorized") {
        const facturas = (await fetchAuthorizedPayments(preapprovalId))
          .filter(facturaPagada)
          .map((factura) => ({ ...factura, fecha: fechaFactura(factura) }))
          .filter((factura) => factura.fecha)
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        if (facturas.length > 0) {
          const ultimaFactura = facturas[facturas.length - 1];
          updates.fechaPrimerPago = facturas[0].fecha;
          updates.fechaUltimoPago = ultimaFactura.fecha;
          updates.fechaProximoCobro =
            toIso(mpData?.next_payment_date) || siguienteMes(ultimaFactura.fecha);
        } else if (mpData?.next_payment_date) {
          updates.fechaProximoCobro = toIso(mpData.next_payment_date);
        }

        await Promise.all(
          facturas.map((factura) => {
            const historialId = factura.payment?.id
              ? `payment_${factura.payment.id}`
              : `authorized_${factura.id}`;
            return guardarHistorial(doc.ref, historialId, {
              fecha: factura.fecha,
              estado: factura.payment?.status || factura.status || "authorized",
              monto: Number(factura.transaction_amount) || 0,
              moneda: factura.currency_id || "ARS",
              mercadopago_payment_id: factura.payment?.id || null,
              mercadopago_authorized_payment_id: factura.id || null,
              mercadopago_preapproval_id: preapprovalId,
              type: "payment",
              actualizadoEn: new Date().toISOString(),
            });
          })
        );
      }

      await doc.ref.update(updates);

      return res.status(200).json({ status: "processed" });
    }

    if (
      body.type === "subscription_authorized_payment" ||
      body.type === "authorized_payment"
    ) {
      const db = getDb();
      const authorizedPaymentId = body.data?.id;

      if (!authorizedPaymentId) {
        return res.status(200).json({ status: "ignored" });
      }

      const authorizedPayment = await fetchAuthorizedPayment(authorizedPaymentId);
      const preapprovalId =
        authorizedPayment?.preapproval_id || body.data?.preapproval_id;
      const externalReference =
        authorizedPayment?.external_reference || body.data?.external_reference;

      let doc = await buscarSuscriptor(db, {
        preapprovalId,
        externalReference,
        payerEmail: null,
      });

      if (!doc && preapprovalId) {
        const preapproval = await fetchPreapprovalStatus(preapprovalId);
        if (preapproval && esDelClub(preapproval)) {
          const creado = await crearOActualizarFichaDesdePreapproval(
            db,
            preapproval,
            { requerirNombre: true }
          );
          if (creado?.docId) {
            doc = await db.collection("clubvinilos").doc(creado.docId).get();
          }
        }
      }

      if (!doc || !doc.exists) {
        console.warn(
          "Authorized payment webhook for unknown subscriber:",
          authorizedPaymentId
        );
        return res.status(200).json({ status: "ignored", reason: "unknown_subscriber" });
      }

      const data = doc.data();
      const paymentId = authorizedPayment?.payment?.id;
      const estado =
        authorizedPayment?.payment?.status ||
        authorizedPayment?.status ||
        body.data?.status ||
        "unknown";
      const fechaPago =
        toIso(authorizedPayment?.debit_date) ||
        toIso(authorizedPayment?.date_created) ||
        toIso(body.data?.debit_date) ||
        new Date().toISOString();
      const monto = Number(
        authorizedPayment?.transaction_amount ?? body.data?.transaction_amount ?? 0
      );

      await guardarHistorial(
        doc.ref,
        paymentId ? `payment_${paymentId}` : `authorized_${authorizedPaymentId}`,
        {
          fecha: fechaPago,
          estado,
          monto,
          moneda: authorizedPayment?.currency_id || body.data?.currency_id || "ARS",
          mercadopago_payment_id: paymentId || null,
          mercadopago_authorized_payment_id: authorizedPayment?.id || authorizedPaymentId,
          mercadopago_preapproval_id: preapprovalId || data.mercadopago_preapproval_id || null,
          type: "payment",
          actualizadoEn: new Date().toISOString(),
        }
      );

      const pagoAprobado = authorizedPayment?.payment?.status
        ? ["approved", "authorized"].includes(authorizedPayment.payment.status)
        : ["processed", "approved", "authorized"].includes(authorizedPayment?.status);

      if (pagoAprobado) {
        const preapproval = preapprovalId
          ? await fetchPreapprovalStatus(preapprovalId)
          : null;

        await doc.ref.update({
          fechaPrimerPago: fechaMasAntigua(data.fechaPrimerPago, fechaPago),
          fechaUltimoPago: fechaMasReciente(data.fechaUltimoPago, fechaPago),
          fechaProximoCobro:
            toIso(preapproval?.next_payment_date) || siguienteMes(fechaPago),
          mercadopago_status: "authorized",
          mercadopago_preapproval_id:
            data.mercadopago_preapproval_id || preapprovalId || null,
          activo: true,
          pendiente: false,
        });
      }

      return res.status(200).json({ status: "processed" });
    }

    if (body.type === "payment") {
      const db = getDb();
      const paymentId = body.data?.id;

      if (!paymentId) {
        return res.status(200).json({ status: "ignored" });
      }

      const payment = await fetchPayment(paymentId);
      let preapprovalId =
        payment?.metadata?.preapproval_id ||
        payment?.preapproval_id ||
        body.data?.preapproval_id;

      let authorizedPayment = null;
      if (!preapprovalId) {
        authorizedPayment = await fetchAuthorizedPaymentByPaymentId(paymentId);
        preapprovalId = authorizedPayment?.preapproval_id;
      }

      const externalReference =
        payment?.external_reference ||
        body.data?.external_reference ||
        authorizedPayment?.external_reference;
      const payerEmail = payment?.payer?.email || body.data?.payer_email;

      let doc = await buscarSuscriptor(db, {
        preapprovalId,
        externalReference,
        payerEmail,
      });

      if (!doc && preapprovalId) {
        const preapproval = await fetchPreapprovalStatus(preapprovalId);
        if (preapproval && esDelClub(preapproval)) {
          const creado = await crearOActualizarFichaDesdePreapproval(
            db,
            preapproval,
            { requerirNombre: true }
          );
          if (creado?.docId) {
            doc = await db.collection("clubvinilos").doc(creado.docId).get();
          }
        }
      }

      if (!doc || !doc.exists) {
        console.warn("Payment webhook for unknown subscriber:", paymentId);
        return res.status(200).json({ status: "ignored", reason: "unknown_subscriber" });
      }

      const data = doc.data();
      const estado = payment?.status || body.data?.status || "unknown";
      const fechaPago =
        toIso(payment?.date_approved) ||
        toIso(payment?.date_created) ||
        toIso(body.data?.date_created) ||
        new Date().toISOString();
      const monto = Number(
        payment?.transaction_amount ??
          body.data?.transaction_amount ??
          authorizedPayment?.transaction_amount ??
          0
      );

      await guardarHistorial(doc.ref, `payment_${paymentId}`, {
        fecha: fechaPago,
        estado,
        monto,
        moneda: payment?.currency_id || body.data?.currency_id || "ARS",
        mercadopago_payment_id: payment?.id || paymentId,
        mercadopago_authorized_payment_id: authorizedPayment?.id || null,
        mercadopago_preapproval_id: preapprovalId || data.mercadopago_preapproval_id || null,
        type: "payment",
        actualizadoEn: new Date().toISOString(),
      });

      if (estado === "approved" || estado === "authorized") {
        const preapproval = preapprovalId
          ? await fetchPreapprovalStatus(preapprovalId)
          : null;

        await doc.ref.update({
          fechaPrimerPago: fechaMasAntigua(data.fechaPrimerPago, fechaPago),
          fechaUltimoPago: fechaMasReciente(data.fechaUltimoPago, fechaPago),
          fechaProximoCobro:
            toIso(preapproval?.next_payment_date) || siguienteMes(fechaPago),
          mercadopago_status: "authorized",
          mercadopago_preapproval_id:
            data.mercadopago_preapproval_id || preapprovalId || null,
          activo: true,
          pendiente: false,
        });
      }

      return res.status(200).json({ status: "processed" });
    }

    return res.status(200).json({ status: "ignored" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

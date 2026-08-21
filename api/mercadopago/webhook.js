import { getDb } from "../_lib/firebase-admin.js";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

async function fetchPreapprovalStatus(preapprovalId) {
  try {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Error fetching preapproval from MP:", e.message);
    return null;
  }
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
      const snapshot = await db
        .collection("clubvinilos")
        .where("mercadopago_preapproval_id", "==", preapprovalId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.warn("Webhook for unknown preapproval:", preapprovalId);
        return res.status(200).json({ status: "ignored", reason: "unknown_preapproval" });
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      let status = body.data?.status;

      if (!status) {
        const mpData = await fetchPreapprovalStatus(preapprovalId);
        status = mpData?.status || data.mercadopago_status;
        console.log("Fetched preapproval status from MP:", status, "for", preapprovalId);
      }

      const statusMap = {
        authorized: { activo: true, pendiente: false },
        paused: { activo: false, pendiente: false },
        cancelled: { activo: false, pendiente: false },
      };

      const updates = {
        mercadopago_status: status,
        ...(statusMap[status] || {}),
      };

      if (status === "authorized" && !data.fechaPrimerPago) {
        updates.fechaPrimerPago = new Date().toISOString();
      }

      if (status === "authorized") {
        updates.fechaUltimoPago = new Date().toISOString();
        updates.fechaProximoCobro = body.data?.next_payment_date || null;

        const historialRef = doc.ref.collection("historialPagos").doc();
        await historialRef.set({
          fecha: new Date().toISOString(),
          estado: "authorized",
          monto: body.data?.transaction_amount || 100,
          mercadopago_payment_id: body.data?.payment_id || null,
          type: "payment",
        });
      }

      await doc.ref.update(updates);

      return res.status(200).json({ status: "processed" });
    }

    if (body.type === "payment") {
      const db = getDb();
      const preapprovalId = body.data?.preapproval_id;

      if (!preapprovalId) {
        return res.status(200).json({ status: "ignored" });
      }

      const snapshot = await db
        .collection("clubvinilos")
        .where("mercadopago_preapproval_id", "==", preapprovalId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return res.status(200).json({ status: "ignored" });
      }

      const doc = snapshot.docs[0];
      const paymentId = body.data?.id;

      const historialRef = doc.ref.collection("historialPagos").doc();
      await historialRef.set({
        fecha: new Date().toISOString(),
        estado: body.data?.status || "unknown",
        monto: body.data?.transaction_amount || 100,
        mercadopago_payment_id: paymentId || null,
        type: "payment",
      });

      await doc.ref.update({
        fechaUltimoPago: new Date().toISOString(),
        fechaProximoCobro: body.data?.next_payment_date || null,
      });

      return res.status(200).json({ status: "processed" });
    }

    return res.status(200).json({ status: "ignored" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

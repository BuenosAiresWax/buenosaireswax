import { getDb } from "../_lib/firebase-admin.js";

const MP_PREAPPROVAL_PLAN_ID = "b9a00d38781c426a86372c2105819cf7";

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

  try {
    const { email, nombre } = req.body;

    if (!email || !nombre) {
      return res.status(400).json({ message: "Email y nombre son requeridos." });
    }

    const subscriberId = email.trim().toLowerCase();
    const db = getDb();
    const docRef = db.collection("clubvinilos").doc(subscriberId);
    const docSnap = await docRef.get();

    if (docSnap.exists && docSnap.data().activo) {
      return res.status(400).json({ message: "Ya tenés una suscripción activa." });
    }

    await docRef.set({
      mercadopago_plan_id: MP_PREAPPROVAL_PLAN_ID,
      mercadopago_preapproval_id: null,
      mercadopago_status: "pending",
    }, { merge: true });

    const checkoutUrl = `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${MP_PREAPPROVAL_PLAN_ID}`;

    return res.status(200).json({
      init_point: checkoutUrl,
      checkout_url: checkoutUrl,
      preapproval_plan_id: MP_PREAPPROVAL_PLAN_ID,
    });
  } catch (error) {
    console.error("Error creating subscription:", error.message, error.stack);
    return res.status(500).json({ message: "Error interno del servidor.", error: error.message });
  }
}

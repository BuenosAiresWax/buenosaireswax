import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_API_URL = "https://api.mercadopago.com";

let firebaseAdminApp;
function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    firebaseAdminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return firebaseAdminApp;
}

function getDb() {
  getFirebaseAdmin();
  return getFirestore();
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
    return res.status(500).json({
      message: "MercadoPago no configurado. Agregá MP_ACCESS_TOKEN en las variables de entorno de Vercel.",
    });
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

    const forwardedProto = req.headers["x-forwarded-proto"];
    const forwardedHost = req.headers["x-forwarded-host"];
    const origin = forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : req.headers.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://buenosaireswax.vercel.app");

    const callbackUrl = `${origin}/`;
    const backUrl = callbackUrl;

    const webhookUrl = new URL(`${origin}/api/mercadopago/webhook`);
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypassSecret) {
      webhookUrl.searchParams.set("x-vercel-protection-bypass", bypassSecret);
    }

    const mpResponse = await fetch(`${MP_API_URL}/preapproval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        reason: "Vinyl Club BAWAX - Suscripción mensual",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 100,
          currency_id: "ARS",
        },
        payer_email: email.trim(),
        back_url: backUrl,
        notification_url: webhookUrl.toString(),
        external_reference: subscriberId,
      }),
    });

    const responseText = await mpResponse.text();
    let mpPayload = null;

    try {
      mpPayload = responseText ? JSON.parse(responseText) : null;
    } catch {
      mpPayload = { message: responseText || "Respuesta vacía de MercadoPago" };
    }

    if (!mpResponse.ok) {
      console.error("MercadoPago subscription error:", JSON.stringify(mpPayload));
      const mpMessage = mpPayload?.message || mpPayload?.error || "MercadoPago rechazó la solicitud.";
      return res.status(mpResponse.status).json({
        message: `MercadoPago rechazó la solicitud: ${mpMessage}`,
        details: mpPayload,
      });
    }

    const preapproval = mpPayload || {};
    const checkoutUrl = preapproval.init_point || preapproval.sandbox_init_point || preapproval.subscription_url || null;

    if (!checkoutUrl) {
      return res.status(502).json({
        message: "MercadoPago no devolvió una URL de checkout válida.",
        details: preapproval,
      });
    }

    await docRef.update({
      mercadopago_preapproval_id: preapproval.id,
      mercadopago_status: preapproval.status,
      pendiente: false,
    });

    return res.status(200).json({
      init_point: checkoutUrl,
      sandbox_init_point: preapproval.sandbox_init_point || null,
      checkout_url: checkoutUrl,
      preapproval_id: preapproval.id,
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

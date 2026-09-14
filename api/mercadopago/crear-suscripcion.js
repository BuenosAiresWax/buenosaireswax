import { getDb } from "../_lib/firebase-admin.js";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_API_URL = "https://api.mercadopago.com";

function getPublicOrigin(req) {
  const configuredOrigin = process.env.PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configuredOrigin) {
    const origin = configuredOrigin.startsWith("http") ? configuredOrigin : `https://${configuredOrigin}`;
    return origin.replace(/\/$/, "");
  }

  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host;
  if (forwardedHost) {
    return `https://${forwardedHost.split(",")[0].trim()}`;
  }

  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://buenosaireswax.vercel.app";
  return origin.replace(/\/$/, "");
}

function getCheckoutUrl(payload) {
  const candidates = [payload?.init_point, payload?.sandbox_init_point, payload?.subscription_url];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      const url = new URL(candidate);
      const isMercadoPagoHost =
        url.hostname === "mercadopago.com" ||
        url.hostname.endsWith(".mercadopago.com") ||
        url.hostname === "mercadopago.com.ar" ||
        url.hostname.endsWith(".mercadopago.com.ar") ||
        url.hostname === "mercadolibre.com" ||
        url.hostname.endsWith(".mercadolibre.com") ||
        url.hostname === "mercadolibre.com.ar" ||
        url.hostname.endsWith(".mercadolibre.com.ar");

      if (url.protocol === "https:" && isMercadoPagoHost) {
        return url.toString();
      }
    } catch {}
  }

  return null;
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

    const origin = getPublicOrigin(req);

    const callbackUrl = `${origin}/#/club`;
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
          transaction_amount: 70000,
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

    console.log("MercadoPago subscription response:", JSON.stringify({
      status: mpResponse.status,
      ok: mpResponse.ok,
      origin,
      payloadKeys: mpPayload && typeof mpPayload === "object" ? Object.keys(mpPayload) : [],
      preapprovalId: mpPayload?.id || null,
      initPointHost: getCheckoutUrl(mpPayload)?.split("/")[2] || null,
    }));

    if (!mpResponse.ok) {
      const mpMessage = mpPayload?.message || mpPayload?.error || "MercadoPago rechazó la solicitud.";
      return res.status(mpResponse.status).json({
        message: `MercadoPago rechazó la solicitud: ${mpMessage}`,
        details: mpPayload,
      });
    }

    const preapproval = mpPayload || {};
    const checkoutUrl = getCheckoutUrl(preapproval);

    if (!checkoutUrl || !preapproval.id) {
      console.error("MercadoPago returned an unusable subscription response:", JSON.stringify({
        payloadKeys: Object.keys(preapproval),
        preapprovalId: preapproval.id || null,
        hasCheckoutUrl: Boolean(checkoutUrl),
      }));
      return res.status(502).json({
        message: "MercadoPago no devolvió una URL de checkout válida.",
        details: preapproval,
      });
    }

    await docRef.set({
      mercadopago_preapproval_id: preapproval.id,
      mercadopago_status: preapproval.status,
    }, { merge: true });

    return res.status(200).json({
      init_point: checkoutUrl,
      sandbox_init_point: preapproval.sandbox_init_point || null,
      checkout_url: checkoutUrl,
      preapproval_id: preapproval.id,
    });
  } catch (error) {
    console.error("Error creating subscription:", error.message, error.stack);
    return res.status(500).json({ message: "Error interno del servidor.", error: error.message });
  }
}

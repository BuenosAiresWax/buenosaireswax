import { getDb } from "../_lib/firebase-admin.js";
import { requireAdmin } from "../_lib/auth-admin.js";
import { resendConfigurado } from "../_lib/resend.js";
import { procesarAbandonados } from "../_lib/abandoned-email.js";

function autorizadoCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers?.authorization || req.headers?.Authorization || "";
  return String(header).trim() === `Bearer ${secret}`;
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
          "No autorizado. Configurá CRON_SECRET para el envío automático.",
      });
    }

    if (!resendConfigurado()) {
      return res.status(500).json({ message: "Resend no está configurado." });
    }

    const body = req.body || {};
    const resultado = await procesarAbandonados(getDb(), {
      limite: body.limite,
      disparo: req.method === "GET" ? "automatico" : "manual",
      actor: admin?.email || "cron",
    });

    return res.status(200).json(resultado);
  } catch (error) {
    console.error("No se pudieron procesar los abandonados:", error);
    return res.status(500).json({
      message: "No se pudieron procesar los emails de abandonados.",
      detail: error.message,
    });
  }
}

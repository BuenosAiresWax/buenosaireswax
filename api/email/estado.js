import { requireAdmin } from "../_lib/auth-admin.js";
import {
  obtenerRemitente,
  resendConfigurado,
  tiposEmailDisponibles,
} from "../_lib/resend.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { fromEmail, fromName, replyTo } = obtenerRemitente();

  return res.status(200).json({
    proveedor: "resend",
    configurado: resendConfigurado(),
    fromEmail,
    fromName,
    replyTo,
    tipos: tiposEmailDisponibles(),
  });
}

import { getAuth } from "firebase-admin/auth";
import {
  firebaseAdminConfigurado,
  getFirebaseAdmin,
} from "./firebase-admin.js";

function emailsPermitidos() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(req, res) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = String(header).startsWith("Bearer ")
    ? String(header).slice(7).trim()
    : "";

  if (!token) {
    res.status(401).json({ message: "Sesión no válida. Volvé a iniciar sesión." });
    return null;
  }

  if (!firebaseAdminConfigurado()) {
    console.error("Firebase Admin no configurado en el servidor.");
    res.status(500).json({
      message: "Firebase Admin no está configurado en el servidor.",
    });
    return null;
  }

  try {
    const decoded = await getAuth(getFirebaseAdmin()).verifyIdToken(token);
    const permitidos = emailsPermitidos();

    if (
      permitidos.length > 0 &&
      !permitidos.includes(String(decoded.email || "").toLowerCase())
    ) {
      res.status(403).json({ message: "No tenés permisos para esta acción." });
      return null;
    }

    return decoded;
  } catch (error) {
    console.error("No se pudo validar el token de admin:", error.message);
    res.status(401).json({ message: "Sesión no válida. Volvé a iniciar sesión." });
    return null;
  }
}

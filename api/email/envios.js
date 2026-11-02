import { getDb } from "../_lib/firebase-admin.js";
import { requireAdmin } from "../_lib/auth-admin.js";

const MAX_REGISTROS = 500;

function serializarFecha(valor) {
  if (!valor) return null;

  if (typeof valor?.toDate === "function") {
    return valor.toDate().toISOString();
  }

  if (valor instanceof Date) {
    return valor.toISOString();
  }

  return valor;
}

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

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const snap = await getDb()
      .collection("email_envios")
      .orderBy("creadoEn", "desc")
      .limit(MAX_REGISTROS)
      .get();

    const envios = snap.docs.map((doc) => {
      const data = doc.data() || {};

      return {
        id: doc.id,
        ...data,
        creadoEn: serializarFecha(data.creadoEn),
      };
    });

    return res.status(200).json({ envios });
  } catch (error) {
    console.error("No se pudo cargar el registro de emails:", error);
    return res.status(500).json({
      message: "No se pudo cargar el registro de envíos.",
      detail: error.message,
    });
  }
}

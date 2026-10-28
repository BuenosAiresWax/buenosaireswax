import { getDb } from "../_lib/firebase-admin.js";
import { importarPreapprovalsExternas } from "../_lib/mp-suscripciones.js";

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

  if (!process.env.MP_ACCESS_TOKEN) {
    return res.status(500).json({ message: "MercadoPago no configurado." });
  }

  try {
    const { offset, limit, incluirPendientes, incluirCancelados } =
      req.body || {};

    const db = getDb();
    const resultado = await importarPreapprovalsExternas(db, {
      offset,
      limit,
      incluirPendientes,
      incluirCancelados,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    console.error("Reconciliar suscripciones error:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

import { getDb } from "../_lib/firebase-admin.js";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_API_URL = "https://api.mercadopago.com";

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
    return res.status(500).json({ message: "MercadoPago no configurado." });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email es requerido." });
    }

    const db = getDb();
    const docSnap = await db
      .collection("clubvinilos")
      .doc(email.trim().toLowerCase())
      .get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Suscriptor no encontrado." });
    }

    const data = docSnap.data();

    if (!data.mercadopago_preapproval_id) {
      return res.status(400).json({ message: "No hay suscripción de MercadoPago asociada." });
    }

    const mpResponse = await fetch(
      `${MP_API_URL}/preapproval/${data.mercadopago_preapproval_id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      }
    );

    if (!mpResponse.ok) {
      const mpError = await mpResponse.json();
      console.error("MercadoPago cancel error:", mpError);
      return res.status(mpResponse.status).json({
        message: "Error al cancelar en MercadoPago.",
        details: mpError,
      });
    }

    await docSnap.ref.update({
      activo: false,
      pendiente: false,
      mercadopago_status: "cancelled",
      fechaCancelacion: new Date().toISOString(),
    });

    return res.status(200).json({ status: "cancelled" });
  } catch (error) {
    console.error("Cancel error:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

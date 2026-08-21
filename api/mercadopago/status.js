import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.query;

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

    const historialSnap = await docSnap.ref.collection("historialPagos").get();
    const historialPagos = historialSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return res.status(200).json({
      activo: data.activo,
      mercadopago_status: data.mercadopago_status,
      preferencias: data.preferencias,
      nombre: data.nombre,
      fechaAlta: data.fechaAlta,
      fechaPrimerPago: data.fechaPrimerPago || null,
      fechaUltimoPago: data.fechaUltimoPago || null,
      fechaProximoCobro: data.fechaProximoCobro || null,
      historialPagos,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

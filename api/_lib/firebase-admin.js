import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function formatPrivateKey(key) {
  if (!key) return key;
  let formatted = key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!formatted.includes("-----BEGIN")) {
    return formatted;
  }
  return formatted;
}

let firebaseAdminApp;

export function firebaseAdminConfigurado() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    const existentes = getApps();

    if (existentes.length > 0) {
      firebaseAdminApp = existentes[0];
      return firebaseAdminApp;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Firebase Admin no está configurado. Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY."
      );
    }

    firebaseAdminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return firebaseAdminApp;
}

export function getDb() {
  getFirebaseAdmin();
  return getFirestore();
}

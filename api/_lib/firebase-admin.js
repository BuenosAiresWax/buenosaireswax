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
export function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
      console.error("Firebase Admin env vars missing:", {
        projectId: !!projectId,
        clientEmail: !!clientEmail,
        privateKey: !!privateKey,
      });
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

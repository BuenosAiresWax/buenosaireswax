const FIREBASE_LOOKUP_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

function emailsPermitidos() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function apiKeyFirebase() {
  return process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
}

function firebaseAdminConfigurado() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

async function verificarConAdmin(token) {
  if (!firebaseAdminConfigurado()) {
    throw new Error("Firebase Admin no está configurado.");
  }

  const [{ getAuth }, { getFirebaseAdmin }] = await Promise.all([
    import("firebase-admin/auth"),
    import("./firebase-admin.js"),
  ]);

  const decoded = await getAuth(getFirebaseAdmin()).verifyIdToken(token);

  return {
    uid: decoded.uid,
    email: decoded.email || "",
    emailVerified: decoded.email_verified === true,
    displayName: decoded.name || "",
  };
}

async function verificarConRest(token) {
  const apiKey = apiKeyFirebase();

  if (!apiKey) {
    throw new Error(
      "FIREBASE_API_KEY no está configurada en el servidor para validar la sesión."
    );
  }

  const respuesta = await fetch(`${FIREBASE_LOOKUP_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(8000),
  });

  const data = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const mensaje =
      data?.error?.message || `Firebase Auth respondió ${respuesta.status}`;
    throw new Error(mensaje);
  }

  const usuario = data?.users?.[0];

  if (!usuario) {
    throw new Error("El token no corresponde a un usuario válido.");
  }

  return {
    uid: usuario.localId,
    email: usuario.email || "",
    emailVerified: usuario.emailVerified === true,
    displayName: usuario.displayName || "",
  };
}

async function verificarIdToken(token) {
  try {
    return await verificarConAdmin(token);
  } catch (adminError) {
    console.warn(
      "Validación con Firebase Admin no disponible, usando REST:",
      adminError.message
    );
    return verificarConRest(token);
  }
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

  try {
    const decoded = await verificarIdToken(token);
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

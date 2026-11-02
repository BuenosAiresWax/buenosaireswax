const COLECCION_ENVIOS = "email_envios";

function limpiarTexto(valor, maximo = 500) {
  if (valor == null) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  return texto.slice(0, maximo);
}

export async function registrarEnvioEmail(db, datos = {}) {
  if (!db) return null;

  const payload = {
    tipo: datos.tipo || "bienvenida",
    estado: datos.estado === "error" ? "error" : "enviado",
    email: limpiarTexto(datos.email, 320),
    nombre: limpiarTexto(datos.nombre, 200),
    suscriptorId: limpiarTexto(datos.suscriptorId, 320),
    asunto: limpiarTexto(datos.asunto, 300),
    resendId: limpiarTexto(datos.resendId, 200),
    error: limpiarTexto(datos.error, 500),
    disparo: datos.disparo || "automatico",
    actor: limpiarTexto(datos.actor, 320),
    idempotencyKey: limpiarTexto(datos.idempotencyKey, 256),
    creadoEn: new Date().toISOString(),
  };

  try {
    const ref = await db.collection(COLECCION_ENVIOS).add(payload);
    return ref.id;
  } catch (error) {
    console.error("No se pudo guardar el registro de email:", error.message);
    return null;
  }
}

export { COLECCION_ENVIOS };

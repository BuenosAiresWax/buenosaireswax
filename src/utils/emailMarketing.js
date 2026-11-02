import { auth } from "../firebase/config";

const API_BASE = "/api/email";

async function pedirAdmin(ruta, opciones = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Sesión no válida. Volvé a iniciar sesión.");
  }

  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Error de Email Marketing (HTTP ${response.status})`
    );
  }

  return data;
}

export function obtenerEstadoEmailMarketing() {
  return pedirAdmin("/estado");
}

export function enviarEmailsMarketing({
  ids,
  tipo = "bienvenida",
  reenviar = false,
}) {
  return pedirAdmin("/enviar", {
    method: "POST",
    body: JSON.stringify({ ids, tipo, reenviar }),
  });
}

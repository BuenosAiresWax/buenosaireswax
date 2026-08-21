const API_BASE = "/api/mercadopago";

export async function crearSuscripcion({ email, nombre }) {
  const response = await fetch(`${API_BASE}/crear-suscripcion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, nombre }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Error al crear suscripción");
  }

  return response.json();
}

export async function verificarEstado(email) {
  const response = await fetch(
    `${API_BASE}/status?email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Error al verificar estado");
  }

  return response.json();
}

export async function cancelarSuscripcion(email) {
  const response = await fetch(`${API_BASE}/cancelar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Error al cancelar suscripción");
  }

  return response.json();
}

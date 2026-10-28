const MP_API_URL = "https://api.mercadopago.com";
const MP_MAX_REINTENTOS = 3;
const MP_ESPERA_BASE_MS = 700;
const MP_ESPERA_ENTRE_LLAMADAS_MS = 200;
const MP_PRESUPUESTO_REINTENTOS_MS = 4000;

let ultimaLlamada = 0;
let cola = Promise.resolve();

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encolar(tarea) {
  const siguiente = cola.then(async () => {
    const ahora = Date.now();
    const desdeUltima = ahora - ultimaLlamada;
    if (desdeUltima < MP_ESPERA_ENTRE_LLAMADAS_MS) {
      await esperar(MP_ESPERA_ENTRE_LLAMADAS_MS - desdeUltima);
    }
    ultimaLlamada = Date.now();
    return tarea();
  });

  cola = siguiente.catch(() => {});
  return siguiente;
}

function esperaReintento(res, intento) {
  const retryAfter = Number(res?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return Math.min(
    MP_ESPERA_BASE_MS * 2 ** (intento - 1) + Math.random() * 250,
    5000
  );
}

export async function fetchMpResult(path) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      data: null,
      error: "MercadoPago no configurado.",
      status: 0,
      notFound: false,
    };
  }

  let ultimoError = "";
  let ultimoStatus = 0;
  let presupuestoReintentos = MP_PRESUPUESTO_REINTENTOS_MS;

  for (let intento = 1; intento <= MP_MAX_REINTENTOS; intento += 1) {
    try {
      const res = await encolar(() =>
        fetch(`${MP_API_URL}${path}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      );

      const body = await res.text().catch(() => "");

      if (res.ok) {
        return {
          data: body ? JSON.parse(body) : null,
          error: null,
          status: res.status,
          notFound: false,
        };
      }

      ultimoStatus = res.status;
      ultimoError = `HTTP ${res.status}: ${body}`;

      if (res.status === 404) {
        return {
          data: null,
          error: null,
          status: res.status,
          notFound: true,
        };
      }

      if (
        (res.status === 429 || res.status >= 500) &&
        intento < MP_MAX_REINTENTOS
      ) {
        const espera = Math.min(
          esperaReintento(res, intento),
          presupuestoReintentos
        );
        if (espera <= 0) break;
        presupuestoReintentos -= espera;
        console.warn(
          `MercadoPago ${path} ${res.status}; reintento ${intento}/${MP_MAX_REINTENTOS} en ${Math.round(espera)}ms`
        );
        await esperar(espera);
        continue;
      }

      break;
    } catch (error) {
      ultimoStatus = 0;
      ultimoError = error.message;

      if (intento < MP_MAX_REINTENTOS) {
        const espera = Math.min(
          esperaReintento(null, intento),
          presupuestoReintentos
        );
        if (espera <= 0) break;
        presupuestoReintentos -= espera;
        console.warn(
          `Error MercadoPago ${path}: ${error.message}; reintento ${intento}/${MP_MAX_REINTENTOS} en ${Math.round(espera)}ms`
        );
        await esperar(espera);
        continue;
      }

      break;
    }
  }

  console.error(`MercadoPago ${path} falló: ${ultimoError}`);
  return {
    data: null,
    error: ultimoError || "Error de MercadoPago",
    status: ultimoStatus,
    notFound: false,
  };
}

export async function fetchMp(path) {
  const { data, error } = await fetchMpResult(path);
  if (error) return null;
  return data;
}

export async function fetchMpOrThrow(path) {
  const { data, error, notFound } = await fetchMpResult(path);
  if (error) throw new Error(error);
  if (notFound) return null;
  return data;
}

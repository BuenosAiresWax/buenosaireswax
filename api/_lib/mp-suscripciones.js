const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_API_URL = "https://api.mercadopago.com";
export const MP_PREAPPROVAL_PLAN_ID = "b9a00d38781c426a86372c2105819cf7";

export function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

export function normalizarNombre(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarDni(valor) {
  return String(valor || "").replace(/\D/g, "");
}

export function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function siguienteMes(fecha) {
  const iso = toIso(fecha);
  if (!iso) return null;
  const date = new Date(iso);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

export async function fetchMp(path) {
  if (!MP_ACCESS_TOKEN) return null;

  try {
    const res = await fetch(`${MP_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`MercadoPago ${path} returned ${res.status} ${body}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`Error fetching MercadoPago ${path}:`, e.message);
    return null;
  }
}

async function fetchMpResult(path) {
  try {
    const res = await fetch(`${MP_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const body = await res.text().catch(() => "");

    if (!res.ok) {
      console.error(`MercadoPago ${path} returned ${res.status} ${body}`);
      return { error: `HTTP ${res.status}: ${body}` };
    }

    return { data: body ? JSON.parse(body) : null };
  } catch (e) {
    console.error(`Error fetching MercadoPago ${path}:`, e.message);
    return { error: e.message };
  }
}

export async function obtenerFacturas(preapprovalId) {
  const facturas = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchMpResult(
      `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&offset=${offset}`
    );

    if (error) return { facturas, error };

    const pagina = data?.results || [];
    facturas.push(...pagina);

    const total = data?.paging?.total ?? facturas.length;
    offset += pagina.length;

    if (!pagina.length || offset >= total) break;
  }

  return { facturas, error: null };
}

export function facturaPagada(factura) {
  const pagoEstado = factura?.payment?.status;
  if (pagoEstado) {
    return ["approved", "authorized", "processed"].includes(pagoEstado);
  }
  if (factura?.status) {
    return ["approved", "authorized", "processed", "paid", "accredited"].includes(
      factura.status
    );
  }
  if (factura?._raw_payment?.status) {
    return ["approved", "authorized", "processed", "paid", "accredited"].includes(
      factura._raw_payment.status
    );
  }
  return false;
}

export function historialId(factura) {
  const paymentId = factura.payment?.id || factura?._raw_payment?.id || factura?.id;
  if (paymentId && String(paymentId).match(/^\d+$/)) {
    return `payment_${paymentId}`;
  }
  if (factura.payment?.id) {
    return `payment_${factura.payment.id}`;
  }
  if (factura?._raw_payment?.id) {
    return `payment_${factura._raw_payment.id}`;
  }
  return factura.id ? `authorized_${factura.id}` : null;
}

function fechaFactura(factura) {
  return (
    toIso(factura.debit_date) ||
    toIso(factura.date_approved) ||
    toIso(factura.date_created) ||
    toIso(factura?._raw_payment?.date_approved) ||
    toIso(factura?._raw_payment?.date_created)
  );
}

let cachePreapprovals = null;
let cachePreapprovalsAt = 0;

export async function obtenerTodasPreapprovals({ force = false } = {}) {
  const ahora = Date.now();
  if (
    !force &&
    cachePreapprovals &&
    ahora - cachePreapprovalsAt < 60000
  ) {
    return cachePreapprovals;
  }

  const resultados = [];
  let offset = 0;

  while (true) {
    const data = await fetchMp(
      `/preapproval/search?limit=50&offset=${offset}`
    );

    const pagina = data?.results || [];
    resultados.push(...pagina);

    const total = data?.paging?.total ?? resultados.length;
    offset += pagina.length;

    if (!pagina.length || offset >= total) break;
  }

  cachePreapprovals = resultados;
  cachePreapprovalsAt = Date.now();
  return resultados;
}

export function esDelClub(preapproval) {
  if (!preapproval) return false;
  if (preapproval.preapproval_plan_id === MP_PREAPPROVAL_PLAN_ID) return true;

  const texto = normalizarNombre(
    `${preapproval.reason || ""} ${preapproval.external_reference || ""}`
  );
  return (
    texto.includes("vinyl") ||
    texto.includes("bawax") ||
    texto.includes("club de vinilos")
  );
}

function prioridadEstado(status) {
  const prioridades = { authorized: 4, paused: 3, pending: 2, cancelled: 1 };
  return prioridades[status] || 0;
}

function tokensNombre(valor) {
  const normalizado = normalizarNombre(valor);
  return normalizado ? normalizado.split(" ").filter(Boolean) : [];
}

function nombreCoincide(a, b) {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = new Set(tokensNombre(a));
  const tb = new Set(tokensNombre(b));
  if (ta.size < 2 || tb.size < 2) return false;

  const [chico, grande] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  return [...chico].every((token) => grande.has(token));
}

async function obtenerPayer(preapproval) {
  let first = String(preapproval?.payer_first_name || "").trim();
  let last = String(preapproval?.payer_last_name || "").trim();
  let email = normalizarEmail(
    preapproval?.payer_email || preapproval?.external_reference
  );
  let dni = "";
  let telefono = "";

  const resultadoFacturas = await obtenerFacturas(preapproval.id);
  const facturas = resultadoFacturas.facturas || [];

  const ordenadas = [...facturas].sort((a, b) => {
    const fa = fechaFactura(a) || "";
    const fb = fechaFactura(b) || "";
    return fb.localeCompare(fa);
  });

  for (const factura of ordenadas) {
    const paymentId =
      factura?.payment?.id ||
      factura?._raw_payment?.id ||
      factura?.payment_id;

    if (!paymentId) continue;

    const payment = await fetchMp(`/v1/payments/${paymentId}`);
    const payer = payment?.payer;

    if (!payer) continue;

    if (!first) first = String(payer.first_name || "").trim();
    if (!last) last = String(payer.last_name || "").trim();
    if (!dni) dni = normalizarDni(payer.identification?.number);
    if (!telefono) {
      telefono = String(
        payer.phone?.number ||
          payment?.additional_info?.payer?.phone?.number ||
          ""
      ).trim();
    }
    if (!email) email = normalizarEmail(payer.email);

    if (first || last || dni) break;
  }

  if (!first && !last && preapproval?.payer_id) {
    const user = await fetchMp(`/users/${preapproval.payer_id}`);
    if (user) {
      first = String(user.first_name || "").trim();
      last = String(user.last_name || "").trim();
      dni = normalizarDni(user.identification?.number) || dni;
      telefono = String(user.phone?.number || "").trim() || telefono;
    }
  }

  return {
    email,
    nombre: `${first} ${last}`.replace(/\s+/g, " ").trim(),
    dni,
    telefono,
    facturas,
  };
}

async function cargarFichas(db) {
  const snapshot = await db.collection("clubvinilos").get();
  return snapshot.docs.map((doc) => ({
    ref: doc.ref,
    id: doc.id,
    data: doc.data() || {},
  }));
}

function buscarFicha(fichas, { email, dni, nombre, preapprovalId }) {
  const candidatos = new Map();

  const agregar = (ficha, motivo) => {
    if (!ficha) return;
    const actual = candidatos.get(ficha.id);
    if (actual) {
      actual.motivos.add(motivo);
    } else {
      candidatos.set(ficha.id, { ficha, motivos: new Set([motivo]) });
    }
  };

  if (preapprovalId) {
    for (const ficha of fichas) {
      if (ficha.data.mercadopago_preapproval_id === preapprovalId) {
        agregar(ficha, "preapproval");
      }
    }
  }

  if (email) {
    for (const ficha of fichas) {
      const emails = [
        normalizarEmail(ficha.id),
        normalizarEmail(ficha.data.correo),
        normalizarEmail(ficha.data.email),
        normalizarEmail(ficha.data.mercadopago_email),
      ];
      if (emails.includes(email)) agregar(ficha, "email");
    }
  }

  if (dni) {
    for (const ficha of fichas) {
      if (normalizarDni(ficha.data.dni) === dni) agregar(ficha, "dni");
    }
  }

  if (nombre) {
    const exacto = normalizarNombre(nombre);
    for (const ficha of fichas) {
      if (normalizarNombre(ficha.data.nombre) === exacto) {
        agregar(ficha, "nombre");
      }
    }
  }

  if (candidatos.size === 0 && nombre) {
    for (const ficha of fichas) {
      if (nombreCoincide(ficha.data.nombre, nombre)) {
        agregar(ficha, "nombre_aproximado");
      }
    }
  }

  const lista = [...candidatos.values()];

  if (lista.length === 1) {
    return {
      ficha: lista[0].ficha,
      motivo: [...lista[0].motivos].join("+"),
    };
  }

  if (lista.length > 1) {
    return {
      ficha: null,
      motivo: "ambiguo",
      candidatos: lista.map((item) => item.ficha.id),
    };
  }

  return { ficha: null, motivo: "no_existe" };
}

function nombreVacio(nombre) {
  const valor = String(nombre || "").trim();
  return (
    !valor ||
    valor === "Suscriptor MercadoPago" ||
    valor === "Sin nombre"
  );
}

export async function crearOActualizarFichaDesdePreapproval(
  db,
  preapproval,
  opciones = {}
) {
  if (!preapproval?.id) {
    return { accion: "omitido", motivo: "sin_preapproval" };
  }

  const payer = await obtenerPayer(preapproval);
  const estado = preapproval.status || "pending";
  const email =
    payer.email ||
    normalizarEmail(preapproval.payer_email) ||
    normalizarEmail(preapproval.external_reference);

  if (!email || !email.includes("@")) {
    return {
      accion: "omitido",
      motivo: "sin_email",
      preapprovalId: preapproval.id,
    };
  }

  if (!payer.nombre && opciones.requerirNombre) {
    return {
      accion: "omitido",
      motivo: "sin_nombre",
      preapprovalId: preapproval.id,
      email,
    };
  }

  const fichas = opciones.fichas || (await cargarFichas(db));
  const encontrada = buscarFicha(fichas, {
    email,
    dni: payer.dni,
    nombre: payer.nombre,
    preapprovalId: preapproval.id,
  });

  if (encontrada.motivo === "ambiguo") {
    return {
      accion: "conflicto",
      motivo: "ambiguo",
      preapprovalId: preapproval.id,
      email,
      candidatos: encontrada.candidatos,
    };
  }

  const ficha = encontrada.ficha;
  const existente = ficha?.data || {};
  const existenteId = existente.mercadopago_preapproval_id || null;

  if (existenteId && existenteId !== preapproval.id) {
    const prioridadExistente =
      existente.activo === true
        ? Math.max(4, prioridadEstado(existente.mercadopago_status))
        : prioridadEstado(existente.mercadopago_status);
    const prioridadNueva = prioridadEstado(estado);

    if (prioridadExistente >= prioridadNueva) {
      return {
        accion: "conflicto",
        motivo: "otro_preapproval",
        preapprovalId: preapproval.id,
        docId: ficha.id,
        email,
        existenteId,
        existenteStatus: existente.mercadopago_status || null,
      };
    }
  }

  const pagadas = payer.facturas.filter(facturaPagada);
  const fechas = pagadas.map(fechaFactura).filter(Boolean).sort();
  const fechaPrimerPago = fechas[0] || null;
  const fechaUltimoPago = fechas[fechas.length - 1] || null;
  const fechaProximoCobro =
    toIso(preapproval.next_payment_date) ||
    (fechaUltimoPago ? siguienteMes(fechaUltimoPago) : null);

  const updates = {
    mercadopago_preapproval_id: preapproval.id,
    mercadopago_status: estado,
    mercadopago_plan_id:
      preapproval.preapproval_plan_id || MP_PREAPPROVAL_PLAN_ID,
    mercadopago_email: email,
    actualizadoEn: new Date().toISOString(),
  };

  if (!existente.correo) updates.correo = email;
  if (nombreVacio(existente.nombre) && payer.nombre) updates.nombre = payer.nombre;
  if (!existente.dni && payer.dni) updates.dni = payer.dni;
  if (!existente.telefono && payer.telefono) updates.telefono = payer.telefono;

  if (fechaPrimerPago) updates.fechaPrimerPago = fechaPrimerPago;
  if (fechaUltimoPago) updates.fechaUltimoPago = fechaUltimoPago;
  if (fechaProximoCobro) updates.fechaProximoCobro = fechaProximoCobro;

  if (estado === "authorized") {
    updates.activo = true;
    updates.pendiente = false;
  } else if (estado === "cancelled") {
    updates.activo = false;
    updates.pendiente = false;
  } else if (estado === "paused" || estado === "pending") {
    updates.activo = false;
    updates.pendiente = true;
  }

  if (existenteId && existenteId !== preapproval.id) {
    updates.mercadopago_preapproval_id_anterior = existenteId;
    updates.mercadopago_status_anterior =
      existente.mercadopago_status || null;
  }

  let accion;
  let ref;

  if (ficha) {
    ref = ficha.ref;
    await ref.set(updates, { merge: true });
    ficha.data = { ...existente, ...updates };
    accion = "actualizado";
  } else {
    ref = db.collection("clubvinilos").doc(email);
    const nueva = {
      ...updates,
      nombre: payer.nombre || "Suscriptor MercadoPago",
      correo: email,
      instagram: "",
      direccion: "",
      departamento: "",
      ciudad: "",
      codigoPostal: "",
      preferencias: [],
      fechaAlta: toIso(preapproval.date_created) || new Date().toISOString(),
      origen: "mercadopago",
      importado_mercadopago: true,
    };
    await ref.set(nueva, { merge: true });
    fichas.push({ ref, id: ref.id, data: nueva });
    accion = "creado";
  }

  if (pagadas.length > 0) {
    const batch = db.batch();
    const historialRef = ref.collection("historialPagos");

    pagadas.forEach((factura) => {
      const fecha = fechaFactura(factura);
      const id = historialId(factura);
      if (!fecha || !id) return;

      const monto = Number(
        factura.transaction_amount ??
          factura?._raw_payment?.transaction_amount ??
          factura?._raw_payment?.transaction_details?.net_received_amount ??
          0
      );
      const estadoPago =
        factura.payment?.status ||
        factura.status ||
        factura?._raw_payment?.status ||
        "approved";
      const paymentId =
        factura.payment?.id || factura?._raw_payment?.id || null;
      const moneda =
        factura.currency_id || factura?._raw_payment?.currency_id || "ARS";

      batch.set(
        historialRef.doc(id),
        {
          fecha,
          estado: estadoPago,
          monto: Number.isFinite(monto) ? monto : 0,
          moneda,
          mercadopago_payment_id: paymentId,
          mercadopago_authorized_payment_id:
            factura.id && !String(factura.id).startsWith?.("payment_")
              ? factura.id
              : null,
          mercadopago_preapproval_id: preapproval.id,
          type: "payment",
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  return {
    accion,
    motivo: encontrada.motivo,
    preapprovalId: preapproval.id,
    docId: ref.id,
    email,
    nombre:
      updates.nombre || existente.nombre || payer.nombre || "",
    estado,
    pagos: pagadas.length,
  };
}

export async function importarPreapprovalsExternas(db, opciones = {}) {
  const offset = Math.max(0, Number(opciones.offset) || 0);
  const limit = Math.min(20, Math.max(1, Number(opciones.limit) || 5));
  const incluirPendientes = opciones.incluirPendientes === true;
  const incluirCancelados = opciones.incluirCancelados === true;

  const todas = await obtenerTodasPreapprovals();
  const estados = new Set(["authorized", "paused"]);
  if (incluirPendientes) estados.add("pending");
  if (incluirCancelados) estados.add("cancelled");

  const candidatos = todas.filter(
    (preapproval) =>
      preapproval?.id &&
      estados.has(preapproval.status) &&
      esDelClub(preapproval)
  );

  const fichas = await cargarFichas(db);
  const idsVinculados = new Set(
    fichas
      .map((ficha) => ficha.data.mercadopago_preapproval_id)
      .filter(Boolean)
  );

  const relevantes = candidatos.filter(
    (preapproval) => !idsVinculados.has(preapproval.id)
  );

  const lote = relevantes.slice(offset, offset + limit);
  const resultados = [];

  for (const preapproval of lote) {
    try {
      const resultado = await crearOActualizarFichaDesdePreapproval(
        db,
        preapproval,
        { fichas, requerirNombre: true }
      );
      resultados.push(resultado);
    } catch (error) {
      console.error(
        `Error importando preapproval ${preapproval.id}:`,
        error.message
      );
      resultados.push({
        accion: "error",
        preapprovalId: preapproval.id,
        motivo: error.message,
      });
    }
  }

  const resumen = {
    creados: 0,
    actualizados: 0,
    sinCambios: 0,
    conflictos: 0,
    omitidos: 0,
    errores: 0,
    pagos: 0,
  };

  for (const resultado of resultados) {
    if (resultado.accion === "creado") resumen.creados += 1;
    else if (resultado.accion === "actualizado") resumen.actualizados += 1;
    else if (resultado.accion === "sin_cambios") resumen.sinCambios += 1;
    else if (resultado.accion === "conflicto") resumen.conflictos += 1;
    else if (resultado.accion === "omitido") resumen.omitidos += 1;
    else if (resultado.accion === "error") resumen.errores += 1;
    resumen.pagos += resultado.pagos || 0;
  }

  const siguiente = offset + lote.length;

  return {
    totalPreapprovals: todas.length,
    totalCandidatos: candidatos.length,
    totalVinculados: candidatos.length - relevantes.length,
    totalRelevantes: relevantes.length,
    offset,
    limit,
    procesados: lote.length,
    nextOffset: siguiente < relevantes.length ? siguiente : null,
    ...resumen,
    resultados,
  };
}

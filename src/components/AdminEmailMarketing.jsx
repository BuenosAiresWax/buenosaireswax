import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  enviarEmailsMarketing,
  obtenerEstadoEmailMarketing,
} from "../utils/emailMarketing";
import "../styles/adminEmailMarketing.css";

const TIPOS_EMAIL = [
  { id: "bienvenida", label: "Bienvenida" },
];

const TIPO_LABELS = TIPOS_EMAIL.reduce((acc, tipo) => {
  acc[tipo.id] = tipo.label;
  return acc;
}, {});

const ESTADOS_ENVIO = {
  enviado: { label: "Enviado", color: "#22c55e" },
  error: { label: "Error", color: "#ef4444" },
};

const DISPAROS = {
  automatico: "Automático",
  webhook: "Webhook",
  sincronizacion: "Sincronización",
  importacion: "Importación",
  manual: "Manual",
  reenvio_manual: "Reenvío manual",
};

const FILTROS_BIENVENIDA = [
  { id: "pendientes", label: "Pendientes" },
  { id: "enviadas", label: "Enviadas" },
  { id: "errores", label: "Con error" },
  { id: "todas", label: "Todas" },
];

const ESTADOS_BIENVENIDA = {
  enviada: { id: "enviada", label: "Enviada", color: "#22c55e" },
  error: { id: "error", label: "Con error", color: "#ef4444" },
  proceso: { id: "proceso", label: "En proceso", color: "#eab308" },
  pendiente: { id: "pendiente", label: "Pendiente", color: "#f59e0b" },
  sinEmail: { id: "sin-email", label: "Sin email", color: "#6b7280" },
};

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function emailDeSuscriptor(s) {
  const candidatos = [s?.correo, s?.email, s?.mercadopago_email, s?.id];

  for (const candidato of candidatos) {
    const email = normalizarEmail(candidato);
    if (email.includes("@")) return email;
  }

  return null;
}

function aFecha(valor) {
  if (!valor) return null;

  if (typeof valor?.toDate === "function") {
    const fecha = valor.toDate();
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function fechaMs(valor) {
  const fecha = aFecha(valor);
  return fecha ? fecha.getTime() : 0;
}

function formatFechaHora(valor) {
  const fecha = aFecha(valor);
  if (!fecha) return "—";
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFecha(valor) {
  const fecha = aFecha(valor);
  if (!fecha) return "—";
  return fecha.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function prioridadSuscriptor(s) {
  if (s?.activo === true) return 3;
  if (s?.pendiente === true) return 2;
  if (s?.mercadopago_status === "paused") return 1;
  return 0;
}

function agruparSuscriptores(lista) {
  const porEmail = new Map();

  lista.forEach((s) => {
    if (!s || typeof s !== "object") return;
    const email = emailDeSuscriptor(s);
    if (!email) return;

    const actual = porEmail.get(email);
    if (!actual) {
      porEmail.set(email, s);
      return;
    }

    const prioridadActual = prioridadSuscriptor(actual);
    const prioridadNueva = prioridadSuscriptor(s);

    if (
      prioridadNueva > prioridadActual ||
      (prioridadNueva === prioridadActual &&
        fechaMs(s.fechaAlta) > fechaMs(actual.fechaAlta))
    ) {
      porEmail.set(email, s);
    }
  });

  return Array.from(porEmail.values());
}

function estadoBienvenida(s) {
  if (s?.bienvenidaEmailEnviadaEn) return ESTADOS_BIENVENIDA.enviada;
  if (s?.bienvenidaEmailEnProceso) return ESTADOS_BIENVENIDA.proceso;
  if (s?.bienvenidaEmailError) return ESTADOS_BIENVENIDA.error;
  return ESTADOS_BIENVENIDA.pendiente;
}

function cumpleFiltroBienvenida(s, filtro) {
  if (filtro === "todas") return true;
  const estado = estadoBienvenida(s).id;

  if (filtro === "pendientes") {
    return estado === "pendiente" || estado === "proceso";
  }

  if (filtro === "enviadas") return estado === "enviada";
  if (filtro === "errores") return estado === "error";
  return true;
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminEmailMarketing() {
  const [vista, setVista] = useState("registro");
  const [envios, setEnvios] = useState([]);
  const [cargandoEnvios, setCargandoEnvios] = useState(true);
  const [errorEnvios, setErrorEnvios] = useState(null);
  const [suscriptores, setSuscriptores] = useState([]);
  const [cargandoSuscriptores, setCargandoSuscriptores] = useState(true);
  const [errorSuscriptores, setErrorSuscriptores] = useState(null);
  const [config, setConfig] = useState(null);
  const [errorConfig, setErrorConfig] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busquedaRegistro, setBusquedaRegistro] = useState("");
  const [filtroBienvenida, setFiltroBienvenida] = useState("pendientes");
  const [busquedaBienvenida, setBusquedaBienvenida] = useState("");
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [enviando, setEnviando] = useState(false);
  const [progresoEnvio, setProgresoEnvio] = useState("");
  const [resultadoEnvio, setResultadoEnvio] = useState(null);
  const [mostrarGuia, setMostrarGuia] = useState(false);

  useEffect(() => {
    let activo = true;

    obtenerEstadoEmailMarketing()
      .then((data) => {
        if (activo) {
          setConfig(data);
          setErrorConfig(null);
        }
      })
      .catch((error) => {
        if (activo) {
          setErrorConfig(error.message);
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let unsub;

    try {
      const consulta = query(
        collection(db, "email_envios"),
        orderBy("creadoEn", "desc"),
        limit(500)
      );

      unsub = onSnapshot(
        consulta,
        (snap) => {
          setEnvios(
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }))
          );
          setCargandoEnvios(false);
          setErrorEnvios(null);
        },
        (error) => {
          console.error("Error cargando email_envios:", error);
          setErrorEnvios(
            "No se pudo cargar el registro de envíos. Verificá los permisos de Firestore para email_envios."
          );
          setCargandoEnvios(false);
        }
      );
    } catch (error) {
      console.error("Error inicializando email_envios:", error);
      setErrorEnvios("No se pudo conectar con el registro de envíos.");
      setCargandoEnvios(false);
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    let unsub;

    try {
      unsub = onSnapshot(
        collection(db, "clubvinilos"),
        (snap) => {
          setSuscriptores(
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }))
          );
          setCargandoSuscriptores(false);
          setErrorSuscriptores(null);
        },
        (error) => {
          console.error("Error cargando clubvinilos:", error);
          setErrorSuscriptores(
            "No se pudieron cargar los socios del Vinyl Club. Verificá los permisos de Firestore."
          );
          setCargandoSuscriptores(false);
        }
      );
    } catch (error) {
      console.error("Error inicializando clubvinilos:", error);
      setErrorSuscriptores("No se pudo conectar con los socios del Vinyl Club.");
      setCargandoSuscriptores(false);
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const suscriptoresUnicos = useMemo(
    () => agruparSuscriptores(suscriptores),
    [suscriptores]
  );

  const sociosActivos = useMemo(
    () =>
      suscriptoresUnicos.filter(
        (s) => s.activo === true && Boolean(emailDeSuscriptor(s))
      ),
    [suscriptoresUnicos]
  );

  const registros = useMemo(() => {
    const enviosBienvenida = envios.filter(
      (envio) => envio.tipo === "bienvenida"
    );
    const clavesConRegistro = new Set();

    enviosBienvenida.forEach((envio) => {
      if (envio.suscriptorId) clavesConRegistro.add(`id:${envio.suscriptorId}`);
      const email = normalizarEmail(envio.email);
      if (email) clavesConRegistro.add(`email:${email}`);
    });

    const legado = suscriptoresUnicos
      .filter((s) => {
        if (!s.bienvenidaEmailEnviadaEn) return false;
        const email = emailDeSuscriptor(s);
        return (
          !clavesConRegistro.has(`id:${s.id}`) &&
          !clavesConRegistro.has(`email:${email}`)
        );
      })
      .map((s) => ({
        id: `legado_${s.id}`,
        legado: true,
        tipo: "bienvenida",
        estado: "enviado",
        email: emailDeSuscriptor(s),
        nombre: s.nombre || "",
        suscriptorId: s.id,
        asunto: "Bienvenida al Club de Vinilos de BAWAX",
        resendId: s.bienvenidaEmailId || null,
        disparo: "automatico",
        creadoEn: s.bienvenidaEmailEnviadaEn,
      }));

    return [...envios, ...legado].sort(
      (a, b) => fechaMs(b.creadoEn) - fechaMs(a.creadoEn)
    );
  }, [envios, suscriptoresUnicos]);

  const registrosFiltrados = useMemo(() => {
    const q = busquedaRegistro.trim().toLowerCase();

    return registros.filter((registro) => {
      if (filtroTipo !== "todos" && registro.tipo !== filtroTipo) return false;
      if (filtroEstado !== "todos" && registro.estado !== filtroEstado) {
        return false;
      }

      if (!q) return true;

      return [
        registro.email,
        registro.nombre,
        registro.asunto,
        registro.resendId,
        registro.error,
        registro.actor,
      ]
        .map((valor) => String(valor || "").toLowerCase())
        .some((valor) => valor.includes(q));
    });
  }, [registros, filtroTipo, filtroEstado, busquedaRegistro]);

  const statsEnvios = useMemo(() => {
    const enviados = registros.filter((r) => r.estado === "enviado").length;
    const errores = registros.filter((r) => r.estado === "error").length;
    const desde = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const ultimosSiete = registros.filter(
      (r) => fechaMs(r.creadoEn) >= desde
    ).length;
    const totalConEstado = enviados + errores;

    return {
      total: registros.length,
      enviados,
      errores,
      ultimosSiete,
      tasa: totalConEstado
        ? Math.round((enviados / totalConEstado) * 100)
        : 0,
    };
  }, [registros]);

  const statsBienvenidas = useMemo(() => {
    let enviadas = 0;
    let errores = 0;
    let proceso = 0;
    let pendientes = 0;

    sociosActivos.forEach((s) => {
      const estado = estadoBienvenida(s).id;
      if (estado === "enviada") enviadas += 1;
      else if (estado === "error") errores += 1;
      else if (estado === "proceso") proceso += 1;
      else pendientes += 1;
    });

    return {
      activos: sociosActivos.length,
      enviadas,
      errores,
      proceso,
      pendientes,
    };
  }, [sociosActivos]);

  const sociosFiltrados = useMemo(() => {
    const q = busquedaBienvenida.trim().toLowerCase();

    return sociosActivos
      .filter((s) => cumpleFiltroBienvenida(s, filtroBienvenida))
      .filter((s) => {
        if (!q) return true;

        return [
          s.nombre,
          s.correo,
          s.email,
          s.mercadopago_email,
          s.instagram,
          s.dni,
        ]
          .map((valor) => String(valor || "").toLowerCase())
          .some((valor) => valor.includes(q));
      })
      .sort((a, b) => {
        const prioridades = { error: 0, pendiente: 1, proceso: 2, enviada: 3 };
        const diferencia =
          prioridades[estadoBienvenida(a).id] -
          prioridades[estadoBienvenida(b).id];
        if (diferencia !== 0) return diferencia;
        return String(a.nombre || "").localeCompare(String(b.nombre || ""));
      });
  }, [sociosActivos, filtroBienvenida, busquedaBienvenida]);

  const todosVisiblesSeleccionados =
    sociosFiltrados.length > 0 &&
    sociosFiltrados.every((s) => seleccionados.has(s.id));

  const puedeEnviar = config?.configurado === true && !enviando;

  const alternarSeleccion = (id) => {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const alternarTodosVisibles = () => {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);

      if (todosVisiblesSeleccionados) {
        sociosFiltrados.forEach((s) => siguiente.delete(s.id));
      } else {
        sociosFiltrados.forEach((s) => siguiente.add(s.id));
      }

      return siguiente;
    });
  };

  const ejecutarEnvio = async (ids, opciones = {}) => {
    const lista = Array.from(new Set(ids.filter(Boolean)));

    if (lista.length === 0) {
      setResultadoEnvio({
        tipo: "warning",
        mensaje: "No hay socios para enviar con los filtros actuales.",
        detalles: [],
      });
      return;
    }

    const confirmado = window.confirm(
      `Se enviarán ${lista.length} correo(s) de bienvenida con Resend${
        opciones.reenviar ? " (incluye reenvíos)" : ""
      }. ¿Continuar?`
    );

    if (!confirmado) return;

    setEnviando(true);
    setResultadoEnvio(null);
    setProgresoEnvio(`0/${lista.length}`);

    const totales = {
      procesados: 0,
      enviados: 0,
      omitidos: 0,
      errores: 0,
      detalles: [],
    };
    const tamanoLote = 5;

    try {
      for (let i = 0; i < lista.length; i += tamanoLote) {
        const lote = lista.slice(i, i + tamanoLote);

        try {
          const respuesta = await enviarEmailsMarketing({
            ids: lote,
            tipo: "bienvenida",
            reenviar: opciones.reenviar === true,
          });

          totales.procesados += respuesta.procesados || 0;
          totales.enviados += respuesta.enviados || 0;
          totales.omitidos += respuesta.omitidos || 0;
          totales.errores += respuesta.errores || 0;

          (respuesta.resultados || []).forEach((resultado) => {
            if (!resultado.enviado) {
              totales.detalles.push(
                `${resultado.email || resultado.suscriptorId}: ${
                  resultado.motivo || resultado.error || "sin detalle"
                }`
              );
            }
          });
        } catch (error) {
          totales.procesados += lote.length;
          totales.errores += lote.length;
          lote.forEach((id) => {
            totales.detalles.push(`${id}: ${error.message}`);
          });
        }

        setProgresoEnvio(
          `${Math.min(i + tamanoLote, lista.length)}/${lista.length}`
        );

        if (i + tamanoLote < lista.length) {
          await dormir(400);
        }
      }

      setResultadoEnvio({
        tipo: totales.errores > 0 ? "warning" : "success",
        mensaje: `Envío finalizado · Enviados: ${totales.enviados} · Omitidos: ${totales.omitidos} · Errores: ${totales.errores}`,
        detalles: totales.detalles,
      });
      setSeleccionados(new Set());
    } finally {
      setEnviando(false);
      setProgresoEnvio("");
    }
  };

  const enviarPendientes = () => {
    const ids = sociosActivos
      .filter((s) => estadoBienvenida(s).id === "pendiente")
      .map((s) => s.id);

    ejecutarEnvio(ids);
  };

  const reenviarErrores = () => {
    const ids = sociosActivos
      .filter((s) => estadoBienvenida(s).id === "error")
      .map((s) => s.id);

    ejecutarEnvio(ids);
  };

  const enviarSeleccionados = () => {
    const ids = Array.from(seleccionados);
    const hayEnviadas = sociosActivos.some(
      (s) => ids.includes(s.id) && Boolean(s.bienvenidaEmailEnviadaEn)
    );

    ejecutarEnvio(ids, { reenviar: hayEnviadas });
  };

  const enviarUno = (socio) => {
    ejecutarEnvio([socio.id], {
      reenviar: Boolean(socio.bienvenidaEmailEnviadaEn),
    });
  };

  return (
    <div className="em-container">
      <div className="em-header">
        <div>
          <h2 className="em-title">Email Marketing</h2>
          <p className="em-subtitle">
            Controlá los correos del Vinyl Club enviados con Resend.
          </p>
        </div>

        <div
          className={`em-provider ${
            config ? (config.configurado ? "is-ok" : "is-off") : "is-loading"
          }`}
        >
          <span className="em-provider-dot" aria-hidden="true" />
          <div className="em-provider-copy">
            <span className="em-provider-title">
              {config
                ? config.configurado
                  ? "Resend conectado"
                  : "Resend sin configurar"
                : "Verificando Resend..."}
            </span>
            <span className="em-provider-sub">
              {config?.fromEmail
                ? `Desde ${config.fromEmail}`
                : "Estado del proveedor"}
            </span>
          </div>
        </div>
      </div>

      {errorConfig && <div className="em-error">{errorConfig}</div>}

      {config && !config.configurado && (
        <div className="em-alert em-alert--warning">
          Falta configurar <strong>RESEND_API_KEY</strong> en las variables de
          entorno de Vercel. Los envíos quedarán bloqueados hasta que esté
          disponible.
        </div>
      )}

      <div className="em-tabs" role="tablist" aria-label="Email Marketing">
        <button
          type="button"
          role="tab"
          aria-selected={vista === "registro"}
          className={`em-tab ${vista === "registro" ? "is-active" : ""}`}
          onClick={() => setVista("registro")}
        >
          Registro de envíos
          <span className="em-tab-badge">{statsEnvios.total}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === "bienvenidas"}
          className={`em-tab ${vista === "bienvenidas" ? "is-active" : ""}`}
          onClick={() => setVista("bienvenidas")}
        >
          Bienvenidas
          <span className="em-tab-badge">{statsBienvenidas.pendientes}</span>
        </button>
      </div>

      {resultadoEnvio && (
        <div
          className={`em-result em-result--${resultadoEnvio.tipo}`}
          role="status"
        >
          <div className="em-result-title">{resultadoEnvio.mensaje}</div>
          {resultadoEnvio.detalles?.length > 0 && (
            <details className="em-result-details">
              <summary>Ver detalle</summary>
              <ul>
                {resultadoEnvio.detalles.slice(0, 12).map((detalle, index) => (
                  <li key={`${detalle}-${index}`}>{detalle}</li>
                ))}
                {resultadoEnvio.detalles.length > 12 && (
                  <li>
                    ... y {resultadoEnvio.detalles.length - 12} más
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}

      {vista === "registro" ? (
        <>
          <div className="em-stats">
            <div className="em-stat-card">
              <div className="em-stat-value">{statsEnvios.total}</div>
              <div className="em-stat-label">Envíos totales</div>
            </div>
            <div className="em-stat-card em-stat-card--ok">
              <div className="em-stat-value">{statsEnvios.enviados}</div>
              <div className="em-stat-label">Enviados</div>
            </div>
            <div className="em-stat-card em-stat-card--error">
              <div className="em-stat-value">{statsEnvios.errores}</div>
              <div className="em-stat-label">Con error</div>
            </div>
            <div className="em-stat-card em-stat-card--info">
              <div className="em-stat-value">{statsEnvios.ultimosSiete}</div>
              <div className="em-stat-label">Últimos 7 días</div>
            </div>
            <div className="em-stat-card em-stat-card--rate">
              <div className="em-stat-value">{statsEnvios.tasa}%</div>
              <div className="em-stat-label">Tasa de éxito</div>
            </div>
          </div>

          <section className="em-guide" aria-label="Guía de envíos">
            <button
              type="button"
              className="em-guide-toggle"
              onClick={() => setMostrarGuia((prev) => !prev)}
              aria-expanded={mostrarGuia}
              aria-controls="em-guide-body"
            >
              <span className="em-guide-heading">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                ¿Cómo funcionan los envíos?
              </span>
              <span
                className={`em-guide-chevron ${mostrarGuia ? "is-open" : ""}`}
                aria-hidden="true"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            {mostrarGuia && (
              <div className="em-guide-body" id="em-guide-body">
                <div className="em-guide-item">
                  <span
                    className="em-guide-dot"
                    style={{ background: "#22c55e" }}
                    aria-hidden="true"
                  />
                  <div>
                    <span className="em-guide-label">Enviado</span>
                    <p className="em-guide-desc">
                      Resend aceptó el correo y devolvió un identificador de
                      envío. Queda registrado con fecha, destinatario y origen.
                    </p>
                  </div>
                </div>
                <div className="em-guide-item">
                  <span
                    className="em-guide-dot"
                    style={{ background: "#ef4444" }}
                    aria-hidden="true"
                  />
                  <div>
                    <span className="em-guide-label">Con error</span>
                    <p className="em-guide-desc">
                      El envío falló. El motivo queda guardado en el registro y
                      también en la ficha del socio para poder reintentarlo.
                    </p>
                  </div>
                </div>
                <div className="em-guide-item">
                  <span
                    className="em-guide-dot"
                    style={{ background: "#f59e0b" }}
                    aria-hidden="true"
                  />
                  <div>
                    <span className="em-guide-label">Registro previo</span>
                    <p className="em-guide-desc">
                      Los envíos hechos antes de este panel se reconstruyen
                      desde la ficha del socio cuando no existe un registro
                      nuevo equivalente.
                    </p>
                  </div>
                </div>
                <p className="em-guide-note">
                  El registro de envíos se alimenta tanto de los envíos
                  automáticos de MercadoPago como de los envíos manuales que
                  hagas desde esta pantalla.
                </p>
              </div>
            )}
          </section>

          <div className="em-toolbar">
            <div className="em-filters" aria-label="Filtrar por tipo">
              <button
                type="button"
                className={`em-filter-btn ${
                  filtroTipo === "todos" ? "is-active" : ""
                }`}
                onClick={() => setFiltroTipo("todos")}
              >
                Todos
              </button>
              {TIPOS_EMAIL.map((tipo) => (
                <button
                  key={tipo.id}
                  type="button"
                  className={`em-filter-btn ${
                    filtroTipo === tipo.id ? "is-active" : ""
                  }`}
                  onClick={() => setFiltroTipo(tipo.id)}
                >
                  {tipo.label}
                </button>
              ))}
            </div>

            <div className="em-filters" aria-label="Filtrar por estado">
              <button
                type="button"
                className={`em-filter-btn ${
                  filtroEstado === "todos" ? "is-active" : ""
                }`}
                onClick={() => setFiltroEstado("todos")}
              >
                Todos
              </button>
              <button
                type="button"
                className={`em-filter-btn ${
                  filtroEstado === "enviado" ? "is-active" : ""
                }`}
                onClick={() => setFiltroEstado("enviado")}
              >
                Enviados
              </button>
              <button
                type="button"
                className={`em-filter-btn ${
                  filtroEstado === "error" ? "is-active" : ""
                }`}
                onClick={() => setFiltroEstado("error")}
              >
                Con error
              </button>
            </div>

            <input
              className="em-search"
              type="search"
              placeholder="Buscar por email, nombre, asunto o ID de Resend..."
              value={busquedaRegistro}
              onChange={(e) => setBusquedaRegistro(e.target.value)}
            />
          </div>

          <div className="em-list">
            {cargandoEnvios ? (
              <div className="em-loading">Cargando registro de envíos...</div>
            ) : errorEnvios ? (
              <div className="em-error">{errorEnvios}</div>
            ) : registrosFiltrados.length === 0 ? (
              <div className="em-empty">
                {registros.length === 0
                  ? "Todavía no hay envíos registrados. Los correos de bienvenida aparecerán acá automáticamente."
                  : "No hay envíos con estos filtros."}
              </div>
            ) : (
              registrosFiltrados.map((registro) => {
                const estado =
                  ESTADOS_ENVIO[registro.estado] || ESTADOS_ENVIO.enviado;

                return (
                  <article className="em-send-item" key={registro.id}>
                    <div className="em-send-top">
                      <span
                        className="em-status-badge"
                        style={{ background: estado.color }}
                      >
                        {estado.label}
                      </span>
                      <span className="em-type-badge">
                        {TIPO_LABELS[registro.tipo] || registro.tipo}
                      </span>
                      {registro.legado && (
                        <span className="em-legacy-badge">Registro previo</span>
                      )}
                      <span className="em-send-date">
                        {formatFechaHora(registro.creadoEn)}
                      </span>
                    </div>

                    <div className="em-send-name">
                      {registro.nombre || "Sin nombre"}
                    </div>
                    <div className="em-send-email">
                      {registro.email || "Sin email"}
                    </div>

                    <div className="em-send-meta">
                      <span>
                        Disparo:{" "}
                        {DISPAROS[registro.disparo] || registro.disparo || "—"}
                      </span>
                      {registro.asunto && (
                        <span>Asunto: {registro.asunto}</span>
                      )}
                      {registro.resendId && (
                        <span className="em-mono">
                          ID Resend: {registro.resendId}
                        </span>
                      )}
                      {registro.actor && (
                        <span>Por: {registro.actor}</span>
                      )}
                    </div>

                    {registro.error && (
                      <div className="em-send-error">{registro.error}</div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          {registros.length > 0 && (
            <p className="em-footnote">
              Mostrando los últimos {registros.length} registros de envío.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="em-stats">
            <div className="em-stat-card em-stat-card--info">
              <div className="em-stat-value">{statsBienvenidas.activos}</div>
              <div className="em-stat-label">Socios activos</div>
            </div>
            <div className="em-stat-card em-stat-card--ok">
              <div className="em-stat-value">{statsBienvenidas.enviadas}</div>
              <div className="em-stat-label">Bienvenidas enviadas</div>
            </div>
            <div className="em-stat-card em-stat-card--pending">
              <div className="em-stat-value">{statsBienvenidas.pendientes}</div>
              <div className="em-stat-label">Pendientes</div>
            </div>
            <div className="em-stat-card em-stat-card--error">
              <div className="em-stat-value">{statsBienvenidas.errores}</div>
              <div className="em-stat-label">Con error</div>
            </div>
            {statsBienvenidas.proceso > 0 && (
              <div className="em-stat-card em-stat-card--pending">
                <div className="em-stat-value">{statsBienvenidas.proceso}</div>
                <div className="em-stat-label">En proceso</div>
              </div>
            )}
          </div>

          <div className="em-alert em-alert--info">
            Solo se muestran socios activos con email. La bienvenida se envía
            una sola vez por socio; si ya fue enviada podés reenviarla
            manualmente.
          </div>

          <div className="em-toolbar">
            <div className="em-filters" aria-label="Filtrar bienvenidas">
              {FILTROS_BIENVENIDA.map((filtro) => (
                <button
                  key={filtro.id}
                  type="button"
                  className={`em-filter-btn ${
                    filtroBienvenida === filtro.id ? "is-active" : ""
                  }`}
                  onClick={() => setFiltroBienvenida(filtro.id)}
                >
                  {filtro.label}
                </button>
              ))}
            </div>

            <input
              className="em-search"
              type="search"
              placeholder="Buscar por nombre, email, Instagram o DNI..."
              value={busquedaBienvenida}
              onChange={(e) => setBusquedaBienvenida(e.target.value)}
            />
          </div>

          <div className="em-bulk-actions">
            <button
              type="button"
              className="em-action-btn em-action-btn--primary"
              onClick={enviarPendientes}
              disabled={
                !puedeEnviar ||
                statsBienvenidas.pendientes === 0 ||
                cargandoSuscriptores
              }
            >
              {enviando
                ? `Enviando ${progresoEnvio}`
                : `Enviar pendientes (${statsBienvenidas.pendientes})`}
            </button>
            <button
              type="button"
              className="em-action-btn"
              onClick={reenviarErrores}
              disabled={
                !puedeEnviar ||
                statsBienvenidas.errores === 0 ||
                cargandoSuscriptores
              }
            >
              Reintentar errores ({statsBienvenidas.errores})
            </button>
            <button
              type="button"
              className="em-action-btn"
              onClick={enviarSeleccionados}
              disabled={!puedeEnviar || seleccionados.size === 0}
            >
              Enviar seleccionados ({seleccionados.size})
            </button>
          </div>

          <div className="em-list">
            {cargandoSuscriptores ? (
              <div className="em-loading">Cargando socios...</div>
            ) : errorSuscriptores ? (
              <div className="em-error">{errorSuscriptores}</div>
            ) : sociosFiltrados.length === 0 ? (
              <div className="em-empty">
                {sociosActivos.length === 0
                  ? "No hay socios activos con email para enviar bienvenidas."
                  : "No hay socios con estos filtros."}
              </div>
            ) : (
              <>
                <label className="em-select-all">
                  <input
                    type="checkbox"
                    checked={todosVisiblesSeleccionados}
                    onChange={alternarTodosVisibles}
                  />
                  <span>
                    Seleccionar los {sociosFiltrados.length} visibles
                  </span>
                </label>

                {sociosFiltrados.map((socio) => {
                  const estado = estadoBienvenida(socio);
                  const email = emailDeSuscriptor(socio);
                  const seleccionado = seleccionados.has(socio.id);

                  return (
                    <div
                      className={`em-subscriber-row ${
                        seleccionado ? "is-selected" : ""
                      }`}
                      key={socio.id}
                    >
                      <input
                        className="em-checkbox"
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() => alternarSeleccion(socio.id)}
                        aria-label={`Seleccionar ${socio.nombre || email}`}
                      />

                      <div className="em-subscriber-info">
                        <div className="em-subscriber-name">
                          {socio.nombre || "Sin nombre"}
                        </div>
                        <div className="em-subscriber-meta">
                          {email} | @{socio.instagram || "sin ig"} | Alta:{" "}
                          {formatFecha(socio.fechaAlta)}
                        </div>
                        {estado.id === "enviada" && (
                          <div className="em-subscriber-note">
                            Enviada {formatFechaHora(socio.bienvenidaEmailEnviadaEn)}
                            {socio.bienvenidaEmailId
                              ? ` · ${socio.bienvenidaEmailId}`
                              : ""}
                          </div>
                        )}
                        {estado.id === "error" && (
                          <div className="em-subscriber-error">
                            {socio.bienvenidaEmailError}
                          </div>
                        )}
                      </div>

                      <span
                        className="em-status-badge em-status-badge--compact"
                        style={{ background: estado.color }}
                      >
                        {estado.label}
                      </span>

                      <button
                        type="button"
                        className="em-row-btn"
                        onClick={() => enviarUno(socio)}
                        disabled={!puedeEnviar || estado.id === "proceso"}
                      >
                        {estado.id === "enviada" ? "Reenviar" : "Enviar"}
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

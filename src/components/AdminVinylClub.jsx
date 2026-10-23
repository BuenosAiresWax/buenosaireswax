import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import * as XLSX from "xlsx";
import "../styles/adminVinylClub.css";

const CATEGORIAS_LABELS = {
  house: "House",
  techno: "Techno",
  deep: "Deep",
};

const STATUS_LABELS = {
  authorized: "Activa",
  paused: "Pausada",
  cancelled: "Cancelada",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function esActivo(s) {
  return s?.activo === true;
}

function esCancelado(s) {
  return !esActivo(s) && s?.mercadopago_status === "cancelled";
}

function esPendiente(s) {
  return s?.pendiente === true && !esActivo(s) && !esCancelado(s);
}

function esAbandonado(s) {
  return (
    !esActivo(s) &&
    !esCancelado(s) &&
    !esPendiente(s) &&
    s?.mercadopago_status === "pending"
  );
}

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function normalizarDni(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function getEstado(s) {
  if (esActivo(s)) return { label: "Activo", color: "#22c55e" };
  if (esCancelado(s)) return { label: "Cancelado", color: "#ef4444" };
  if (esPendiente(s)) {
    if (s?.mercadopago_status === "paused") {
      return { label: "Pausado", color: "#eab308" };
    }
    return { label: "Pendiente", color: "#eab308" };
  }
  if (esAbandonado(s)) return { label: "Abandonado", color: "#f97316" };
  return { label: "Inactivo", color: "#666" };
}

function prioridadSuscriptor(s) {
  if (esActivo(s)) return 4;
  if (esPendiente(s)) return 3;
  if (s?.mercadopago_status === "paused") return 2;
  if (esCancelado(s)) return 1;
  return 0;
}

function fechaAltaMs(s) {
  const t = new Date(s?.fechaAlta || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function esMejorCandidato(candidato, actual) {
  const prioridadCandidato = prioridadSuscriptor(candidato);
  const prioridadActual = prioridadSuscriptor(actual);
  if (prioridadCandidato !== prioridadActual) {
    return prioridadCandidato > prioridadActual;
  }
  return fechaAltaMs(candidato) > fechaAltaMs(actual);
}

function claveSuscriptor(s) {
  const dni = normalizarDni(s?.dni);
  if (dni) return `dni:${dni}`;
  const email = normalizarEmail(s?.correo || s?.id);
  if (email) return `email:${email}`;
  return `id:${s?.id}`;
}

export default function AdminVinylClub() {
  const [suscriptores, setSuscriptores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [mostrarMenuDescarga, setMostrarMenuDescarga] = useState(false);
  const menuDescargaRef = useRef(null);

  useEffect(() => {
    let unsub;
    try {
      unsub = onSnapshot(
        collection(db, "clubvinilos"),
        (snap) => {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setSuscriptores(docs);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("Error fetching clubvinilos:", err);
          setError("No se pudo cargar la colección. Verificá los permisos de Firestore.");
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Error subscribing to clubvinilos:", err);
      setError("Error al conectar con Firestore.");
      setLoading(false);
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuDescargaRef.current && !menuDescargaRef.current.contains(e.target)) {
        setMostrarMenuDescarga(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suscriptoresUnicos = (() => {
    const porIdentidad = new Map();
    suscriptores.forEach((s) => {
      if (!s || typeof s !== "object") return;
      const clave = claveSuscriptor(s);
      const actual = porIdentidad.get(clave);
      if (!actual || esMejorCandidato(s, actual)) {
        porIdentidad.set(clave, s);
      }
    });
    return Array.from(porIdentidad.values());
  })();

  const activos = suscriptoresUnicos.filter(esActivo);
  const cancelados = suscriptoresUnicos.filter(esCancelado);
  const pendientes = suscriptoresUnicos.filter(esPendiente);
  const abandonados = suscriptoresUnicos.filter(esAbandonado);
  const idsPendientes = new Set(pendientes.map((s) => s.id));
  const idsAbandonados = new Set(abandonados.map((s) => s.id));

  const suscriptoresFiltrados = suscriptoresUnicos.filter((s) => {
    if (!s || typeof s !== "object") return false;

    if (filtro === "activos" && !esActivo(s)) return false;
    if (filtro === "cancelados" && !esCancelado(s)) return false;
    if (filtro === "pendientes" && !idsPendientes.has(s.id)) return false;
    if (filtro === "abandonados" && !idsAbandonados.has(s.id)) return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const nombre = s.nombre || "";
      const correo = s.correo || "";
      const instagram = s.instagram || "";
      const dni = s.dni || "";
      return (
        nombre.toLowerCase().includes(q) ||
        correo.toLowerCase().includes(q) ||
        instagram.toLowerCase().includes(q) ||
        dni.includes(q)
      );
    }

    return true;
  });

  const stats = {
    total: suscriptoresUnicos.length,
    activos: activos.length,
    cancelados: cancelados.length,
    pendientes: pendientes.length,
    abandonados: abandonados.length,
    ingresos: activos.length * 70000,
  };

  const construirFilasExcel = (lista) => {
    return lista.map((s, i) => ({
      "#": i + 1,
      Nombre: s.nombre || "",
      Email: s.correo || "",
      Instagram: s.instagram || "",
      DNI: s.dni || "",
      Telefono: s.telefono || "",
      Direccion: s.direccion || "",
      Departamento: s.departamento || "",
      Ciudad: s.ciudad || "",
      "Codigo Postal": s.codigoPostal || "",
      Preferencias: Array.isArray(s.preferencias)
        ? s.preferencias.map((p) => CATEGORIAS_LABELS[p] || p).join(", ")
        : "",
      Estado: esActivo(s)
        ? "Activo"
        : esCancelado(s)
          ? "Cancelado"
          : esPendiente(s)
            ? "Pendiente"
            : esAbandonado(s)
              ? "Abandonado"
              : "Inactivo",
      "MP Status": STATUS_LABELS[s.mercadopago_status] || s.mercadopago_status || "Sin estado",
      "Fecha Alta": formatDate(s.fechaAlta),
      "Primer Pago": formatDate(s.fechaPrimerPago),
      "Ultimo Pago": formatDate(s.fechaUltimoPago),
      "Proximo Cobro": formatDate(s.fechaProximoCobro),
      "MP Preapproval ID": s.mercadopago_preapproval_id || "",
    }));
  };

  const exportarExcel = (lista, nombreBase) => {
    if (!lista.length) {
      alert("No hay suscriptores para descargar con el filtro actual.");
      return;
    }
    const filas = construirFilasExcel(lista);
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suscriptores");

    const fecha = new Date();
    const stamp = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    XLSX.writeFile(wb, `${nombreBase}-${stamp}.xlsx`);
    setMostrarMenuDescarga(false);
  };

  const handleDescargarExcel = (tipo) => {
    if (tipo === "todos") exportarExcel(suscriptoresUnicos, "vinyl-club-todos");
    if (tipo === "activos") exportarExcel(activos, "vinyl-club-activos");
    if (tipo === "pendientes") exportarExcel(pendientes, "vinyl-club-pendientes");
    if (tipo === "abandonados") exportarExcel(abandonados, "vinyl-club-abandonados");
    if (tipo === "cancelados") exportarExcel(cancelados, "vinyl-club-cancelados");
  };

  if (loading) {
    return (
      <div className="vc-admin-container">
        <p className="vc-admin-loading">Cargando suscriptores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vc-admin-container">
        <h2 className="vc-admin-title">Vinyl Club - Suscriptores</h2>
        <div className="vc-admin-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="vc-admin-container">
      <h2 className="vc-admin-title">Vinyl Club - Suscriptores</h2>

      <div className="vc-admin-stats">
        <div className="vc-admin-stat-card">
          <div className="vc-admin-stat-value">{stats.total}</div>
          <div className="vc-admin-stat-label">Total</div>
        </div>
        <div className="vc-admin-stat-card vc-admin-stat-active">
          <div className="vc-admin-stat-value">{stats.activos}</div>
          <div className="vc-admin-stat-label">Activos</div>
        </div>
        <div className="vc-admin-stat-card vc-admin-stat-pending">
          <div className="vc-admin-stat-value">{stats.pendientes}</div>
          <div className="vc-admin-stat-label">Pendientes</div>
        </div>
        <div className="vc-admin-stat-card vc-admin-stat-abandoned">
          <div className="vc-admin-stat-value">{stats.abandonados}</div>
          <div className="vc-admin-stat-label">Abandonados</div>
        </div>
        <div className="vc-admin-stat-card vc-admin-stat-cancelled">
          <div className="vc-admin-stat-value">{stats.cancelados}</div>
          <div className="vc-admin-stat-label">Cancelados</div>
        </div>
        <div className="vc-admin-stat-card vc-admin-stat-revenue">
          <div className="vc-admin-stat-value">
            ${stats.ingresos.toLocaleString("es-AR")}
          </div>
          <div className="vc-admin-stat-label">Ingresos mensuales (est.)</div>
        </div>
      </div>

      <div className="vc-admin-controls">
        <div className="vc-admin-filters">
          {["todos", "activos", "pendientes", "abandonados", "cancelados"].map((f) => (
            <button
              key={f}
              className={`vc-admin-filter-btn ${filtro === f ? "active" : ""}`}
              onClick={() => setFiltro(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="vc-admin-search-wrap">
          <input
            className="vc-admin-search"
            type="text"
            placeholder="Buscar por nombre, email, Instagram o DNI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="vc-admin-download-wrap" ref={menuDescargaRef}>
            <button
              className="vc-admin-download-btn"
              title="Descargar Excel"
              onClick={() => setMostrarMenuDescarga((prev) => !prev)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {mostrarMenuDescarga && (
              <div className="vc-admin-download-menu">
                <button onClick={() => handleDescargarExcel("todos")}>Todos</button>
                <button onClick={() => handleDescargarExcel("activos")}>Activos</button>
                <button onClick={() => handleDescargarExcel("pendientes")}>Pendientes</button>
                <button onClick={() => handleDescargarExcel("abandonados")}>Abandonados</button>
                <button onClick={() => handleDescargarExcel("cancelados")}>Cancelados</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="vc-admin-list">
        {suscriptoresFiltrados.length === 0 ? (
          <div className="vc-admin-empty">
            {suscriptoresUnicos.length === 0
              ? "No hay suscriptores todavía. La colección clubvinilos está vacía."
              : "No hay suscriptores con estos filtros."}
          </div>
        ) : (
          suscriptoresFiltrados.map((s) => {
            const estado = getEstado(s);
            return (
              <div
                key={s.id}
                className={`vc-admin-row ${expandido === s.id ? "expanded" : ""}`}
              >
                <div
                  className="vc-admin-row-header"
                  onClick={() => setExpandido(expandido === s.id ? null : s.id)}
                >
                  <div className="vc-admin-row-left">
                    <div className="vc-admin-row-name">{s.nombre || "Sin nombre"}</div>
                    <div className="vc-admin-row-meta">
                      {s.correo || "—"} | @{s.instagram || "sin ig"} | DNI: {s.dni || "—"}
                    </div>
                  </div>
                  <div className="vc-admin-row-right">
                    <span
                      className="vc-admin-status-badge"
                      style={{ background: estado.color }}
                    >
                      {estado.label}
                    </span>
                    <span className="vc-admin-expand-icon">
                      {expandido === s.id ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {expandido === s.id && (
                  <div className="vc-admin-row-detail">
                    <div className="vc-admin-detail-grid">
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">Teléfono</span>
                        <span>{s.telefono || "—"}</span>
                      </div>
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">Dirección</span>
                        <span>
                          {s.direccion || "—"}
                          {s.departamento ? `, ${s.departamento}` : ""}
                          {s.ciudad ? `, ${s.ciudad}` : ""}
                          {s.codigoPostal ? ` (${s.codigoPostal})` : ""}
                        </span>
                      </div>
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">Preferencias</span>
                        <span>
                          {Array.isArray(s.preferencias) && s.preferencias.length > 0
                            ? s.preferencias.map((p) => CATEGORIAS_LABELS[p] || p).join(", ")
                            : "—"}
                        </span>
                      </div>
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">Fecha alta</span>
                        <span>{formatDate(s.fechaAlta)}</span>
                      </div>
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">Primer pago</span>
                        <span>{formatDate(s.fechaPrimerPago)}</span>
                      </div>
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">Último pago</span>
                        <span>{formatDate(s.fechaUltimoPago)}</span>
                      </div>
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">Próximo cobro</span>
                        <span>{formatDate(s.fechaProximoCobro)}</span>
                      </div>
                      <div className="vc-admin-detail-item">
                        <span className="vc-admin-detail-label">ID MercadoPago</span>
                        <span className="vc-admin-mp-id">
                          {s.mercadopago_preapproval_id || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

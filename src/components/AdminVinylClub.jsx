import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/adminVinylClub.css";

const CATEGORIAS_LABELS = {
  house: "House",
  techno: "Techno",
  deep: "Deep",
};

const STATUS_COLORS = {
  authorized: "#22c55e",
  paused: "#eab308",
  cancelled: "#ef4444",
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

export default function AdminVinylClub() {
  const [suscriptores, setSuscriptores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [expandido, setExpandido] = useState(null);

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

  const suscriptoresFiltrados = suscriptores.filter((s) => {
    if (!s || typeof s !== "object") return false;

    if (filtro === "activos" && !s.activo) return false;
    if (filtro === "cancelados" && s.mercadopago_status !== "cancelled") return false;
    if (filtro === "pendientes" && !s.pendiente) return false;

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
    total: suscriptores.length,
    activos: suscriptores.filter((s) => s?.activo).length,
    cancelados: suscriptores.filter((s) => s?.mercadopago_status === "cancelled").length,
    pendientes: suscriptores.filter((s) => s?.pendiente).length,
    ingresos: suscriptores.filter((s) => s?.activo).length * 100,
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
          {["todos", "activos", "pendientes", "cancelados"].map((f) => (
            <button
              key={f}
              className={`vc-admin-filter-btn ${filtro === f ? "active" : ""}`}
              onClick={() => setFiltro(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          className="vc-admin-search"
          type="text"
          placeholder="Buscar por nombre, email, Instagram o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="vc-admin-list">
        {suscriptoresFiltrados.length === 0 ? (
          <div className="vc-admin-empty">
            {suscriptores.length === 0
              ? "No hay suscriptores todavía. La colección clubvinilos está vacía."
              : "No hay suscriptores con estos filtros."}
          </div>
        ) : (
          suscriptoresFiltrados.map((s) => (
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
                    style={{
                      background: STATUS_COLORS[s.mercadopago_status] || "#666",
                    }}
                  >
                    {STATUS_LABELS[s.mercadopago_status] || s.mercadopago_status || "Pendiente"}
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
          ))
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useAdminData } from "../context/AdminDataContext";

import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    BarChart, Bar, ResponsiveContainer
} from "recharts";

import "../styles/adminOverview.css";

/* ------- Meses para parseo si necesitás parsear strings tipo "12 de marzo de 2025..." ------- */
const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

/* ------- Reutilizable: convierte distintos formatos de fecha a Date ------- */
function parseFechaDesdeString(fechaStr) {
    // tu formato original: "12 de marzo de 2025, 3:25 p. m." o similar
    if (!fechaStr || typeof fechaStr !== "string") return new Date(0);
    try {
        const [diaMes, tiempo] = fechaStr.split(", ");
        const [dia, , mes, , año] = diaMes.split(" ");
        let [hora, min] = tiempo.split(":");
        let pm = false;

        if (min.includes("p. m.")) {
            pm = true;
            min = min.replace(" p. m.", "");
        } else {
            min = min.replace(" a. m.", "");
        }

        hora = parseInt(hora);
        min = parseInt(min);

        if (pm && hora < 12) hora += 12;
        if (!pm && hora === 12) hora = 0;

        return new Date(parseInt(año), meses[mes.toLowerCase()] ?? 0, parseInt(dia), hora, min);
    } catch (e) {
        // fallback: intentar Date constructor
        const d = new Date(fechaStr);
        return isNaN(d) ? new Date(0) : d;
    }
}

/* ------- Normaliza cualquier campo `fecha` a un objeto Date llamado `fechaObj` ------- */
function normalizarFecha(campoFecha) {
    if (!campoFecha) return new Date(0);

    // Firestore Timestamp (tiene toDate)
    if (typeof campoFecha === "object" && typeof campoFecha.toDate === "function") {
        return campoFecha.toDate();
    }

    // Si ya es Date
    if (campoFecha instanceof Date) return campoFecha;

    // Si viene como número (timestamp ms)
    if (typeof campoFecha === "number") return new Date(campoFecha);

    // Si viene como string -> usar parse
    if (typeof campoFecha === "string") {
        const parsed = parseFechaDesdeString(campoFecha);
        if (parsed instanceof Date && !isNaN(parsed)) return parsed;
    }

    // Ultimo recurso: Date constructor
    const d = new Date(campoFecha);
    if (!isNaN(d)) return d;

    // fallback
    return new Date(0);
}

/* ------- Helper: agrupar pedidos por clave año-mes "YYYY-MM" ------- */
function agruparPorMes(pedidos) {
    const grupos = {};
    pedidos.forEach(p => {
        const y = p.fechaObj.getFullYear();
        const m = p.fechaObj.getMonth() + 1;
        const key = `${y}-${String(m).padStart(2, "0")}`;
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(p);
    });
    return grupos;
}

const FUENTES = [
    { value: "dropActual", label: "Drop Actual" },
    { value: "tienda", label: "Tienda Física" },
    { value: "equipamiento", label: "Equipamiento" },
];

export default function AdminOverview() {
    const { pedidos, pedidosTienda, pedidosEquipamiento, loading } = useAdminData();

    const [fuenteSeleccionada, setFuenteSeleccionada] = useState("dropActual");
    const [mesesOrdenados, setMesesOrdenados] = useState([]);
    const [mesSeleccionado, setMesSeleccionado] = useState("ultimoMes");
    const [mostrarTodos, setMostrarTodos] = useState(false);

    // Seleccionar el array correcto según la fuente
    const pedidosTodos = useMemo(() => {
        if (fuenteSeleccionada === "tienda") return pedidosTienda;
        if (fuenteSeleccionada === "equipamiento") return pedidosEquipamiento;
        return pedidos;
    }, [fuenteSeleccionada, pedidos, pedidosTienda, pedidosEquipamiento]);

    useEffect(() => {
        // Resetear mes al cambiar fuente
        setMesSeleccionado("ultimoMes");
        setMesesOrdenados([]);
    }, [fuenteSeleccionada]);

    useEffect(() => {
        if (!pedidosTodos || pedidosTodos.length === 0) {
            setMesesOrdenados([]);
            return;
        }

        const grupos = agruparPorMes(pedidosTodos);
        const keysOrdenadas = Object.keys(grupos).sort((a, b) =>
            b.localeCompare(a)
        );

        setMesesOrdenados(keysOrdenadas);
        setMesSeleccionado("ultimoMes");
    }, [pedidosTodos]);


    if (loading) {
        return (
            <div className="ao-container">
                <div className="ao-loading">Cargando overview...</div>
            </div>
        );
    }

    // ------------------------------------------------
    // Filtrado según selección: "general" o "ultimoMes" o clave "YYYY-MM"
    // ------------------------------------------------
    const obtenerPedidosFiltrados = () => {
        if (mesSeleccionado === "general") return pedidosTodos;

        if (mesSeleccionado === "ultimoMes") {
            // si existen mesesOrdenados, tomo la primera (ya ordenadas por fecha desc)
            if (mesesOrdenados.length === 0) return [];
            const key = mesesOrdenados[0];
            // devolver grupo
            const grupos = agruparPorMes(pedidosTodos);
            return grupos[key] || [];
        }

        // si el valor ya es una clave "YYYY-MM"
        if (mesesOrdenados.includes(mesSeleccionado)) {
            const grupos = agruparPorMes(pedidosTodos);
            return grupos[mesSeleccionado] || [];
        }

        // fallback
        return pedidosTodos;
    };

    const pedidosFiltrados = obtenerPedidosFiltrados();

    // -------------------------
    // Filtrar pedidos NO cancelados para cálculos
    // -------------------------
    const pedidosActivos = pedidosFiltrados.filter(p => !p.cancelado);

    // -------------------------
    // Cálculos principales
    // -------------------------
    const totalVendido = pedidosActivos.reduce((acc, p) => acc + (Number(p.total || 0)), 0);
    const cantidadPedidos = pedidosActivos.length;
    const ticketPromedio = cantidadPedidos ? (totalVendido / cantidadPedidos) : 0;

    // -------------------------
    // Ventas por día (para gráfico lineal)
    // -------------------------
    const ventasPorDiaMap = {};
    pedidosActivos.forEach(p => {
        const d = p.fechaObj.getDate(); // ahora seguro es Date
        // usamos día como string para el eje x (p. ej. '1','2'..)
        const key = String(d).padStart(2, "0");
        ventasPorDiaMap[key] = (ventasPorDiaMap[key] || 0) + Number(p.total || 0);
    });

    // ordenar por día del mes ascendente
    const dataLineal = Object.keys(ventasPorDiaMap)
        .sort((a, b) => Number(a) - Number(b))
        .map(d => ({ dia: d, total: ventasPorDiaMap[d] }));

    // -------------------------
    // Productos más vendidos (soporta `productos` o `items`)
    // -------------------------
    const productosConteo = {};
    pedidosActivos.forEach(p => {
        const lista = p.productos ?? p.items ?? p.itemsList ?? [];
        (Array.isArray(lista) ? lista : []).forEach(item => {
            // manejar distintos nombres de campo
            const nombre = item.titulo ?? item.nombre ?? item.name ?? item.producto ?? "Sin título";
            const cantidad = Number(item.cantidad ?? item.qty ?? item.cantidadProducto ?? 0);
            productosConteo[nombre] = (productosConteo[nombre] || 0) + cantidad;
        });
    });

    const dataProductos = Object.keys(productosConteo)
        .map(nombre => ({ nombre, ventas: productosConteo[nombre] }))
        .sort((a, b) => b.ventas - a.ventas);

    // -------------------------
    // Preparar opciones de selector (meses)
    // -------------------------
    const opcionesMeses = ["general", "ultimoMes", ...mesesOrdenados];
    // -------------------------
    // Render
    // -------------------------
    return (
        <div className="ao-container">
            <div className="ao-header">
                <h2 className="ao-title">Overview - Pedidos</h2>

                <div className="ao-controls">
                    <div className="ao-source-tabs">
                        {FUENTES.map(f => (
                            <button
                                key={f.value}
                                className={`ao-source-tab ${fuenteSeleccionada === f.value ? "ao-source-tab--active" : ""}`}
                                onClick={() => setFuenteSeleccionada(f.value)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <label className="ao-label">Periodo</label>
                        <select
                            className="ao-select"
                            value={mesSeleccionado}
                            onChange={(e) => setMesSeleccionado(e.target.value)}
                        >
                            <option value="ultimoMes">Último mes</option>
                            <option value="general">General</option>
                            {mesesOrdenados.map(key => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="ao-cards">
                <div className="ao-card">
                    <div className="ao-card-title">Total vendido</div>
                    <div className="ao-card-value">${totalVendido.toLocaleString()}</div>
                    <div className="ao-card-sub">Pedidos: {cantidadPedidos}</div>
                </div>

                <div className="ao-card">
                    <div className="ao-card-title">Ticket promedio</div>
                    <div className="ao-card-value">${Math.round(ticketPromedio).toLocaleString()}</div>
                    <div className="ao-card-sub">Por pedido</div>
                </div>

                <div className="ao-card">
                    <div className="ao-card-title">Pedidos</div>
                    <div className="ao-card-value">{cantidadPedidos}</div>
                    <div className="ao-card-sub">Totales en periodo</div>
                </div>

                <div className="ao-card">
                    <div className="ao-card-title">Top producto</div>
                    <div className="ao-card-value">{dataProductos[0]?.nombre || "-"}</div>
                    <div className="ao-card-sub">{dataProductos[0] ? `${dataProductos[0].ventas} uds` : ""}</div>
                </div>
            </div>

            <div className="ao-charts-row">

                {/* ------------------------------------------------------ */}
                {/* ------------------- VENTAS POR DÍA ------------------- */}
                {/* ------------------------------------------------------ */}

                <div className="ao-chart-card">
                    <div className="ao-chart-title">Ventas por día</div>
                    <div className="ao-chart-wrapper">
                        {dataLineal.length === 0 ? (
                            <div className="ao-empty">No hay datos para este periodo</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={dataLineal}>
                                    <CartesianGrid stroke="#9d9c9cff" strokeDasharray="4 4" />
                                    <XAxis dataKey="dia" tick={{ fill: "#cfcfcf" }} />
                                    <YAxis tick={{ fill: "#cfcfcf" }} />
                                    <Tooltip wrapperStyle={{ background: "#222", border: "none" }} />
                                    <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* 📈 ESTADÍSTICA DEL DÍA MÁS VENDIDO */}
                    {dataLineal.length > 0 && (() => {
                        const diaMasVendido = dataLineal.reduce((max, item) =>
                            item.total > max.total ? item : max
                            , { dia: dataLineal[0].dia, total: dataLineal[0].total });
                        return (
                            <div className="ao-chart-info">
                                📈 <strong>Día con más ventas:</strong> {diaMasVendido.dia} (${diaMasVendido.total} )
                            </div>
                        );
                    })()}
                </div>

                {/* ------------------------------------------------------ */}
                {/* ------------- PRODUCTOS MÁS VENDIDOS ---------------- */}
                {/* ------------------------------------------------------ */}

                <div className="ao-chart-card">
                    <div className="ao-chart-title">Productos más vendidos</div>
                    <div className="ao-chart-wrapper">
                        {dataProductos.length === 0 ? (
                            <div className="ao-empty">No hay datos para este periodo</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={dataProductos.slice(0, 10)} barCategoryGap="30%">
                                    <CartesianGrid stroke="#9d9c9cff" strokeDasharray="4 4" />
                                    <XAxis dataKey="nombre" tick={false} />
                                    <YAxis tick={{ fill: "#9e9e9eff" }} />
                                    <Tooltip
                                        contentStyle={{ background: "#9d9c9cff", border: "1px solid #9d9c9cff", borderRadius: "6px" }}
                                        labelStyle={{ color: "#e7e7e7ff" }}
                                        itemStyle={{ color: "#e7e7e7ff" }}
                                        formatter={(value) => [value]}
                                    />
                                    <Bar dataKey="ventas" className="ao-bar-producto" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* 💿 ESTADÍSTICA DEL PRODUCTO MÁS VENDIDO */}
                    {dataProductos.length > 0 && (() => {
                        const productoTop = dataProductos.reduce((max, item) =>
                            item.ventas > max.ventas ? item : max
                            , { nombre: dataProductos[0].nombre, ventas: dataProductos[0].ventas });
                        return (
                            <div className="ao-chart-info">
                                💿 <strong>Producto más vendido:</strong> {productoTop.nombre} (vendidos: {productoTop.ventas} u)
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Lista compacta de pedidos del periodo (resumen) */}
            <div className="ao-list-card">
                <div className="ao-list-title">
                    Pedidos del periodo ({cantidadPedidos})
                </div>

                <div className="ao-list-rows">
                    {pedidosFiltrados.length === 0 ? (
                        <div className="ao-empty">No hay pedidos en este periodo</div>
                    ) : (
                        (mostrarTodos ? pedidosFiltrados : pedidosFiltrados.slice(0, 10)).map(p => (
                            <div key={p.id} className="ao-list-row">
                                <div className="ao-row-left">
                                    <div className="ao-row-name">
                                        {p.cliente || p.nombre || "Cliente sin nombre"}
                                    </div>

                                    {/* email SIN método de envío */}
                                    <div className="ao-row-meta">
                                        {p.correo || p.email || "—"}
                                    </div>
                                </div>

                                <div className="ao-row-right">
                                    <div className="ao-row-total">
                                        ${Number(p.total || 0).toLocaleString()}
                                    </div>
                                    <div className="ao-row-date">
                                        {p.fechaObj.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Botón VER MÁS / VER MENOS */}
                {pedidosFiltrados.length > 10 && (
                    <div className="ao-see-more">
                        <button
                            className="ao-see-more-btn"
                            onClick={() => setMostrarTodos(!mostrarTodos)}
                        >
                            {mostrarTodos ? "Ver menos" : "Ver más"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

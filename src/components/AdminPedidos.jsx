import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { useAdminData } from "../context/AdminDataContext";
import { normalizarFecha } from "../utils/fechas";

import logo from "../../assets/logo/logo-sin-punto.png";
import "../styles/admin.css";

export default function PedidosAdmin() {
    const { pedidos, loading, refetch } = useAdminData();

    const [pedidosVisibles, setPedidosVisibles] = useState([]);
    const [mesesOrdenados, setMesesOrdenados] = useState([]);
    const [mesActualIndex, setMesActualIndex] = useState(0);
    const [cargandoMes, setCargandoMes] = useState(false);

    const [orden, setOrden] = useState("masReciente");
    const [busqueda, setBusqueda] = useState("");

    // -------------------------------------------------
    // Normalizar y ordenar pedidos (desde contexto)
    // -------------------------------------------------
    const pedidosTodos = useMemo(() => {
        return pedidos
            .map(p => ({
                ...p,
                fechaObj: p.fechaObj ?? normalizarFecha(
                    p.fecha ?? p.createdAt ?? p.created_at
                ),
            }))
            .sort((a, b) => b.fechaObj - a.fechaObj);
    }, [pedidos]);

    // -------------------------------------------------
    // Agrupar por mes (primer render)
    // -------------------------------------------------
    useEffect(() => {
        if (pedidosTodos.length === 0) return;

        const grupos = {};

        pedidosTodos.forEach(p => {
            const y = p.fechaObj.getFullYear();
            const m = p.fechaObj.getMonth() + 1;
            const key = `${y}-${String(m).padStart(2, "0")}`;
            if (!grupos[key]) grupos[key] = [];
            grupos[key].push(p);
        });

        const keysOrdenadas = Object.keys(grupos).sort((a, b) =>
            b.localeCompare(a)
        );

        setMesesOrdenados(keysOrdenadas);
        setPedidosVisibles(grupos[keysOrdenadas[0]] || []);
        setMesActualIndex(0);
    }, [pedidosTodos]);

    // -------------------------------------------------
    // Scroll infinito
    // -------------------------------------------------
    const handleScroll = () => {
        if (cargandoMes || mesesOrdenados.length === 0) return;

        const bottom =
            window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 50;

        if (bottom) cargarSiguienteMes();
    };

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    });

    const cargarSiguienteMes = () => {
        if (mesActualIndex >= mesesOrdenados.length - 1) return;

        setCargandoMes(true);

        setTimeout(() => {
            const nuevoIndex = mesActualIndex + 1;
            const mesKey = mesesOrdenados[nuevoIndex];

            const nuevosPedidos = pedidosTodos.filter(p => {
                const y = p.fechaObj.getFullYear();
                const m = p.fechaObj.getMonth() + 1;
                return mesKey === `${y}-${String(m).padStart(2, "0")}`;
            });

            setPedidosVisibles(prev => [...prev, ...nuevosPedidos]);
            setMesActualIndex(nuevoIndex);
            setCargandoMes(false);
        }, 400);
    };

    // -------------------------------------------------
    // Filtros y orden
    // -------------------------------------------------
    const pedidosFiltrados = pedidosVisibles.filter(p =>
        p.cliente?.toLowerCase().includes(busqueda.toLowerCase())
    );

    const handleOrdenChange = (e) => {
        const nuevoOrden = e.target.value;
        setOrden(nuevoOrden);

        const ordenados = [...pedidosVisibles].sort((a, b) =>
            nuevoOrden === "masReciente"
                ? b.fechaObj - a.fechaObj
                : a.fechaObj - b.fechaObj
        );

        setPedidosVisibles(ordenados);
    };

    // -------------------------------------------------
    // Util: pedidos del último mes real
    // -------------------------------------------------
    const obtenerPedidosUltimoMes = () => {
        if (pedidosTodos.length === 0) return [];

        const ultimaFecha = pedidosTodos[0].fechaObj;
        const y = ultimaFecha.getFullYear();
        const m = ultimaFecha.getMonth();

        const inicio = new Date(y, m, 1);
        const fin = new Date(y, m + 1, 0, 23, 59, 59);

        return pedidosTodos.filter(
            p => p.fechaObj >= inicio && p.fechaObj <= fin
        );
    };

    // -------------------------------------------------
    // Descargar PDF / Excel
    // -------------------------------------------------
    const handleDescargarLista = (e) => {
        const formato = e.target.value;
        if (!formato) return;

        const listaFuente =
            formato.includes("UltimoMes")
                ? obtenerPedidosUltimoMes()
                : pedidosTodos;

        if (listaFuente.length === 0) {
            alert("No hay pedidos para descargar.");
            e.target.value = "";
            return;
        }

        // ---------- PDF ----------
        if (formato.includes("pdf")) {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(
                formato.includes("UltimoMes")
                    ? "Pedidos del Último Mes"
                    : "Lista Completa de Pedidos",
                105,
                20,
                { align: "center" }
            );

            let y = 30;

            listaFuente.forEach((p, i) => {
                doc.setFontSize(12);
                doc.text(`Pedido ${i + 1}`, 15, y);
                y += 6;

                autoTable(doc, {
                    startY: y,
                    body: [
                        ["Cliente", p.cliente || "—"],
                        ["Correo", p.correo || "—"],
                        ["Fecha", p.fecha || p.fechaObj.toLocaleString()],
                        ["Total", `$${p.total || 0}`],
                    ],
                    theme: "plain",
                });

                y = doc.lastAutoTable.finalY + 8;

                autoTable(doc, {
                    startY: y,
                    head: [["Producto", "Cant.", "Precio", "Subtotal"]],
                    body:
                        p.productos?.map(prod => [
                            prod.titulo,
                            prod.cantidad,
                            `$${prod.precioUnitario}`,
                            `$${prod.subtotal}`,
                        ]) || [],
                });

                y = doc.lastAutoTable.finalY + 15;
                if (y > 270) {
                    doc.addPage();
                    y = 30;
                }
            });

            doc.save(
                formato.includes("UltimoMes")
                    ? "pedidos_ultimo_mes.pdf"
                    : "lista_pedidos.pdf"
            );
        }

        // ---------- EXCEL ----------
        if (formato.includes("excel")) {
            const filas = [];

            listaFuente.forEach(p => {
                p.productos?.forEach((prod, i) => {
                    filas.push({
                        Cliente: p.cliente,
                        Correo: p.correo,
                        Fecha: p.fecha || p.fechaObj.toLocaleString(),
                        Producto: prod.titulo,
                        Cantidad: prod.cantidad,
                        Precio: prod.precioUnitario,
                        Subtotal: prod.subtotal,
                        Total: i === 0 ? p.total : "",
                    });
                });
            });

            const ws = XLSX.utils.json_to_sheet(filas);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

            XLSX.writeFile(
                wb,
                formato.includes("UltimoMes")
                    ? "pedidos_ultimo_mes.xlsx"
                    : "lista_pedidos.xlsx"
            );
        }

        e.target.value = "";
    };

    // -------------------------------------------------
    // PDF individual
    // -------------------------------------------------
    const handleDescargarPDF = async (pedido) => {
        const doc = new jsPDF({ orientation: "portrait" });

        // Logo
        try {
            const img = new Image();
            img.src = logo;
            await new Promise(res => img.onload = res);
            doc.addImage(img, "PNG", 15, 10, 25, 25);
        } catch (e) {
            console.warn("No se pudo cargar el logo");
        }

        let y = 45;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Comprobante de Envío", 105, 25, { align: "center" });

        doc.setDrawColor(160);
        doc.line(15, 35, 195, 35);

        // -------- DATOS CLIENTE --------
        doc.setFontSize(12);
        doc.text("Datos del Cliente:", 15, y);
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.text(`Nombre: ${pedido.cliente || "No disponible"}`, 15, y); y += 7;
        doc.text(`Correo: ${pedido.correo || "No disponible"}`, 15, y); y += 7;
        doc.text(`Teléfono: ${pedido.telefono || "No disponible"}`, 15, y); y += 7;
        doc.text(`Instagram: ${pedido.instagram || "No disponible"}`, 15, y); y += 7;
        doc.text(`Método de entrega: ${pedido.metodoEntrega || "No disponible"}`, 15, y); y += 7;
        doc.text(`Fecha: ${pedido.fecha || "No disponible"}`, 15, y); y += 10;

        // -------- DIRECCIÓN --------
        doc.setFont("helvetica", "bold");
        doc.text("Dirección de Envío:", 15, y);
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.text(`Dirección: ${pedido.direccion || "No disponible"}`, 15, y); y += 7;
        doc.text(`Ciudad: ${pedido.ciudad || "No disponible"}`, 15, y); y += 7;
        doc.text(`Código Postal: ${pedido.codigoPostal || "No disponible"}`, 15, y); y += 7;
        doc.text(`Departamento: ${pedido.departamento || "No disponible"}`, 15, y); y += 7;
        doc.text(`DNI: ${pedido.dni || "No disponible"}`, 15, y); y += 10;

        // -------- PRODUCTOS --------
        const productos = pedido.productos?.map(p => [
            p.titulo,
            p.cantidad,
            `$${p.precioUnitario}`,
            `$${p.subtotal}`
        ]) || [];

        autoTable(doc, {
            startY: y,
            head: [["Producto", "Cantidad", "Precio", "Subtotal"]],
            body: productos,
            theme: "grid",
            styles: { fontSize: 11 },
            headStyles: { fillColor: [120, 120, 120] },
            margin: { left: 15, right: 15 },
            didDrawPage: () => {
                doc.setFontSize(10);
                doc.text("Comprobante de Envío", 105, 290, { align: "center" });
            }
        });

        y = doc.lastAutoTable.finalY + 10;

        // -------- TOTAL (SIEMPRE VISIBLE) --------
        if (y > 270) {
            doc.addPage();
            y = 30;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`TOTAL: $${pedido.total}`, 15, y);

        doc.save(`comprobante_envio_${pedido.id}.pdf`);
    };
    // -------------------------------------------------
    // WhatsApp
    // -------------------------------------------------
    const handleWhatsApp = (pedido) => {
        if (!pedido.telefono) return;
        const tel = pedido.telefono.replace(/\D/g, "");
        const msg = encodeURIComponent(
            `Hola ${pedido.cliente}! Tu pedido ya fue despachado 🚚✨`
        );
        window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
    };

    if (loading) return <p className="admin-loader">Cargando pedidos...</p>;

    return (
        <div>
            <h2 className="productos-admin-title">Lista de Pedidos</h2>

            <div className="orden-selector">
                <input
                    type="text"
                    placeholder="Buscar por comprador..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="busqueda-input"
                />

                <select value={orden} onChange={handleOrdenChange}>
                    <option value="masReciente">Más reciente</option>
                    <option value="menosReciente">Menos reciente</option>
                </select>

                <select onChange={handleDescargarLista}>
                    <option value="">⬇️ Descargar</option>
                    <option value="pdf">📄 PDF</option>
                    <option value="pdfUltimoMes">📄 PDF último mes</option>
                    <option value="excel">📊 Excel</option>
                    <option value="excelUltimoMes">📊 Excel último mes</option>
                </select>

                <button onClick={refetch} className="refresh-btn">🔄 Refresh</button>
            </div>

            <div className="cards-container">
                {pedidosFiltrados.map(pedido => (
                    <div key={pedido.id} className="pedido-card">

                        <button
                            className="download-btn"
                            title="Descargar comprobante de envío"
                            onClick={() => handleDescargarPDF(pedido)}
                        >
                            🚚
                        </button>

                        <button
                            className="whatsapp-btn"
                            title="Enviar mensaje de despacho por WhatsApp"
                            onClick={() => handleWhatsApp(pedido)}
                        >
                            💬
                        </button>

                        <div className="pedido-header">
                            <h3>{pedido.cliente || "No disponible"}</h3>
                            <span className="pedido-fecha">
                                {pedido.fecha || "No disponible"}
                            </span>
                        </div>

                        <div className="pedido-section">
                            <h4>📦 Detalles del pedido</h4>

                            <div className="pedido-row">
                                <span className="label">Correo</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.correo || "No disponible"}</span>
                            </div>

                            <div className="pedido-row">
                                <span className="label">Teléfono</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.telefono || "No disponible"}</span>
                            </div>

                            <div className="pedido-row">
                                <span className="label">Método de entrega</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.metodoEntrega || "No disponible"}</span>
                            </div>

                            <div className="pedido-row">
                                <span className="label">Instagram</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.instagram || "No disponible"}</span>
                            </div>
                        </div>

                        <div className="pedido-section">
                            <h4>📍 Dirección de envío</h4>

                            <div className="pedido-row">
                                <span className="label">Dirección</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.direccion || "No disponible"}</span>
                            </div>

                            <div className="pedido-row">
                                <span className="label">Ciudad</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.ciudad || "No disponible"}</span>
                            </div>

                            <div className="pedido-row">
                                <span className="label">Código Postal</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.codigoPostal || "No disponible"}</span>
                            </div>

                            <div className="pedido-row">
                                <span className="label">Departamento</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.departamento || "No disponible"}</span>
                            </div>

                            <div className="pedido-row">
                                <span className="label">DNI</span>
                                <span className="dots"></span>
                                <span className="value">{pedido.dni || "No disponible"}</span>
                            </div>
                        </div>

                        <div className="pedido-section productos">
                            <h4>🛍️ Productos</h4>

                            {pedido.productos?.map((prod, idx) => (
                                <div className="pedido-row" key={idx}>
                                    <span className="label">{prod.titulo}</span>
                                    <span className="dots"></span>
                                    <span className="value">
                                        {prod.cantidad} x ${prod.precioUnitario} = ${prod.subtotal}
                                    </span>
                                </div>
                            ))}

                            <div className="pedido-row total">
                                <span className="label">Total</span>
                                <span className="dots"></span>
                                <span className="value">${pedido.total}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

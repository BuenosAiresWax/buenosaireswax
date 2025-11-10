import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import logo from "../../assets/logo/logo-sin-punto.png";

import "../styles/admin.css";

const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

function parseFecha(fechaStr) {
    if (!fechaStr) return new Date(0);
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
    return new Date(parseInt(año), meses[mes.toLowerCase()], parseInt(dia), hora, min);
}

export default function PedidosAdmin() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orden, setOrden] = useState("masReciente");
    const [busqueda, setBusqueda] = useState("");

    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const pedidosRef = collection(db, "pedidos");
            const snapshot = await getDocs(pedidosRef);
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const pedidosConFecha = docs.map(p => ({
                ...p,
                fechaObj: parseFecha(p.fecha)
            }));
            pedidosConFecha.sort((a, b) => b.fechaObj - a.fechaObj);
            setPedidos(pedidosConFecha);
        } catch (error) {
            console.error("Error al cargar pedidos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPedidos();
    }, []);

    const pedidosFiltrados = pedidos.filter(p =>
        p.cliente?.toLowerCase().includes(busqueda.toLowerCase())
    );

    const handleOrdenChange = (e) => {
        const nuevoOrden = e.target.value;
        setOrden(nuevoOrden);
        const pedidosOrdenados = [...pedidos].sort((a, b) =>
            nuevoOrden === "masReciente" ? b.fechaObj - a.fechaObj : a.fechaObj - b.fechaObj
        );
        setPedidos(pedidosOrdenados);
    };

    // 📥 Descargar lista completa (PDF o Excel)
    const handleDescargarLista = async (e) => {
        const formato = e.target.value;
        if (formato === "") return;

        // 📄 PDF general
        if (formato === "pdf") {
            const doc = new jsPDF({ orientation: "portrait" });
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("Lista Completa de Pedidos", 105, 20, { align: "center" });

            let y = 30;

            pedidos.forEach((p, index) => {
                doc.setFontSize(13);
                doc.setTextColor(40);
                doc.text(`Pedido ${index + 1}`, 15, y);
                doc.setDrawColor(180);
                doc.line(15, y + 2, 195, y + 2);
                y += 8;

                const datos = [
                    ["Cliente", p.cliente || "No disponible"],
                    ["Correo", p.correo || "No disponible"],
                    ["Teléfono", p.telefono || "No disponible"],
                    ["Instagram", p.instagram || "No disponible"],
                    ["Método de entrega", p.metodoEntrega || "No disponible"],
                    ["Dirección", p.direccion || "No disponible"],
                    ["Ciudad", p.ciudad || "No disponible"],
                    ["Código Postal", p.codigoPostal || "No disponible"],
                    ["Departamento", p.departamento || "No disponible"],
                    ["DNI", p.dni || "No disponible"],
                    ["Fecha", p.fecha || "No disponible"],
                ];

                autoTable(doc, {
                    startY: y,
                    body: datos,
                    theme: "plain",
                    styles: { fontSize: 10, cellPadding: 2 },
                    columnStyles: {
                        0: { fontStyle: "bold", cellWidth: 50 },
                        1: { cellWidth: 120 },
                    },
                });

                y = doc.lastAutoTable.finalY + 5;

                const productos = p.productos?.map(prod => [
                    prod.titulo,
                    prod.cantidad,
                    `$${prod.precioUnitario}`,
                    `$${prod.subtotal}`,
                ]) || [];

                autoTable(doc, {
                    startY: y,
                    head: [["Producto", "Cantidad", "Precio", "Subtotal"]],
                    body: productos,
                    theme: "grid",
                    headStyles: { fillColor: [90, 90, 90], textColor: 255 },
                    styles: { fontSize: 10 },
                });

                y = doc.lastAutoTable.finalY + 8;
                doc.setFont("helvetica", "bold");
                doc.text(`TOTAL: $${p.total || 0}`, 15, y);

                y += 15;
                if (y > 270 && index < pedidos.length - 1) {
                    doc.addPage();
                    y = 30;
                }
            });

            doc.save("lista_pedidos.pdf");
        }

        // 📘 Excel general
        if (formato === "excel") {
            const filas = [];

            pedidos.forEach((p) => {
                if (p.productos && p.productos.length > 0) {
                    p.productos.forEach((prod, idx) => {
                        filas.push({
                            Cliente: p.cliente || "No disponible",
                            Correo: p.correo || "No disponible",
                            Teléfono: p.telefono || "No disponible",
                            Instagram: p.instagram || "No disponible",
                            "Método de Entrega": p.metodoEntrega || "No disponible",
                            Dirección: p.direccion || "No disponible",
                            Ciudad: p.ciudad || "No disponible",
                            "Código Postal": p.codigoPostal || "No disponible",
                            Departamento: p.departamento || "No disponible",
                            DNI: p.dni || "No disponible",
                            Fecha: p.fecha || "No disponible",
                            Producto: prod.titulo || "No disponible",
                            Cantidad: prod.cantidad || 0,
                            "Precio Unitario": prod.precioUnitario ? `$${prod.precioUnitario}` : "—",
                            Subtotal: prod.subtotal ? `$${prod.subtotal}` : "—",
                            Total: idx === 0 ? `$${p.total}` : "", // solo mostrar el total en la primera fila del pedido
                        });
                    });
                } else {
                    filas.push({
                        Cliente: p.cliente || "No disponible",
                        Correo: p.correo || "No disponible",
                        Teléfono: p.telefono || "No disponible",
                        Instagram: p.instagram || "No disponible",
                        "Método de Entrega": p.metodoEntrega || "No disponible",
                        Dirección: p.direccion || "No disponible",
                        Ciudad: p.ciudad || "No disponible",
                        "Código Postal": p.codigoPostal || "No disponible",
                        Departamento: p.departamento || "No disponible",
                        DNI: p.dni || "No disponible",
                        Fecha: p.fecha || "No disponible",
                        Producto: "Sin productos",
                        Cantidad: "",
                        "Precio Unitario": "",
                        Subtotal: "",
                        Total: `$${p.total || 0}`,
                    });
                }
            });

            const ws = XLSX.utils.json_to_sheet(filas);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
            XLSX.writeFile(wb, "lista_pedidos.xlsx");
        }

        e.target.value = "";
    };

    // 🧾 PDF individual
    const handleDescargarPDF = async (pedido) => {
        const doc = new jsPDF();
        try {
            const img = new Image();
            img.src = logo;
            await new Promise((res) => { img.onload = res; });
            doc.addImage(img, "SVG", 15, 10, 25, 25);
        } catch (e) {
            console.warn("No se pudo cargar el logo:", e);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Comprobante de Envío", 105, 25, { align: "center" });

        doc.setDrawColor(120, 120, 120);
        doc.line(15, 35, 195, 35);

        doc.setFontSize(12);
        doc.text("Datos del Cliente:", 15, 45);
        doc.setFont("helvetica", "normal");
        doc.text(`Nombre: ${pedido.cliente || "No disponible"}`, 15, 53);
        doc.text(`Correo: ${pedido.correo || "No disponible"}`, 15, 61);
        doc.text(`Teléfono: ${pedido.telefono || "No disponible"}`, 15, 69);
        doc.text(`Instagram: ${pedido.instagram || "No disponible"}`, 15, 77);
        doc.text(`Método de Entrega: ${pedido.metodoEntrega || "No disponible"}`, 15, 85);
        doc.text(`Fecha del Pedido: ${pedido.fecha || "No disponible"}`, 15, 93);

        // 📍 Dirección
        doc.setFont("helvetica", "bold");
        doc.text("Dirección de Envío:", 15, 105);
        doc.setFont("helvetica", "normal");
        doc.text(`Dirección: ${pedido.direccion || "No disponible"}`, 15, 113);
        doc.text(`Ciudad: ${pedido.ciudad || "No disponible"}`, 15, 121);
        doc.text(`Código Postal: ${pedido.codigoPostal || "No disponible"}`, 15, 129);
        doc.text(`Departamento: ${pedido.departamento || "No disponible"}`, 15, 137);
        doc.text(`DNI: ${pedido.dni || "No disponible"}`, 15, 145);

        const startY = 155;
        const productos = pedido.productos?.map(p => [
            p.titulo,
            p.cantidad,
            `$${p.precioUnitario}`,
            `$${p.subtotal}`
        ]) || [];

        autoTable(doc, {
            startY,
            head: [["Producto", "Cantidad", "Precio", "Subtotal"]],
            body: productos,
            theme: "grid",
            headStyles: { fillColor: [120, 120, 120] },
            styles: { fontSize: 11 },
        });

        const yFinal = doc.lastAutoTable.finalY + 10;
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL: $${pedido.total}`, 15, yFinal);

        doc.save(`comprobante_envio_${pedido.cliente}_${pedido.id}.pdf`);
    };

    const handleWhatsApp = (pedido) => {
        if (!pedido.telefono) return; // no hace nada si no hay número

        const telefono = pedido.telefono.replace(/\D/g, ""); // limpia caracteres no numéricos
        const mensaje = encodeURIComponent(
            `¡Hola ${pedido.cliente || "cliente"}! 👋 Tu pedido ya fue despachado 🚚💚 Gracias por tu compra.`
        );

        window.open(`https://wa.me/${telefono}?text=${mensaje}`, "_blank");
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
                    <option value="masReciente">Más reciente primero</option>
                    <option value="menosReciente">Menos reciente primero</option>
                </select>

                <select onChange={handleDescargarLista} className="descargar-select">
                    <option value="">⬇️ Descargar Pedidos</option>
                    <option value="pdf">📄 PDF</option>
                    <option value="excel">📘 Excel</option>
                </select>

                <button onClick={fetchPedidos} className="refresh-btn">🔄 Refresh</button>
            </div>

            <div className="cards-container">
                {pedidosFiltrados.length === 0 ? (
                    <p>No hay pedidos registrados.</p>
                ) : (
                    pedidosFiltrados.map((pedido) => (
                        <div key={pedido.id} className="pedido-card">

                            <button
                                className="download-btn"
                                title="Descargar comprobante de envío"
                                onClick={() => handleDescargarPDF(pedido)}
                            >
                                🚚
                            </button>

                            {/* 🟢 Nuevo botón de WhatsApp */}
                            <button
                                className="whatsapp-btn"
                                title="Enviar mensaje de despacho por WhatsApp"
                                onClick={() => handleWhatsApp(pedido)}
                            >
                                💬
                            </button>

                            <div className="pedido-header">
                                <h3>{pedido.cliente || "No disponible"}</h3>
                                <span className="pedido-fecha">{pedido.fecha || "No disponible"}</span>
                            </div>

                            <div className="pedido-section">
                                <h4>📦 Detalles del pedido</h4>
                                <div className="pedido-row"><span className="label">Correo</span><span className="dots"></span><span className="value">{pedido.correo || "No disponible"}</span></div>
                                <div className="pedido-row"><span className="label">Teléfono</span><span className="dots"></span><span className="value">{pedido.telefono || "No disponible"}</span></div>
                                <div className="pedido-row"><span className="label">Método de entrega</span><span className="dots"></span><span className="value">{pedido.metodoEntrega || "No disponible"}</span></div>
                                <div className="pedido-row"><span className="label">Instagram</span><span className="dots"></span><span className="value">{pedido.instagram || "No disponible"}</span></div>
                            </div>

                            <div className="pedido-section">
                                <h4>📍 Dirección de envío</h4>
                                <div className="pedido-row"><span className="label">Dirección</span><span className="dots"></span><span className="value">{pedido.direccion || "No disponible"}</span></div>
                                <div className="pedido-row"><span className="label">Ciudad</span><span className="dots"></span><span className="value">{pedido.ciudad || "No disponible"}</span></div>
                                <div className="pedido-row"><span className="label">Código Postal</span><span className="dots"></span><span className="value">{pedido.codigoPostal || "No disponible"}</span></div>
                                <div className="pedido-row"><span className="label">Departamento</span><span className="dots"></span><span className="value">{pedido.departamento || "No disponible"}</span></div>
                                <div className="pedido-row"><span className="label">DNI</span><span className="dots"></span><span className="value">{pedido.dni || "No disponible"}</span></div>
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
                    ))
                )}
            </div>
        </div>
    );
}
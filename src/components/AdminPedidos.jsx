import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

    // 🧾 Generar comprobante de envío PDF con logo y estilo
    const handleDescargarPDF = async (pedido) => {
        const doc = new jsPDF();

        // 🖼️ Logo de la tienda
        try {
            const img = new Image();
            img.src = logo;
            await new Promise((res) => {
                img.onload = res;
            });
            doc.addImage(img, "SVG", 15, 10, 25, 25);
        } catch (e) {
            console.warn("No se pudo cargar el logo:", e);
        }

        // 🧾 Encabezado
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Comprobante de Envío", 105, 25, { align: "center" });

        // Línea decorativa
        // Línea decorativa (gris)
        doc.setDrawColor(120, 120, 120); // gris medio
        doc.setLineWidth(0.8);
        doc.line(15, 35, 195, 35);

        // 🧍 Datos del cliente
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("Datos del Cliente:", 15, 45);
        doc.setFont("helvetica", "normal");
        doc.text(`Nombre: ${pedido.cliente}`, 15, 53);
        doc.text(`Correo: ${pedido.correo}`, 15, 61);
        doc.text(`Teléfono: ${pedido.telefono}`, 15, 69);
        if (pedido.instagram)
            doc.text(`Instagram: ${pedido.instagram}`, 15, 77);
        doc.text(`Método de Entrega: ${pedido.metodoEntrega}`, 15, 85);
        doc.text(`Fecha del Pedido: ${pedido.fecha}`, 15, 93);

        // 📦 Tabla de productos
        const productos = pedido.productos?.map(p => [
            p.titulo,
            p.cantidad,
            `$${p.precioUnitario}`,
            `$${p.subtotal}`
        ]) || [];

        autoTable(doc, {
            startY: 105,
            head: [["Producto", "Cantidad", "Precio", "Subtotal"]],
            body: productos,
            theme: "grid",
            headStyles: { fillColor: [120, 120, 120] },
            styles: { fontSize: 11 },
        });

        // 💵 Total
        const yFinal = doc.lastAutoTable.finalY + 10;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(12, 12, 12);
        doc.text(`TOTAL: $${pedido.total}`, 15, yFinal);

        doc.save(`comprobante_envio_${pedido.cliente}_${pedido.id}.pdf`);
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

                            <div className="pedido-header">
                                <h3>{pedido.cliente}</h3>
                                <span className="pedido-fecha">{pedido.fecha}</span>
                            </div>

                            <div className="pedido-section">
                                <h4>📦 Detalles del pedido</h4>
                                <div className="pedido-row"><span className="label">Correo</span><span className="dots"></span><span className="value">{pedido.correo}</span></div>
                                <div className="pedido-row"><span className="label">Teléfono</span><span className="dots"></span><span className="value">{pedido.telefono}</span></div>
                                <div className="pedido-row"><span className="label">Método de entrega</span><span className="dots"></span><span className="value">{pedido.metodoEntrega}</span></div>
                                <div className="pedido-row"><span className="label">Instagram</span><span className="dots"></span><span className="value">{pedido.instagram}</span></div>
                                <div className="pedido-row total"><span className="label">Total</span><span className="dots"></span><span className="value">${pedido.total}</span></div>
                            </div>

                            <div className="pedido-section productos">
                                <h4>🛍️ Productos</h4>
                                {pedido.productos?.map((prod, idx) => (
                                    <div className="pedido-row" key={idx}>
                                        <span className="label">{prod.titulo}</span>
                                        <span className="dots"></span>
                                        <span className="value">{prod.cantidad} x ${prod.precioUnitario} = ${prod.subtotal}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

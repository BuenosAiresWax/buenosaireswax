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
    const [pedidosTodos, setPedidosTodos] = useState([]);
    const [pedidosVisibles, setPedidosVisibles] = useState([]);
    const [mesesOrdenados, setMesesOrdenados] = useState([]);
    const [mesActualIndex, setMesActualIndex] = useState(0);

    const [loading, setLoading] = useState(true);
    const [cargandoMes, setCargandoMes] = useState(false);

    const [orden, setOrden] = useState("masReciente");
    const [busqueda, setBusqueda] = useState("");

    // ------------------------------------------
    // 1) Traer pedidos y agrupar por mes
    // ------------------------------------------
    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const pedidosRef = collection(db, "pedidos");
            const snapshot = await getDocs(pedidosRef);

            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                fechaObj: parseFecha(doc.data().fecha)
            }));

            const ordenados = docs.sort((a, b) => b.fechaObj - a.fechaObj);
            setPedidosTodos(ordenados);

            // Agrupar por año-mes
            const grupos = {};

            ordenados.forEach(p => {
                const y = p.fechaObj.getFullYear();
                const m = p.fechaObj.getMonth() + 1; // 1-12
                const key = `${y}-${String(m).padStart(2, "0")}`;

                if (!grupos[key]) grupos[key] = [];
                grupos[key].push(p);
            });

            const keysOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

            setMesesOrdenados(keysOrdenadas);

            // Primer mes visible
            const primerMes = keysOrdenadas[0];
            setPedidosVisibles(grupos[primerMes]);
            setMesActualIndex(0);

        } catch (error) {
            console.error("Error al cargar pedidos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPedidos();
    }, []);

    // ------------------------------------------
    // 2) Scroll infinito para cargar meses anteriores
    // ------------------------------------------
    const handleScroll = () => {
        if (cargandoMes || mesesOrdenados.length === 0) return;

        const bottom =
            window.innerHeight + window.scrollY >= document.body.offsetHeight - 50;

        if (bottom) {
            cargarSiguienteMes();
        }
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

    // ------------------------------------------
    //  FILTRO POR BUSQUEDA
    // ------------------------------------------
    const pedidosFiltrados = pedidosVisibles.filter(p =>
        p.cliente?.toLowerCase().includes(busqueda.toLowerCase())
    );

    // ------------------------------------------
    //  ORDENAMIENTO (solo afecta visibles)
    // ------------------------------------------
    const handleOrdenChange = (e) => {
        const nuevoOrden = e.target.value;
        setOrden(nuevoOrden);

        const ordenados = [...pedidosVisibles].sort((a, b) =>
            nuevoOrden === "masReciente" ? b.fechaObj - a.fechaObj : a.fechaObj - b.fechaObj
        );

        setPedidosVisibles(ordenados);
    };


    // 📥 Descargar lista completa (PDF o Excel)
    const handleDescargarLista = async (e) => {
        const formato = e.target.value;
        if (formato === "") return;

        // ✅ Nueva función: obtiene el último mes con pedidos disponibles
        const obtenerPedidosUltimoMes = () => {
            if (pedidos.length === 0) return [];

            // Tomamos todos los meses disponibles en los pedidos
            const fechas = pedidos.map(p => p.fechaObj).filter(d => d instanceof Date && !isNaN(d));
            if (fechas.length === 0) return [];

            // Buscamos la fecha más reciente
            const ultimaFecha = new Date(Math.max(...fechas.map(d => d.getTime())));
            const ultimoMes = ultimaFecha.getMonth();
            const ultimoAño = ultimaFecha.getFullYear();

            const inicioUltimoMes = new Date(ultimoAño, ultimoMes, 1);
            const finUltimoMes = new Date(ultimoAño, ultimoMes + 1, 0, 23, 59, 59);

            // Filtramos los pedidos de ese mes
            return pedidos.filter(
                p => p.fechaObj >= inicioUltimoMes && p.fechaObj <= finUltimoMes
            );
        };

        // 📄 PDF general o del último mes
        if (formato === "pdf" || formato === "pdfUltimoMes") {
            const listaFuente = formato === "pdfUltimoMes" ? obtenerPedidosUltimoMes() : pedidos;

            if (listaFuente.length === 0) {
                alert("No hay pedidos registrados en el último mes.");
                e.target.value = "";
                return;
            }

            const doc = new jsPDF({ orientation: "portrait" });
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);

            const titulo =
                formato === "pdfUltimoMes"
                    ? "Pedidos del Último Mes"
                    : "Lista Completa de Pedidos";

            doc.text(titulo, 105, 20, { align: "center" });

            let y = 30;

            listaFuente.forEach((p, index) => {
                doc.setFontSize(13);
                doc.setTextColor(40);
                doc.text(`Pedido ${index + 1}`, 15, y);
                doc.setDrawColor(180);
                doc.line(15, y + 2, 195, y + 2);
                y += 8;

                const datosCombinados = [
                    ["Cliente", p.cliente || "No disponible", "Dirección", p.direccion || "No disponible"],
                    ["Correo", p.correo || "No disponible", "Ciudad", p.ciudad || "No disponible"],
                    ["Teléfono", p.telefono || "No disponible", "Código Postal", p.codigoPostal || "No disponible"],
                    ["Instagram", p.instagram || "No disponible", "Departamento", p.departamento || "No disponible"],
                    ["Método de entrega", p.metodoEntrega || "No disponible", "DNI", p.dni || "No disponible"],
                ];

                autoTable(doc, {
                    startY: y,
                    body: datosCombinados,
                    theme: "plain",
                    styles: { fontSize: 10, cellPadding: 2 },
                    columnStyles: {
                        0: { fontStyle: "bold", cellWidth: 40 },
                        1: { cellWidth: 45 },
                        2: { fontStyle: "bold", cellWidth: 40 },
                        3: { cellWidth: 45 },
                    },
                    margin: { left: 15 },
                });

                y = doc.lastAutoTable.finalY + 10;

                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text(`Fecha:`, 15, y);
                doc.setFont("helvetica", "normal");
                doc.text(p.fecha || "No disponible", 30, y);
                y += 8;

                doc.setDrawColor(220);
                doc.line(15, y - 3, 195, y - 3);

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
                if (y > 270 && index < listaFuente.length - 1) {
                    doc.addPage();
                    y = 30;
                }
            });

            const nombreArchivo =
                formato === "pdfUltimoMes"
                    ? "pedidos_ultimo_mes.pdf"
                    : "lista_pedidos.pdf";

            doc.save(nombreArchivo);
        }

        // 📘 Excel general o del último mes
        if (formato === "excel" || formato === "excelUltimoMes") {
            const listaFuente = formato === "excelUltimoMes" ? obtenerPedidosUltimoMes() : pedidos;

            if (listaFuente.length === 0) {
                alert("No hay pedidos registrados en el último mes.");
                e.target.value = "";
                return;
            }

            const filas = [];

            listaFuente.forEach((p) => {
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
                            Total: idx === 0 ? `$${p.total}` : "",
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

            const nombreArchivo =
                formato === "excelUltimoMes"
                    ? "pedidos_ultimo_mes.xlsx"
                    : "lista_pedidos.xlsx";

            XLSX.writeFile(wb, nombreArchivo);
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
                    <option value="pdfUltimoMes">📄 Último mes (PDF)</option>
                    <option value="excel">📊 Excel</option>
                    <option value="excelUltimoMes">📊 Último mes (Excel)</option>
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
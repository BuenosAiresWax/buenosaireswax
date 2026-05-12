import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    doc,
    runTransaction,
    collection,
    getDoc,
    getDocs,
    query,
    where,
    limit,
} from "firebase/firestore";

import { useAdminData } from "../context/AdminDataContext";
import { normalizarFecha } from "../utils/fechas";
import { db } from "../firebase/config";

import logo from "../../assets/logo/logo-sin-punto.png";
import "../styles/admin.css";

function esValorCancelado(valorCancelado) {
    if (typeof valorCancelado === "boolean") return valorCancelado;
    if (typeof valorCancelado === "number") return valorCancelado === 1;

    if (typeof valorCancelado === "string") {
        const v = valorCancelado.trim().toLowerCase();
        if (v.includes("cancel")) return true;
        if (["true", "1", "si", "sí", "cancelado", "cancelada"].includes(v)) return true;
        if (["false", "0", "no", "activo", "activa"].includes(v)) return false;
    }

    return false;
}

function esPedidoCancelado(pedido) {
    if (!pedido || typeof pedido !== "object") return false;

    return (
        esValorCancelado(pedido.cancelado) ||
        esValorCancelado(pedido.cancelada) ||
        esValorCancelado(pedido.estado) ||
        esValorCancelado(pedido.status) ||
        Boolean(pedido.canceladoAt)
    );
}

function formatearFecha(valor) {
    const normalizada = normalizarFecha(valor);
    if (normalizada instanceof Date && !isNaN(normalizada)) {
        return normalizada.toLocaleString("es-AR");
    }
    return "No disponible";
}

function obtenerEstadoPedido(pedido) {
    const cancelado = esPedidoCancelado(pedido);
    return {
        texto: cancelado ? "Cancelado" : "Activo",
        cancelado,
        fechaCancelacion: pedido?.canceladoAt ? formatearFecha(pedido.canceladoAt) : "—",
    };
}

function obtenerNombreOrigen(sourceCollection) {
    if (sourceCollection === "pedidos") return "Drop";
    if (sourceCollection === "pedidosTienda") return "Tienda";
    if (sourceCollection === "pedidosEquipamiento") return "Equipamiento";
    return sourceCollection || "No disponible";
}

function obtenerDireccionResumida(pedido) {
    const partes = [pedido?.direccion, pedido?.ciudad, pedido?.departamento, pedido?.codigoPostal]
        .map((v) => (v || "").trim())
        .filter(Boolean);

    return partes.length ? partes.join(" | ") : "No disponible";
}

export default function PedidosAdmin() {
    const { pedidos, pedidosTienda, pedidosEquipamiento, loading, refetch } = useAdminData();

    const [pedidosVisibles, setPedidosVisibles] = useState([]);
    const [mesesOrdenados, setMesesOrdenados] = useState([]);
    const [mesActualIndex, setMesActualIndex] = useState(0);
    const [cargandoMes, setCargandoMes] = useState(false);

    const [orden, setOrden] = useState("masReciente");
    const [busqueda, setBusqueda] = useState("");
    const [cancelandoId, setCancelandoId] = useState(null);
    const [accionMsg, setAccionMsg] = useState("");
    const [filtroColeccion, setFiltroColeccion] = useState("todos");

    // -------------------------------------------------
    // Combinar todos los pedidos de todas las colecciones
    // -------------------------------------------------
    const todosPedidosCombinados = useMemo(() => {
        const combinados = [...pedidos, ...pedidosTienda, ...pedidosEquipamiento];
        
        return combinados
            .map(p => ({
                ...p,
                fechaObj: p.fechaObj ?? normalizarFecha(
                    p.fecha ?? p.createdAt ?? p.created_at
                ),
            }))
            .sort((a, b) => b.fechaObj - a.fechaObj);
    }, [pedidos, pedidosTienda, pedidosEquipamiento]);

    // -------------------------------------------------
    // Normalizar y ordenar pedidos
    // -------------------------------------------------
    const pedidosTodos = useMemo(() => {
        let lista = [...todosPedidosCombinados];
        
        // Filtrar por colección si es necesario
        if (filtroColeccion !== "todos") {
            lista = lista.filter(p => p.sourceCollection === filtroColeccion);
        }
        
        return lista;
    }, [todosPedidosCombinados, filtroColeccion]);

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
    // Cancelar pedido (revertir stock)
    // -------------------------------------------------
    function obtenerColeccionProductos(sourceCollection) {
        if (sourceCollection === "pedidosTienda") return "productosTienda";
        if (sourceCollection === "pedidosEquipamiento") return "equipamiento";
        return "productos"; // drop / default
    }

    async function resolveProductDocRef(productoPedido, coleccionProductos) {
        const candidateIds = [
            productoPedido?.id,
            productoPedido?.productoId,
            productoPedido?.docId,
            String(productoPedido?.titulo || "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-"),
        ].filter(Boolean);

        for (const id of candidateIds) {
            const ref = doc(db, coleccionProductos, String(id));
            const snap = await getDoc(ref);
            if (snap.exists()) return ref;
        }

        if (productoPedido?.titulo) {
            const byTitle = query(
                collection(db, coleccionProductos),
                where("titulo", "==", productoPedido.titulo),
                limit(1),
            );
            const result = await getDocs(byTitle);
            if (!result.empty) return result.docs[0].ref;
        }

        return null;
    }

    const handleCancelarPedido = async (pedido) => {
        if (esPedidoCancelado(pedido)) {
            setAccionMsg("Este pedido ya estaba cancelado.");
            return;
        }

        const confirmacion = window.confirm(
            "¿Se cancelará este pedido y se revertirá stock (reservados) de sus productos. Continuar?",
        );
        if (!confirmacion) return;

        setCancelandoId(pedido.id);
        setAccionMsg("");

        try {
            const coleccionPedido = pedido.sourceCollection || "pedidos";
            const coleccionProductos = obtenerColeccionProductos(coleccionPedido);
            const orderRef = doc(db, coleccionPedido, pedido.id);
            const ajustesStock = [];

            for (const producto of pedido.productos || []) {
                const cantidadComprada = Number(producto?.cantidad) || 0;
                if (cantidadComprada <= 0) continue;

                const productRef = await resolveProductDocRef(producto, coleccionProductos);
                if (!productRef) {
                    throw new Error(`No se encontró producto para "${producto?.titulo || "sin título"}".`);
                }

                ajustesStock.push({
                    ref: productRef,
                    cantidadComprada,
                    titulo: producto?.titulo || "sin título",
                });
            }

            await runTransaction(db, async (tx) => {
                // ── FASE 1: todos los reads ──
                const pedidoSnap = await tx.get(orderRef);
                if (!pedidoSnap.exists()) {
                    throw new Error("El pedido no existe o fue eliminado.");
                }

                const dataPedido = pedidoSnap.data();
                if (dataPedido?.cancelado) {
                    throw new Error("already-cancelled");
                }

                const productSnaps = await Promise.all(
                    ajustesStock.map(ajuste => tx.get(ajuste.ref))
                );

                // ── FASE 2: todos los writes ──
                productSnaps.forEach((productSnap, i) => {
                    const ajuste = ajustesStock[i];
                    if (!productSnap.exists()) {
                        throw new Error(`El producto "${ajuste.titulo}" no existe.`);
                    }
                    const reservadosActual = Number(productSnap.data()?.reservados) || 0;
                    const reservadosActualizados = Math.max(0, reservadosActual - ajuste.cantidadComprada);
                    tx.update(ajuste.ref, { reservados: reservadosActualizados });
                });

                tx.update(orderRef, {
                    cancelado: true,
                    estado: "cancelado",
                    canceladoAt: new Date().toISOString(),
                });
            });

            setAccionMsg("✅ Pedido cancelado correctamente. Stock revertido y pedido bloqueado.");
            setTimeout(() => {
                refetch();
                setAccionMsg("");
            }, 2000);
        } catch (error) {
            console.error("Error al cancelar pedido:", error);
            if (String(error?.message) === "already-cancelled") {
                setAccionMsg("❌ Este pedido ya fue cancelado previamente.");
            } else {
                setAccionMsg("❌ No se pudo cancelar el pedido. Revisa los datos de productos.");
            }
        } finally {
            setCancelandoId(null);
        }
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
            const pdfDoc = new jsPDF();
            pdfDoc.setFontSize(18);
            pdfDoc.text(
                formato.includes("UltimoMes")
                    ? "Pedidos del Último Mes"
                    : "Lista Completa de Pedidos",
                105,
                20,
                { align: "center" }
            );

            let y = 30;

            listaFuente.forEach((p, i) => {
                const estadoInfo = obtenerEstadoPedido(p);
                const origen = obtenerNombreOrigen(p.sourceCollection);
                const fechaPedido = formatearFecha(
                    p.fechaObj ?? p.fecha ?? p.createdAt ?? p.fechaCreacion ?? p.created_at ?? p.timestamp
                );

                pdfDoc.setFont("helvetica", "bold");
                pdfDoc.setFontSize(12);
                pdfDoc.text(`Pedido ${i + 1} - ${p.id || "sin-id"}`, 15, y);
                y += 6;

                autoTable(pdfDoc, {
                    startY: y,
                    body: [
                        ["Estado", estadoInfo.texto],
                        ["Fecha cancelación", estadoInfo.fechaCancelacion],
                        ["Origen", origen],
                        ["Catálogo", p.catalogo || "—"],
                        ["Cliente", p.cliente || "—"],
                        ["Instagram", p.instagram || "—"],
                        ["DNI", p.dni || "—"],
                        ["Correo", p.correo || "—"],
                        ["Teléfono", p.telefono || "—"],
                        ["Método entrega", p.metodoEntrega || "—"],
                        ["Dirección", obtenerDireccionResumida(p)],
                        ["Fecha pedido", fechaPedido],
                        ["Total", `$${Number(p.total) || 0}`],
                    ],
                    theme: "plain",
                });

                y = pdfDoc.lastAutoTable.finalY + 8;

                autoTable(pdfDoc, {
                    startY: y,
                    head: [["Producto", "Autor", "Colección", "Cant.", "Precio", "Subtotal"]],
                    body:
                        p.productos?.map(prod => [
                            prod?.titulo || "—",
                            prod?.autor || "—",
                            prod?.coleccion || prod?.categoria || "—",
                            Number(prod?.cantidad) || 0,
                            `$${Number(prod?.precioUnitario) || 0}`,
                            `$${Number(prod?.subtotal) || 0}`,
                        ]) || [["—", "—", "—", 0, "$0", "$0"]],
                });

                y = pdfDoc.lastAutoTable.finalY + 15;
                if (y > 270) {
                    pdfDoc.addPage();
                    y = 30;
                }
            });

            pdfDoc.save(
                formato.includes("UltimoMes")
                    ? "pedidos_ultimo_mes.pdf"
                    : "lista_pedidos.pdf"
            );
        }

        // ---------- EXCEL ----------
        if (formato.includes("excel")) {
            const filas = [];

            listaFuente.forEach(p => {
                const estadoInfo = obtenerEstadoPedido(p);
                const origen = obtenerNombreOrigen(p.sourceCollection);
                const fechaPedido = formatearFecha(
                    p.fechaObj ?? p.fecha ?? p.createdAt ?? p.fechaCreacion ?? p.created_at ?? p.timestamp
                );
                const productos = Array.isArray(p.productos) ? p.productos : [];

                if (productos.length === 0) {
                    filas.push({
                        PedidoId: p.id || "",
                        Estado: estadoInfo.texto,
                        FechaCancelacion: estadoInfo.fechaCancelacion,
                        Origen: origen,
                        Catalogo: p.catalogo || "",
                        Cliente: p.cliente || "",
                        Instagram: p.instagram || "",
                        DNI: p.dni || "",
                        Correo: p.correo || "",
                        Telefono: p.telefono || "",
                        Fecha: fechaPedido,
                        MetodoEntrega: p.metodoEntrega || "",
                        Direccion: p.direccion || "",
                        Departamento: p.departamento || "",
                        Ciudad: p.ciudad || "",
                        CodigoPostal: p.codigoPostal || "",
                        Producto: "",
                        AutorProducto: "",
                        ColeccionProducto: "",
                        Cantidad: "",
                        PrecioUnitario: "",
                        Subtotal: "",
                        Total: Number(p.total) || 0,
                    });
                    return;
                }

                productos.forEach((prod, i) => {
                    filas.push({
                        PedidoId: p.id || "",
                        Estado: estadoInfo.texto,
                        FechaCancelacion: estadoInfo.fechaCancelacion,
                        Origen: origen,
                        Catalogo: p.catalogo || "",
                        Cliente: p.cliente || "",
                        Instagram: p.instagram || "",
                        DNI: p.dni || "",
                        Correo: p.correo || "",
                        Telefono: p.telefono || "",
                        Fecha: fechaPedido,
                        MetodoEntrega: p.metodoEntrega || "",
                        Direccion: p.direccion || "",
                        Departamento: p.departamento || "",
                        Ciudad: p.ciudad || "",
                        CodigoPostal: p.codigoPostal || "",
                        Producto: prod?.titulo || "",
                        AutorProducto: prod?.autor || "",
                        ColeccionProducto: prod?.coleccion || prod?.categoria || "",
                        Cantidad: Number(prod?.cantidad) || 0,
                        PrecioUnitario: Number(prod?.precioUnitario) || 0,
                        Subtotal: Number(prod?.subtotal) || 0,
                        Total: i === 0 ? Number(p.total) || 0 : "",
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
        const pdfDoc = new jsPDF({ orientation: "portrait" });
        const estadoInfo = obtenerEstadoPedido(pedido);
        const origen = obtenerNombreOrigen(pedido?.sourceCollection);
        const fechaPedido = formatearFecha(
            pedido?.fechaObj ?? pedido?.fecha ?? pedido?.createdAt ?? pedido?.fechaCreacion ?? pedido?.created_at ?? pedido?.timestamp
        );

        // Logo
        try {
            const img = new Image();
            img.src = logo;
            await new Promise(res => img.onload = res);
            pdfDoc.addImage(img, "PNG", 15, 10, 25, 25);
        } catch (e) {
            console.warn("No se pudo cargar el logo");
        }

        let y = 45;

        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(20);
        pdfDoc.text("Comprobante de Pedido", 105, 25, { align: "center" });

        pdfDoc.setDrawColor(160);
        pdfDoc.line(15, 35, 195, 35);

        autoTable(pdfDoc, {
            startY: y,
            body: [
                ["Pedido ID", pedido?.id || "No disponible"],
                ["Estado", estadoInfo.texto],
                ["Fecha cancelación", estadoInfo.fechaCancelacion],
                ["Origen", origen],
                ["Catálogo", pedido?.catalogo || "No disponible"],
                ["Fecha pedido", fechaPedido],
                ["Total", `$${Number(pedido?.total) || 0}`],
            ],
            theme: "grid",
            styles: { fontSize: 10 },
            margin: { left: 15, right: 15 },
            headStyles: { fillColor: estadoInfo.cancelado ? [185, 28, 28] : [22, 163, 74] },
        });

        y = pdfDoc.lastAutoTable.finalY + 8;

        // -------- DATOS CLIENTE --------
        pdfDoc.setFontSize(12);
        pdfDoc.text("Datos del Cliente:", 15, y);
        y += 8;

        autoTable(pdfDoc, {
            startY: y,
            body: [
                ["Nombre", pedido?.cliente || "No disponible"],
                ["Correo", pedido?.correo || "No disponible"],
                ["Teléfono", pedido?.telefono || "No disponible"],
                ["Instagram", pedido?.instagram || "No disponible"],
                ["DNI", pedido?.dni || "No disponible"],
                ["Método de entrega", pedido?.metodoEntrega || "No disponible"],
            ],
            theme: "plain",
            styles: { fontSize: 11 },
            margin: { left: 15, right: 15 },
        });

        y = pdfDoc.lastAutoTable.finalY + 8;

        // -------- DIRECCIÓN --------
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("Dirección de Envío:", 15, y);
        y += 8;

        autoTable(pdfDoc, {
            startY: y,
            body: [
                ["Dirección", pedido?.direccion || "No disponible"],
                ["Ciudad", pedido?.ciudad || "No disponible"],
                ["Código Postal", pedido?.codigoPostal || "No disponible"],
                ["Departamento", pedido?.departamento || "No disponible"],
            ],
            theme: "plain",
            styles: { fontSize: 11 },
            margin: { left: 15, right: 15 },
        });

        y = pdfDoc.lastAutoTable.finalY + 8;

        // -------- PRODUCTOS --------
        const productos = pedido.productos?.map(p => [
            p?.titulo || "—",
            p?.autor || "—",
            p?.coleccion || p?.categoria || "—",
            Number(p?.cantidad) || 0,
            `$${Number(p?.precioUnitario) || 0}`,
            `$${Number(p?.subtotal) || 0}`
        ]) || [["—", "—", "—", 0, "$0", "$0"]];

        autoTable(pdfDoc, {
            startY: y,
            head: [["Producto", "Autor", "Colección", "Cantidad", "Precio", "Subtotal"]],
            body: productos,
            theme: "grid",
            styles: { fontSize: 11 },
            headStyles: { fillColor: [120, 120, 120] },
            margin: { left: 15, right: 15 },
            didDrawPage: () => {
                pdfDoc.setFontSize(10);
                pdfDoc.text("Comprobante de Pedido", 105, 290, { align: "center" });
            }
        });

        y = pdfDoc.lastAutoTable.finalY + 10;

        // -------- TOTAL (SIEMPRE VISIBLE) --------
        if (y > 270) {
            pdfDoc.addPage();
            y = 30;
        }

        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(14);
        pdfDoc.text(`TOTAL: $${Number(pedido?.total) || 0}`, 15, y);

        pdfDoc.save(`comprobante_pedido_${pedido?.id || "sin_id"}.pdf`);
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

            {/* Selector de Colecciones de Pedidos */}
            <div className="colecciones-selector">
                <button
                    className={`coleccion-btn ${filtroColeccion === "todos" ? "activa" : ""}`}
                    onClick={() => setFiltroColeccion("todos")}
                >
                    📋 Todos
                </button>
                <button
                    className={`coleccion-btn ${filtroColeccion === "pedidos" ? "activa" : ""}`}
                    onClick={() => setFiltroColeccion("pedidos")}
                >
                    🎵 Drops
                </button>
                <button
                    className={`coleccion-btn ${filtroColeccion === "pedidosTienda" ? "activa" : ""}`}
                    onClick={() => setFiltroColeccion("pedidosTienda")}
                >
                    🏪 Tienda
                </button>
                <button
                    className={`coleccion-btn ${filtroColeccion === "pedidosEquipamiento" ? "activa" : ""}`}
                    onClick={() => setFiltroColeccion("pedidosEquipamiento")}
                >
                    🎛️ Equipamiento
                </button>
            </div>

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

            {accionMsg && (
                <div className="accion-mensaje" style={{
                    padding: "12px 16px",
                    margin: "12px 0",
                    borderRadius: "8px",
                    backgroundColor: accionMsg.includes("❌") ? "rgba(220, 38, 38, 0.1)" : "rgba(34, 197, 94, 0.1)",
                    borderLeft: `4px solid ${accionMsg.includes("❌") ? "#dc2626" : "#22c55e"}`,
                    color: accionMsg.includes("❌") ? "#fca5a5" : "#86efac",
                }}>
                    {accionMsg}
                </div>
            )}

            <div className="cards-container">
                {pedidosFiltrados.map(pedido => (
                    <div key={pedido.id} className={`pedido-card ${pedido.cancelado ? "cancelado" : ""}`}>

                        {pedido.cancelado && (
                            <div className="pedido-cancelado-overlay">
                                <span className="cancelado-badge">❌ CANCELADO</span>
                                {pedido.canceladoAt && (
                                    <span className="cancelado-fecha">
                                        Cancelado: {new Date(pedido.canceladoAt).toLocaleDateString('es-AR')}
                                    </span>
                                )}
                            </div>
                        )}

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

                        <button
                            className="cancel-btn"
                            title={pedido.cancelado ? "Pedido ya cancelado" : "Cancelar pedido y revertir stock"}
                            onClick={() => handleCancelarPedido(pedido)}
                            disabled={pedido.cancelado || cancelandoId === pedido.id}
                        >
                            {cancelandoId === pedido.id ? "⏳" : pedido.cancelado ? "❌" : "🗑️"}
                        </button>

                        <div className="pedido-header">
                            <h3>{pedido.cliente || "No disponible"}</h3>
                            <span className="pedido-fecha">
                                {pedido.fecha || "No disponible"}
                            </span>
                            <span className={`pedido-coleccion-badge pedido-${pedido.sourceCollection}`}>
                                {pedido.sourceCollection === "pedidos" && "🎵 Drop"}
                                {pedido.sourceCollection === "pedidosTienda" && "🏪 Tienda"}
                                {pedido.sourceCollection === "pedidosEquipamiento" && "🎛️ Equipamiento"}
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

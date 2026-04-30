import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    query,
    runTransaction,
    where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import { normalizarFecha } from "../utils/fechas";
import "../styles/adminPedidosCatalogos.css";

function mapPedidoDoc(doc, collectionName) {
    const data = doc.data();
    const fechaObj = normalizarFecha(data.fecha ?? data.createdAt ?? data.created_at);

    return {
        id: doc.id,
        uniqueId: `${collectionName}:${doc.id}`,
        sourceCollection: collectionName,
        fechaObj,
        ...data,
    };
}

function normalizarNombre(nombre) {
    return String(nombre || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function getDefaultProductCollection(orderCollectionName) {
    if (orderCollectionName === "pedidosTienda") return "productosTienda";
    if (orderCollectionName === "pedidosEquipamiento") return "equipamiento";
    return "productosTienda";
}

async function resolveProductDocRef(productoPedido, defaultCollectionName) {
    const productCollection = ["productosTienda", "equipamiento"].includes(productoPedido?.coleccion)
        ? productoPedido.coleccion
        : defaultCollectionName;

    const candidateIds = [
        productoPedido?.id,
        productoPedido?.productoId,
        productoPedido?.docId,
        normalizarNombre(productoPedido?.titulo),
    ].filter(Boolean);

    for (const id of candidateIds) {
        const ref = doc(db, productCollection, String(id));
        const snap = await getDoc(ref);
        if (snap.exists()) return ref;
    }

    if (productoPedido?.titulo) {
        const byTitle = query(
            collection(db, productCollection),
            where("titulo", "==", productoPedido.titulo),
            limit(1),
        );
        const result = await getDocs(byTitle);
        if (!result.empty) return result.docs[0].ref;
    }

    return null;
}

function beepOnce() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "triangle";
        osc.frequency.value = 880;
        gain.gain.value = 0.02;

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        setTimeout(() => {
            osc.stop();
            audioCtx.close();
        }, 280);
    } catch (error) {
        console.error("No se pudo reproducir la alerta:", error);
    }
}

function PedidoCard({ pedido, onCancel, cancelando }) {
    const isCancelado = Boolean(pedido?.cancelado);

    return (
        <div className="apc-card">
            <div className="apc-card-head">
                <h4>{pedido.cliente || "No disponible"}</h4>
                <div className="apc-card-head-right">
                    {isCancelado && <span className="apc-cancelado-badge">Cancelado</span>}
                    <span>{pedido.fecha || "Sin fecha"}</span>
                </div>
            </div>

            <div className="apc-card-grid">
                <p><strong>Correo:</strong> {pedido.correo || "No disponible"}</p>
                <p><strong>Teléfono:</strong> {pedido.telefono || "No disponible"}</p>
                <p><strong>Instagram:</strong> {pedido.instagram || "No disponible"}</p>
                <p><strong>Entrega:</strong> {pedido.metodoEntrega || "No disponible"}</p>
                <p><strong>Ciudad:</strong> {pedido.ciudad || "No disponible"}</p>
                <p><strong>Dirección:</strong> {pedido.direccion || "No disponible"}</p>
            </div>

            <div className="apc-productos">
                <h5>Productos</h5>
                {pedido.productos?.map((prod, idx) => (
                    <div key={`${pedido.uniqueId}-${idx}`} className="apc-producto-row">
                        <span>{prod.titulo}</span>
                        <span>{prod.cantidad} x ${prod.precioUnitario} = ${prod.subtotal}</span>
                    </div>
                ))}
            </div>

            <div className="apc-total">
                <strong>Total:</strong> ${pedido.total ?? 0}
            </div>

            <div className="apc-card-actions">
                <button
                    className="apc-btn-cancelar-pedido"
                    onClick={() => onCancel(pedido)}
                    disabled={cancelando || isCancelado}
                >
                    {isCancelado ? "Pedido cancelado" : cancelando ? "Cancelando..." : "Cancelar pedido"}
                </button>
            </div>
        </div>
    );
}

function normalizarTexto(valor) {
    return String(valor || "").toLowerCase().trim();
}

function cumpleFiltroFecha(fechaObj, filtroFecha) {
    if (filtroFecha === "todos") return true;
    const fecha = fechaObj instanceof Date ? fechaObj : new Date(fechaObj);
    if (Number.isNaN(fecha.getTime())) return false;

    const ahora = new Date();

    if (filtroFecha === "hoy") {
        return fecha.toDateString() === ahora.toDateString();
    }

    if (filtroFecha === "ultimos7") {
        const limite = new Date();
        limite.setDate(ahora.getDate() - 7);
        return fecha >= limite;
    }

    if (filtroFecha === "ultimos30") {
        const limite = new Date();
        limite.setDate(ahora.getDate() - 30);
        return fecha >= limite;
    }

    if (filtroFecha === "mesActual") {
        return (
            fecha.getFullYear() === ahora.getFullYear()
            && fecha.getMonth() === ahora.getMonth()
        );
    }

    return true;
}

function ordenarPedidos(lista, orden) {
    const copia = [...lista];

    if (orden === "masReciente") {
        return copia.sort((a, b) => b.fechaObj - a.fechaObj);
    }
    if (orden === "menosReciente") {
        return copia.sort((a, b) => a.fechaObj - b.fechaObj);
    }
    if (orden === "mayorTotal") {
        return copia.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    }
    if (orden === "menorTotal") {
        return copia.sort((a, b) => (Number(a.total) || 0) - (Number(b.total) || 0));
    }

    return copia;
}

export default function AdminPedidosCatalogos() {
    const navigate = useNavigate();
    const [pedidosTienda, setPedidosTienda] = useState([]);
    const [pedidosEquipamiento, setPedidosEquipamiento] = useState([]);
    const [pedidosEquipamientoLegacy, setPedidosEquipamientoLegacy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [filtroColeccion, setFiltroColeccion] = useState("todos");
    const [filtroEstado, setFiltroEstado] = useState("todos");
    const [filtroEntrega, setFiltroEntrega] = useState("todos");
    const [filtroFecha, setFiltroFecha] = useState("todos");
    const [orden, setOrden] = useState("masReciente");
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
    const [alertaActiva, setAlertaActiva] = useState(false);
    const [nuevosPedidos, setNuevosPedidos] = useState(0);
    const [cancelandoId, setCancelandoId] = useState(null);
    const [accionMsg, setAccionMsg] = useState("");
    const [mostrarMenuDescarga, setMostrarMenuDescarga] = useState(false);

    const initializedRef = useRef({
        pedidosTienda: false,
        pedidosEquipamiento: false,
        equipamientoLegacy: false,
    });
    const intervalRef = useRef(null);
    const menuDescargaRef = useRef(null);

    useEffect(() => {
        const unsubTienda = onSnapshot(collection(db, "pedidosTienda"), (snapshot) => {
            const docs = snapshot.docs
                .map((doc) => mapPedidoDoc(doc, "pedidosTienda"))
                .sort((a, b) => b.fechaObj - a.fechaObj);

            if (initializedRef.current.pedidosTienda) {
                const added = snapshot.docChanges().filter((c) => c.type === "added").length;
                if (added > 0) {
                    setNuevosPedidos((prev) => prev + added);
                    setAlertaActiva(true);
                }
            }

            initializedRef.current.pedidosTienda = true;
            setPedidosTienda(docs);
            setLoading(false);
        });

        const unsubEquipamiento = onSnapshot(collection(db, "pedidosEquipamiento"), (snapshot) => {
            const docs = snapshot.docs
                .map((doc) => mapPedidoDoc(doc, "pedidosEquipamiento"))
                .sort((a, b) => b.fechaObj - a.fechaObj);

            if (initializedRef.current.pedidosEquipamiento) {
                const added = snapshot.docChanges().filter((c) => c.type === "added").length;
                if (added > 0) {
                    setNuevosPedidos((prev) => prev + added);
                    setAlertaActiva(true);
                }
            }

            initializedRef.current.pedidosEquipamiento = true;
            setPedidosEquipamiento(docs);
            setLoading(false);
        });

        const unsubEquipamientoLegacy = onSnapshot(collection(db, "equipamiento"), (snapshot) => {
            const docs = snapshot.docs
                .map((doc) => mapPedidoDoc(doc, "equipamiento"))
                .filter((pedido) => Array.isArray(pedido.productos) && pedido.productos.length > 0)
                .sort((a, b) => b.fechaObj - a.fechaObj);

            if (initializedRef.current.equipamientoLegacy) {
                const added = snapshot
                    .docChanges()
                    .filter((c) => c.type === "added")
                    .map((c) => c.doc.data())
                    .filter((data) => Array.isArray(data.productos) && data.productos.length > 0).length;
                if (added > 0) {
                    setNuevosPedidos((prev) => prev + added);
                    setAlertaActiva(true);
                }
            }

            initializedRef.current.equipamientoLegacy = true;
            setPedidosEquipamientoLegacy(docs);
            setLoading(false);
        });

        return () => {
            unsubTienda();
            unsubEquipamiento();
            unsubEquipamientoLegacy();
        };
    }, []);

    useEffect(() => {
        if (!alertaActiva) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        beepOnce();
        intervalRef.current = setInterval(() => {
            beepOnce();
        }, 2500);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [alertaActiva]);

    useEffect(() => {
        const onClickOutside = (event) => {
            if (menuDescargaRef.current && !menuDescargaRef.current.contains(event.target)) {
                setMostrarMenuDescarga(false);
            }
        };

        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const handleSilenciar = () => {
        setAlertaActiva(false);
        setNuevosPedidos(0);
    };

    const handleCancelarPedido = async (pedido) => {
        if (pedido?.cancelado) {
            setAccionMsg("Este pedido ya estaba cancelado.");
            return;
        }

        const confirmacion = window.confirm(
            "Se cancelara este pedido y se devolvera stock (reservados) de sus productos. Continuar?",
        );
        if (!confirmacion) return;

        setCancelandoId(pedido.uniqueId);
        setAccionMsg("");

        try {
            const defaultProductCollection = getDefaultProductCollection(pedido.sourceCollection);
            const orderRef = doc(db, pedido.sourceCollection, pedido.id);
            const ajustesStock = [];

            for (const producto of pedido.productos || []) {
                const cantidadComprada = Number(producto?.cantidad) || 0;
                if (cantidadComprada <= 0) continue;

                const productRef = await resolveProductDocRef(producto, defaultProductCollection);
                if (!productRef) {
                    throw new Error(`No se encontro producto para "${producto?.titulo || "sin titulo"}".`);
                }

                ajustesStock.push({
                    ref: productRef,
                    cantidadComprada,
                    titulo: producto?.titulo || "sin titulo",
                });
            }

            await runTransaction(db, async (tx) => {
                const pedidoSnap = await tx.get(orderRef);
                if (!pedidoSnap.exists()) {
                    throw new Error("El pedido no existe o fue eliminado.");
                }

                const dataPedido = pedidoSnap.data();
                if (dataPedido?.cancelado) {
                    throw new Error("already-cancelled");
                }

                for (const ajuste of ajustesStock) {
                    const productSnap = await tx.get(ajuste.ref);
                    if (!productSnap.exists()) {
                        throw new Error(`El producto "${ajuste.titulo}" no existe.`);
                    }

                    const reservadosActual = Number(productSnap.data()?.reservados) || 0;
                    const reservadosActualizados = Math.max(0, reservadosActual - ajuste.cantidadComprada);

                    tx.update(ajuste.ref, { reservados: reservadosActualizados });
                }

                tx.update(orderRef, {
                    cancelado: true,
                    estado: "cancelado",
                    canceladoAt: new Date().toISOString(),
                });
            });

            setAccionMsg("Pedido cancelado correctamente. Stock revertido y pedido bloqueado.");
        } catch (error) {
            console.error("Error al cancelar pedido:", error);
            if (String(error?.message) === "already-cancelled") {
                setAccionMsg("Este pedido ya fue cancelado previamente.");
            } else {
                setAccionMsg("No se pudo cancelar el pedido. Revisa los datos de productos.");
            }
        } finally {
            setCancelandoId(null);
        }
    };

    const pedidosEquipamientoBase = useMemo(
        () => (pedidosEquipamiento.length > 0
            ? pedidosEquipamiento
            : pedidosEquipamientoLegacy),
        [pedidosEquipamiento, pedidosEquipamientoLegacy],
    );

    const todosPedidos = useMemo(
        () => ordenarPedidos([...pedidosTienda, ...pedidosEquipamientoBase], "masReciente"),
        [pedidosTienda, pedidosEquipamientoBase],
    );

    const metodosEntregaDisponibles = useMemo(() => {
        return Array.from(
            new Set(todosPedidos.map((p) => p.metodoEntrega).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b));
    }, [todosPedidos]);

    const filtrarPedidos = (lista) => {
        const textoBusqueda = normalizarTexto(busqueda);

        const filtrados = lista.filter((pedido) => {
            const camposTexto = [
                pedido.cliente,
                pedido.correo,
                pedido.telefono,
                pedido.instagram,
                pedido.ciudad,
                pedido.direccion,
                pedido.codigoPostal,
                pedido.metodoEntrega,
                pedido.total,
                ...(pedido.productos || []).map((prod) => prod.titulo),
            ]
                .map((valor) => normalizarTexto(valor))
                .join(" ");

            const cumpleBusqueda = !textoBusqueda || camposTexto.includes(textoBusqueda);
            const isCancelado = Boolean(pedido.cancelado);
            const cumpleEstado =
                filtroEstado === "todos"
                    ? true
                    : filtroEstado === "cancelados"
                        ? isCancelado
                        : !isCancelado;
            const cumpleEntrega =
                filtroEntrega === "todos"
                    ? true
                    : pedido.metodoEntrega === filtroEntrega;
            const cumpleFecha = cumpleFiltroFecha(pedido.fechaObj, filtroFecha);

            return cumpleBusqueda && cumpleEstado && cumpleEntrega && cumpleFecha;
        });

        return ordenarPedidos(filtrados, orden);
    };

    const tiendaFiltrados = useMemo(
        () => filtrarPedidos(pedidosTienda),
        [pedidosTienda, busqueda, filtroEstado, filtroEntrega, filtroFecha, orden],
    );

    const equipamientoFiltrados = useMemo(() => {
        const listaBase = pedidosEquipamientoBase;

        return filtrarPedidos(listaBase);
    }, [pedidosEquipamientoBase, busqueda, filtroEstado, filtroEntrega, filtroFecha, orden]);

    const pedidosVisibles = useMemo(
        () => [...tiendaFiltrados, ...equipamientoFiltrados],
        [tiendaFiltrados, equipamientoFiltrados],
    );

    const construirFilasExcel = (lista) => {
        const filas = [];

        lista.forEach((pedido) => {
            const origen = pedido.sourceCollection === "pedidosTienda" ? "Tienda" : "Equipamiento";
            const estado = pedido.cancelado ? "Cancelado" : "Activo";
            const productos = Array.isArray(pedido.productos) ? pedido.productos : [];

            if (productos.length === 0) {
                filas.push({
                    Origen: origen,
                    Estado: estado,
                    PedidoId: pedido.id,
                    Catalogo: pedido.catalogo || "",
                    Cliente: pedido.cliente || "",
                    Instagram: pedido.instagram || "",
                    DNI: pedido.dni || "",
                    Correo: pedido.correo || "",
                    Telefono: pedido.telefono || "",
                    Fecha: pedido.fecha || "",
                    MetodoEntrega: pedido.metodoEntrega || "",
                    Direccion: pedido.direccion || "",
                    Departamento: pedido.departamento || "",
                    Ciudad: pedido.ciudad || "",
                    CodigoPostal: pedido.codigoPostal || "",
                    Total: Number(pedido.total) || 0,
                    Producto: "",
                    CategoriaProducto: "",
                    ColeccionProducto: "",
                    Cantidad: "",
                    PrecioUnitario: "",
                    Subtotal: "",
                });
                return;
            }

            productos.forEach((prod, index) => {
                filas.push({
                    Origen: origen,
                    Estado: estado,
                    PedidoId: pedido.id,
                    Catalogo: pedido.catalogo || "",
                    Cliente: pedido.cliente || "",
                    Instagram: pedido.instagram || "",
                    DNI: pedido.dni || "",
                    Correo: pedido.correo || "",
                    Telefono: pedido.telefono || "",
                    Fecha: pedido.fecha || "",
                    MetodoEntrega: pedido.metodoEntrega || "",
                    Direccion: pedido.direccion || "",
                    Departamento: pedido.departamento || "",
                    Ciudad: pedido.ciudad || "",
                    CodigoPostal: pedido.codigoPostal || "",
                    Total: index === 0 ? Number(pedido.total) || 0 : "",
                    Producto: prod.titulo || "",
                    CategoriaProducto: prod.categoria || "",
                    ColeccionProducto: prod.coleccion || "",
                    Cantidad: Number(prod.cantidad) || 0,
                    PrecioUnitario: Number(prod.precioUnitario) || 0,
                    Subtotal: Number(prod.subtotal) || 0,
                });
            });
        });

        return filas;
    };

    const exportarExcel = (lista, nombreBase) => {
        if (!lista.length) {
            alert("No hay pedidos para descargar con el filtro actual.");
            return;
        }

        const filas = construirFilasExcel(lista);
        const ws = XLSX.utils.json_to_sheet(filas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

        const fecha = new Date();
        const stamp = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
        XLSX.writeFile(wb, `${nombreBase}-${stamp}.xlsx`);
    };

    const handleDescargarExcel = (tipo) => {
        if (tipo === "visibles") exportarExcel(pedidosVisibles, "pedidos-visibles");
        if (tipo === "tienda") exportarExcel(tiendaFiltrados, "pedidos-tienda");
        if (tipo === "equipamiento") exportarExcel(equipamientoFiltrados, "pedidos-equipamiento");
        if (tipo === "cancelados") {
            exportarExcel(pedidosVisibles.filter((p) => p.cancelado), "pedidos-cancelados");
        }
        if (tipo === "activos") {
            exportarExcel(pedidosVisibles.filter((p) => !p.cancelado), "pedidos-activos");
        }
        if (tipo === "todos") exportarExcel(todosPedidos, "pedidos-todos");

        setMostrarMenuDescarga(false);
    };

    if (loading) {
        return <p className="admin-loader">Cargando pedidos en tiempo real...</p>;
    }

    return (
        <div className="apc-container">
            <div className="apc-header">
                <h1>Pedidos de Tienda + Equipamiento</h1>
                <button className="apc-back-btn" onClick={() => navigate("/admin")}>Volver al Panel</button>
            </div>

            <div className="apc-toolbar">
                <div className="apc-toolbar-group apc-toolbar-group-search">
                    <label className="apc-filter-label" htmlFor="apc-search-input">🔎 Buscar</label>
                    <input
                        id="apc-search-input"
                        type="text"
                        className="apc-search"
                        placeholder="Cliente, correo, tel, ciudad, producto..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="apc-toolbar-group apc-toolbar-group-filters">
                    <div className="apc-filter-header">
                        <label className="apc-filter-label">🧩 Filtros</label>
                        <button
                            type="button"
                            className={`apc-toggle-filters-btn ${filtrosAbiertos ? "open" : ""}`}
                            onClick={() => setFiltrosAbiertos((prev) => !prev)}
                        >
                            <span>{filtrosAbiertos ? "Ocultar" : "Mostrar"}</span>
                            <span className="apc-toggle-filters-icon">▾</span>
                        </button>
                    </div>

                    <div className={`apc-filters-grid ${filtrosAbiertos ? "open" : "collapsed"}`}>
                        <select value={filtroColeccion} onChange={(e) => setFiltroColeccion(e.target.value)} className="apc-select">
                            <option value="todos">📦 Coleccion: ambas</option>
                            <option value="tienda">📦 Solo Tienda</option>
                            <option value="equipamiento">📦 Solo Equipamiento</option>
                        </select>

                        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="apc-select">
                            <option value="todos">🟢 Estado: todos</option>
                            <option value="activos">🟢 Estado: activos</option>
                            <option value="cancelados">🟢 Estado: cancelados</option>
                        </select>

                        <select value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} className="apc-select">
                            <option value="todos">📅 Fecha: todo</option>
                            <option value="hoy">📅 Fecha: hoy</option>
                            <option value="ultimos7">📅 Ultimos 7 dias</option>
                            <option value="ultimos30">📅 Ultimos 30 dias</option>
                            <option value="mesActual">📅 Mes actual</option>
                        </select>

                        <select value={filtroEntrega} onChange={(e) => setFiltroEntrega(e.target.value)} className="apc-select">
                            <option value="todos">🚚 Entrega: todos</option>
                            {metodosEntregaDisponibles.map((metodo) => (
                                <option key={metodo} value={metodo}>{`🚚 ${metodo}`}</option>
                            ))}
                        </select>

                        <select value={orden} onChange={(e) => setOrden(e.target.value)} className="apc-select">
                            <option value="masReciente">↕️ Orden: mas reciente</option>
                            <option value="menosReciente">↕️ Orden: menos reciente</option>
                            <option value="mayorTotal">↕️ Orden: mayor total</option>
                            <option value="menorTotal">↕️ Orden: menor total</option>
                        </select>
                    </div>
                </div>

                <div className="apc-toolbar-group apc-toolbar-group-actions">
                    <label className="apc-filter-label">📥 Exportar</label>
                    <div className="apc-download-wrap" ref={menuDescargaRef}>
                        <button
                            className="apc-download-icon-btn"
                            title="Descargar en Excel"
                            onClick={() => setMostrarMenuDescarga((prev) => !prev)}
                        >
                            ⬇️
                        </button>

                        {mostrarMenuDescarga && (
                            <div className="apc-download-menu">
                                <button onClick={() => handleDescargarExcel("visibles")}>Excel visibles</button>
                                <button onClick={() => handleDescargarExcel("tienda")}>Excel tienda</button>
                                <button onClick={() => handleDescargarExcel("equipamiento")}>Excel equipamiento</button>
                                <button onClick={() => handleDescargarExcel("activos")}>Excel activos</button>
                                <button onClick={() => handleDescargarExcel("cancelados")}>Excel cancelados</button>
                                <button onClick={() => handleDescargarExcel("todos")}>Excel todos</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {accionMsg && <p className="apc-accion-msg">{accionMsg}</p>}

            {alertaActiva && (
                <div className="apc-alerta">
                    <p>Nuevo pedido detectado ({nuevosPedidos}). Sonido activo.</p>
                    <button onClick={handleSilenciar}>Silenciar alerta</button>
                </div>
            )}

            <div className="apc-columns">
                {filtroColeccion !== "equipamiento" && (
                    <section className="apc-box">
                        <div className="apc-box-head">
                            <h2>Tienda</h2>
                            <span>{tiendaFiltrados.length} pedidos</span>
                        </div>

                        <div className="apc-list">
                            {tiendaFiltrados.length === 0 ? (
                                <p className="apc-empty">No hay pedidos para mostrar.</p>
                            ) : (
                                tiendaFiltrados.map((pedido) => (
                                    <PedidoCard
                                        key={pedido.uniqueId}
                                        pedido={pedido}
                                        onCancel={handleCancelarPedido}
                                        cancelando={cancelandoId === pedido.uniqueId}
                                    />
                                ))
                            )}
                        </div>
                    </section>
                )}

                {filtroColeccion !== "tienda" && (
                    <section className="apc-box">
                        <div className="apc-box-head">
                            <h2>Equipamiento</h2>
                            <span>{equipamientoFiltrados.length} pedidos</span>
                        </div>

                        <div className="apc-list">
                            {equipamientoFiltrados.length === 0 ? (
                                <p className="apc-empty">No hay pedidos para mostrar.</p>
                            ) : (
                                equipamientoFiltrados.map((pedido) => (
                                    <PedidoCard
                                        key={pedido.uniqueId}
                                        pedido={pedido}
                                        onCancel={handleCancelarPedido}
                                        cancelando={cancelandoId === pedido.uniqueId}
                                    />
                                ))
                            )}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

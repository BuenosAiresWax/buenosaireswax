import { useEffect, useRef, useState, useContext, useMemo } from "react";
import { doc, setDoc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { CartContext } from "../context/CartContext";
import { getCartItemKey, getCatalogConfig, getProductCollectionName } from "../utils/catalog";
import '../styles/PurchaseModal.css'

function PurchaseModal({ onClose, catalogKey = "drop" }) {
    const backdropRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const [nombre, setNombre] = useState("");
    const [nombreInstagram, setNombreInstagram] = useState("");
    const [dni, setDni] = useState("");
    const [telefono, setTelefono] = useState("");
    const [correo, setCorreo] = useState("");
    const [direccion, setDireccion] = useState("");
    const [departamento, setDepartamento] = useState("");
    const [ciudad, setCiudad] = useState("");
    const [codigoPostal, setCodigoPostal] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [productosAgotados, setProductosAgotados] = useState([]);
    const [pedidoId, setPedidoId] = useState("");
    const [fechaPedido, setFechaPedido] = useState("");
    const [pedidoEnviado, setPedidoEnviado] = useState(false);
    const [confirmado, setConfirmado] = useState(false);
    const [mensajeWsp, setMensajeWsp] = useState("");
    const [ultimoTotal, setUltimoTotal] = useState(0);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [metodoEntrega, setMetodoEntrega] = useState("");

    const modalContentRef = useRef(null);
    const modalRef = useRef(null);

    const { cartItems, clearCartByCollection, removeFromCart } = useContext(CartContext);
    const catalog = getCatalogConfig(catalogKey);
    const cartItemsByCatalog = useMemo(
        () => cartItems.filter(
            (item) => getProductCollectionName(item) === catalog.collectionName,
        ),
        [cartItems, catalog.collectionName],
    );
    const total = cartItemsByCatalog.reduce((acc, item) => {
        const precio = Number(item?.precio) || 0;
        const cantidad = Number(item?.cantidad) || 0;
        return acc + precio * cantidad;
    }, 0);

    useEffect(() => {
        setTimeout(() => setVisible(true), 10);
        if (cartItemsByCatalog.length > 0) {
            checkStockAgotado();
        } else {
            setProductosAgotados([]);
        }
        const totalGuardado = localStorage.getItem("ultimoTotalPedido");
        if (totalGuardado) setUltimoTotal(Number(totalGuardado));
    }, [pedidoEnviado, cartItemsByCatalog]);

    const normalizarNombre = (nombre) =>
        nombre.trim().toLowerCase().replace(/\s+/g, "-");

    const getProductRef = (item) => {
        const docId = item?.id ? String(item.id) : normalizarNombre(item?.titulo || "");
        return doc(db, getProductCollectionName(item), docId);
    };

    const checkStockAgotado = async () => {
        const agotados = [];
        for (const item of cartItemsByCatalog) {
            const ref = getProductRef(item);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const { cantidad = 0, reservados = 0 } = snap.data();
                const stockDisponible = cantidad - reservados;
                if (stockDisponible <= 0 || stockDisponible < item.cantidad) {
                    agotados.push(getCartItemKey(item));
                }
            } else {
                agotados.push(getCartItemKey(item));
            }
        }
        setProductosAgotados(agotados);
    };

    const eliminarProductosAgotados = async () => {
        const nuevosAgotados = [];
        for (const item of cartItemsByCatalog) {
            const ref = getProductRef(item);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const { cantidad = 0, reservados = 0 } = snap.data();
                const stockDisponible = cantidad - reservados;
                if (stockDisponible <= 0 || stockDisponible < item.cantidad) {
                    nuevosAgotados.push(getCartItemKey(item));
                }
            } else {
                nuevosAgotados.push(getCartItemKey(item));
            }
        }
        nuevosAgotados.forEach((cartKey) => {
            const producto = cartItemsByCatalog.find((item) => getCartItemKey(item) === cartKey);
            if (!producto) return;

            for (let i = 0; i < producto.cantidad; i += 1) {
                removeFromCart(producto);
            }
        });
        setProductosAgotados(nuevosAgotados);
        setError(null);
    };

    const validarStock = async () => {
        for (const item of cartItemsByCatalog) {
            const ref = getProductRef(item);
            const snap = await getDoc(ref);
            if (!snap.exists()) return `El producto "${item.titulo}" ya no existe.`;
            const { cantidad = 0, reservados = 0 } = snap.data();
            const stockDisponible = cantidad - reservados;
            if (stockDisponible < item.cantidad) {
                return `El producto "${item.titulo}" no tiene suficiente stock.`;
            }
        }
        return null;
    };

    const reservarProductos = async () => {
        for (const item of cartItemsByCatalog) {
            const ref = getProductRef(item);
            await updateDoc(ref, { reservados: increment(item.cantidad) });
        }
    };

    const guardarPedido = async (docId, fecha) => {
        const pedido = {
            cliente: nombre,
            instagram: nombreInstagram,
            dni,
            telefono,
            correo,
            direccion: metodoEntrega.includes("Retiro") ? "" : direccion,
            departamento,
            ciudad,
            codigoPostal,
            metodoEntrega, // << nuevo campo agregado
            catalogo: catalog.key,
            productos: cartItemsByCatalog.map((p) => ({
                titulo: p.titulo || "Producto sin nombre",
                categoria: p.categoria,
                coleccion: getProductCollectionName(p),
                cantidad: Number(p.cantidad) || 0,
                precioUnitario: Number(p.precio) || 0,
                subtotal: (Number(p.precio) || 0) * (Number(p.cantidad) || 0),
            })),
            total,
            fecha,
        };
        await setDoc(doc(db, catalog.orderCollectionName, docId), pedido);
    };

    const generarDocId = (nombre) => {
        const now = new Date();
        const fechaId = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}${now.getMinutes()}`;
        return `pedido-${normalizarNombre(nombre)}-${fechaId}`;
    };

    const handleClickOutside = (e) => {
        if (e.target === backdropRef.current) {
            handleClose();
        }
    };

    const cerrarModal = () => {
        setVisible(false);
        setTimeout(() => {
            onClose();
            setNombre("");
            setNombreInstagram("");
            setDni("");
            setTelefono("");
            setCorreo("");
            setDireccion("");
            setDepartamento("");
            setCiudad("");
            setCodigoPostal("");
            setError(null);
            setProductosAgotados([]);
            setPedidoId("");
            setFechaPedido("");
            setPedidoEnviado(false);
            setConfirmado(false);
            setMensajeWsp("");
            setLoading(false);
            setUltimoTotal(0);
            localStorage.removeItem("ultimoTotalPedido");
        }, 200);
    };

    const handleClose = () => {
        if (pedidoEnviado) {
            setShowCloseConfirm(true); // solo si ya se generó el pedido
            return;
        }

        cerrarModalDefinitivo();
    };

    const cerrarModalDefinitivo = () => {
        setVisible(false);
        setTimeout(() => {
            onClose();
            setNombre("");
            setNombreInstagram("");
            setDni("");
            setTelefono("");
            setCorreo("");
            setDireccion("");
            setDepartamento("");
            setCiudad("");
            setCodigoPostal("");
            setError(null);
            setProductosAgotados([]);
            setPedidoId("");
            setFechaPedido("");
            setPedidoEnviado(false);
            setConfirmado(false);
            setMensajeWsp("");
            setLoading(false);
            setUltimoTotal(0);
            localStorage.removeItem("ultimoTotalPedido");
        }, 200);
    };

    const copiarMensajeAlPortapapeles = async () => {
        try {
            await navigator.clipboard.writeText(mensajeWsp);
            alert("Mensaje copiado al portapapeles ✅");
        } catch {
            alert("No se pudo copiar el mensaje.");
        }
    };

    const enviarPedidoYRedirigirWsp = async () => {
        setLoading(true);
        setError(null);

        if (!metodoEntrega) {
            setError("Seleccioná un método de entrega.");
            setLoading(false);
            return;
        }

        if (cartItemsByCatalog.length === 0) {
            setError("No hay productos en el carrito para esta tienda.");
            setLoading(false);
            return;
        }

        const esRetiro = metodoEntrega.includes("Retiro");

        if (!esRetiro && (!direccion.trim() || !ciudad.trim() || !codigoPostal.trim())) {
            setError("Completá los datos de envío.");
            setLoading(false);
            return;
        }

        if (!confirmado) {
            setError("Debes confirmar que enviarás el comprobante.");
            setLoading(false);
            return;
        }

        const docId = generarDocId(nombre);
        const fecha = new Intl.DateTimeFormat("es-AR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date());

        try {
            const errorStock = await validarStock();
            if (errorStock) {
                setError(errorStock);
                setLoading(false);
                return;
            }

            await guardarPedido(docId, fecha);
            await reservarProductos();
            localStorage.setItem("ultimoTotalPedido", total.toString());
            clearCartByCollection(catalog.collectionName);

            const mensajeWhatsApp = `
¡Hola BAWAX! Realicé un pedido.
🏪 Tienda: ${catalog.label}
🧾 ID del Pedido: ${docId}
📌 Fecha: ${fecha}
👤 Nombre: ${nombre} - ${dni}
📧 Email: ${correo}
📱 Teléfono: ${telefono}
📦 Método de entrega: ${metodoEntrega}
${!esRetiro ? `🏠 Dirección: ${direccion}${departamento ? `, (${departamento})` : " (casa)"}, ${ciudad} (${codigoPostal})` : ""}
🛒 Productos:
${cartItemsByCatalog.map((p) => `- ${Number(p?.cantidad) || 0} x ${p?.titulo || "Producto sin nombre"} [${getProductCollectionName(p)}] ($${(Number(p?.precio) || 0) * (Number(p?.cantidad) || 0)})`).join("\n")}
💰 Total: $${total}
👉 Adjuntar el comprobante de pago.
        `.trim();

            setPedidoEnviado(true);
            setPedidoId(docId);
            setFechaPedido(fecha);
            setMensajeWsp(mensajeWhatsApp);
            setUltimoTotal(total);
            setLoading(false);
        } catch (err) {
            setError("Hubo un error al enviar el pedido.");
            setLoading(false);
        }
    };

    const obtenerLinkDePagoLibre = () => "https://link.mercadopago.com.ar/buenosaireswax";

    useEffect(() => {
        if (showCloseConfirm) {
            // Scroll al inicio del modal
            if (modalContentRef.current) {
                modalContentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }

            // Bloquear scroll global y del modal
            document.body.style.overflow = "hidden";
            if (modalRef.current) {
                modalRef.current.style.overflow = "hidden";
            }
        } else {
            // Restaurar scroll global y del modal
            document.body.style.overflow = "";
            if (modalRef.current) {
                modalRef.current.style.overflow = "auto";
            }
        }

        return () => {
            document.body.style.overflow = "";
            if (modalRef.current) {
                modalRef.current.style.overflow = "auto";
            }
        };
    }, [showCloseConfirm]);

    return (
        <div className={`modal-backdrop ${visible ? "visible" : ""}`} ref={backdropRef} onClick={handleClickOutside}>
            <div className={`modal ${visible ? "fade-in" : "fade-out"}`} ref={modalRef}>
                <div className="modal-content" ref={modalContentRef}>
                    <button className="close" onClick={handleClose}>×</button>
                    {pedidoEnviado ? (
                        <>
                            <h2 className="modalTitle">✅ Pedido generado</h2>
                            <p className="modalText">Finalizá tu compra: solo 2 pasos</p>
                            <p className="modalText">🧾 Número de orden:<br /><strong>{pedidoId}</strong></p>
                            <p className="modalText">
                                <strong>Total del pedido:</strong><br />
                                <span className="totalCheckout">
                                    ${ultimoTotal.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                            </p>
                            {/* Texto 1 */}
                            <div className="info-box">
                                <span>1</span> Ingresa el monto de tu orden, completá el pago y descarga el comprobante.
                            </div>

                            {/*                             <a href={obtenerLinkDePagoLibre()} target="_blank" rel="noopener noreferrer" className="btn-pago">
                                💳 Pagar con Mercado Pago
                            </a> */}

                            <div className="infoPagoContainer">
                                <p>Datos de deposito</p>
                                <p>Alias: BuenosAiresWax</p>
                                <p>Titular: Gonzalo Lijtenberg</p>
                            </div>

                            {/* Texto 2 */}
                            <div className="info-box">
                                <span>2</span>Envia el pedido generado y el comprobante de pago descargado.
                            </div>

                            <button
                                className="btn-whatsapp-succes"
                                onClick={() =>
                                    window.open(`https://wa.me/5491165825180?text=${encodeURIComponent(mensajeWsp)}`, "_blank")
                                }
                            >
                                📲 Enviar pedido por WhatsApp
                            </button>

                            {/* Texto final */}
                            <div className="info-box">
                                ¡Listo! Nos contactaremos para mantenerte al tanto de todo.
                            </div>

                            <button className="btn-copiar" onClick={copiarMensajeAlPortapapeles}>
                                Copiar pedido 📋
                            </button>

                            <p className="modalText">Buenos Aires Wax</p>
                        </>
                    ) : (
                        <>
                            <h2 className="modalTitle">Resumen del pedido</h2>

                            <ul className="modal-product-list">
                                {cartItemsByCatalog.map((item) => (
                                    <li
                                        key={item.cartKey || getCartItemKey(item)}
                                        className={`modal-product-item ${productosAgotados.includes(getCartItemKey(item)) ? "agotado" : ""}`}
                                    >
                                        <div className="pedidoCarrito">
                                            <img className="imagenCarrito" src={item.imagen} alt="" />
                                            <div>
                                                <strong>{item?.titulo || "Producto sin nombre"}</strong> <br />
                                                {Number(item?.cantidad) || 0}u  <strong>${(Number(item?.precio) || 0) * (Number(item?.cantidad) || 0)}</strong>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item)}
                                            className="delete-btn"
                                            title="Quitar del carrito"
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            {productosAgotados.length > 0 && (
                                <>
                                    <p className="productoAgotadoMensaje">
                                        Algunos productos están agotados. Podés eliminarlos para continuar.
                                    </p>
                                    <button onClick={eliminarProductosAgotados} className="btn-eliminar-agotados">
                                        Eliminar productos agotados
                                    </button>
                                </>
                            )}

                            <div className="totalContainer">
                                <strong>Total:</strong> ${total.toLocaleString("es-AR", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                })}
                            </div>

                            <p className="modalText">Formulario de Compra</p>

                            <form
                                className="form"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    enviarPedidoYRedirigirWsp();
                                }}
                            >
                                <input
                                    type="text"
                                    placeholder="Nombre"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                <input
                                    type="text"
                                    placeholder="Intagram @"
                                    value={nombreInstagram}
                                    onChange={(e) => setNombreInstagram(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                <input
                                    type="number"
                                    placeholder="DNI"
                                    value={dni}
                                    onChange={(e) => setDni(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                <input
                                    type="tel"
                                    placeholder="Teléfono"
                                    value={telefono}
                                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
                                    required
                                    disabled={loading}
                                />
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={correo}
                                    onChange={(e) => setCorreo(e.target.value)}
                                    required
                                    disabled={loading}
                                />

                                <label className="metodo-entrega-label">
                                    Método de entrega:
                                    <select
                                        value={metodoEntrega}
                                        onChange={(e) => setMetodoEntrega(e.target.value)}
                                        required
                                        disabled={loading}
                                    >
                                        <option value="" disabled>Seleccioná un medio de entrega</option>
                                        <option value="Envío a domicilio (Andreani)">Envío a domicilio (Andreani)</option>
                                    </select>
                                </label>

                                {metodoEntrega === "Envío a domicilio (Andreani)" && (

                                    <>
                                        <input
                                            type="text"
                                            placeholder="Calle y numero"
                                            value={direccion}
                                            onChange={(e) => setDireccion(e.target.value)}
                                            required
                                            disabled={loading}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Ciudad"
                                            value={ciudad}
                                            onChange={(e) => setCiudad(e.target.value)}
                                            required
                                            disabled={loading}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Código Postal"
                                            value={codigoPostal}
                                            onChange={(e) => setCodigoPostal(e.target.value)}
                                            required
                                            disabled={loading}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Piso y Departamento (opcional)"
                                            value={departamento}
                                            onChange={(e) => setDepartamento(e.target.value)}
                                            disabled={loading}
                                        />
                                    </>
                                )}

                                {error && <p className="form-error">{error}</p>}

                                <p className="modalText">
                                    Su pedido será armado y aparecerá listo para ser enviado por WhatsApp.
                                </p>

                                <div className="checkbox-confirmacion">
                                    <input
                                        type="checkbox"
                                        id="confirmacion"
                                        checked={confirmado}
                                        onChange={() => setConfirmado(!confirmado)}
                                        disabled={loading}
                                    />
                                    <label htmlFor="confirmacion">Confirmo enviar comprobante</label>
                                </div>

                                <button
                                    className="btn-crear-orden"
                                    type="submit"
                                    disabled={loading || productosAgotados.length > 0 || cartItemsByCatalog.length === 0}
                                >
                                    {loading ? "Procesando..." : "Crear orden"}
                                </button>
                            </form>
                        </>
                    )}

                    {showCloseConfirm && (
                        <div className={`confirm-overlay fade-in`}>
                            <div className="confirm-box">
                                <h3>Tu pedido fue generado.</h3>
                                <p>Recuerda completar los pasos anteriores para finalizar tu compra</p>
                                <p>
                                    ⚠️ <span>
                                        Al cerrar esta ventana no verás más los datos de pedido y pago.
                                    </span>⚠️
                                </p>
                                <div className="confirm-actions">
                                    <button className="btn-cancelar" onClick={() => setShowCloseConfirm(false)}>Cancelar</button>
                                    <button className="btn-confirmar" onClick={cerrarModalDefinitivo}>Sí, cerrar</button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default PurchaseModal;

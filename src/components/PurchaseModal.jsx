import { useEffect, useRef, useState, useContext } from "react";
import { doc, setDoc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { CartContext } from "../context/CartContext";

function PurchaseModal({ onClose }) {
    const backdropRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [correo, setCorreo] = useState("");
    const [direccion, setDireccion] = useState("");
    const [departamento, setDepartamento] = useState(""); // NUEVO CAMPO
    const [ciudad, setCiudad] = useState("");
    const [codigoPostal, setCodigoPostal] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [productosAgotados, setProductosAgotados] = useState([]);
    const [pedidoId, setPedidoId] = useState("");
    const [fechaPedido, setFechaPedido] = useState("");
    const [pedidoEnviado, setPedidoEnviado] = useState(false);
    const [confirmado, setConfirmado] = useState(false);


    const { cartItems, clearCart, removeFromCart } = useContext(CartContext);
    const total = cartItems.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

    useEffect(() => {
        setTimeout(() => setVisible(true), 10);
        checkStockAgotado();
    }, []);

    const normalizarNombre = (nombre) => nombre.trim().toLowerCase().replace(/\s+/g, "-");

    const checkStockAgotado = async () => {
        const agotados = [];
        for (const item of cartItems) {
            const ref = doc(db, "productos", normalizarNombre(item.titulo));
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const { cantidad = 0, reservados = 0 } = snap.data();
                const stockDisponible = cantidad - reservados;
                if (stockDisponible <= 0 || stockDisponible < item.cantidad) {
                    agotados.push(item.id);
                }
            } else {
                agotados.push(item.id);
            }
        }
        setProductosAgotados(agotados);
    };

    const eliminarProductosAgotados = async () => {
        const nuevosAgotados = [];

        for (const item of cartItems) {
            const ref = doc(db, "productos", normalizarNombre(item.titulo));
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const { cantidad = 0, reservados = 0 } = snap.data();
                const stockDisponible = cantidad - reservados;
                if (stockDisponible <= 0 || stockDisponible < item.cantidad) {
                    nuevosAgotados.push(item.id);
                }
            } else {
                nuevosAgotados.push(item.id);
            }
        }

        // Eliminar del carrito solo los que realmente siguen agotados
        nuevosAgotados.forEach((id) => removeFromCart(id));
        setProductosAgotados(nuevosAgotados); // actualiza la lista con la más reciente
        setError(null);
    };

    const validarStock = async () => {
        for (const item of cartItems) {
            const ref = doc(db, "productos", normalizarNombre(item.titulo));
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                return `El producto "${item.titulo}" ya no existe.`;
            }
            const { cantidad = 0, reservados = 0 } = snap.data();
            const stockDisponible = cantidad - reservados;
            if (stockDisponible < item.cantidad) {
                return `El producto "${item.titulo}" no tiene suficiente stock. Disponible: ${stockDisponible}, Solicitado: ${item.cantidad}`;
            }
        }
        return null;
    };

    const reservarProductos = async () => {
        for (const item of cartItems) {
            const ref = doc(db, "productos", normalizarNombre(item.titulo));
            await updateDoc(ref, { reservados: increment(item.cantidad) });
        }
    };

    const guardarPedido = async (docId, fecha) => {
        const pedido = {
            cliente: nombre,
            telefono,
            correo,
            direccion,
            departamento, // Guardamos departamento también
            ciudad,
            codigoPostal,
            productos: cartItems.map((p) => ({
                titulo: p.titulo,
                categoria: p.categoria,
                cantidad: p.cantidad,
                precioUnitario: p.precio,
                subtotal: p.precio * p.cantidad,
            })),
            total,
            fecha,
        };
        await setDoc(doc(db, "pedidos", docId), pedido);
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

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => onClose(), 200);
    };

    const enviarPedidoYRedirigirWsp = async () => {
        setLoading(true);
        setError(null);

        if (productosAgotados.length > 0) {
            setError("Revisá tus productos agotados antes de continuar.");
            setLoading(false);
            return;
        }

        if (!direccion.trim() || !ciudad.trim() || !codigoPostal.trim()) {
            setError("Por favor, completá todos los datos de envío.");
            setLoading(false);
            return;
        }

        if (!confirmado) {
            setError("Debes confirmar que enviarás el comprobante antes de continuar.");
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
            clearCart();

            setPedidoEnviado(true);
            setPedidoId(docId);
            setFechaPedido(fecha);
            setLoading(false);

            // Mensaje WhatsApp con departamento opcional incluido
            const mensajeWhatsApp = `
            ¡Hola BAWAX! Realicé una pedido en la tienda.
            🧾 ID del Pedido: ${docId}
            📌 Fecha: ${fecha}
            👤 Nombre: ${nombre}
            📧 Email: ${correo}
            📱 Teléfono: ${telefono}
            --------------------------
            🏠 Dirección de envío: ${direccion}${departamento ? `, (${departamento})` : " (casa)"}, ${ciudad} (${codigoPostal})
            --------------------------
            🛒 Productos:
            ${cartItems.map(p => `- ${p.cantidad} x ${p.titulo} ($${p.precio * p.cantidad})`).join("\n")}
            💰 Total: $${total}

            👉 Adjunto el comprobante de pago para continuar con la confirmación del pedido.
            --------------------------
        `.trim();

            const url = `https://wa.me/541130504515?text=${encodeURIComponent(mensajeWhatsApp)}`;
            window.open(url, "_blank");
        } catch (err) {
            console.error("Error al enviar pedido:", err);
            setError("Hubo un error al enviar el pedido. Intente nuevamente.");
            setLoading(false);
        }
    };

    return (
        <div className={`modal-backdrop ${visible ? "visible" : ""}`} ref={backdropRef} onClick={handleClickOutside}>
            <div className={`modal ${visible ? "fade-in" : "fade-out"}`}>
                <button className="close" onClick={handleClose}>×</button>
                <div className="modal-content">
                    <h2 className="modalTitle">Resumen del pedido</h2>
                    <p className="modalText">Verificá los productos antes de confirmar</p>

                    <ul className="modal-product-list">
                        {cartItems.map((item) => (
                            <li key={item.id} className={`modal-product-item ${productosAgotados.includes(item.id) ? "agotado" : ""}`}>
                                <div>
                                    <strong>{item.titulo}</strong> <br />
                                    {item.cantidad} x ${item.precio} = <strong>${item.precio * item.cantidad}</strong>
                                </div>
                                <button onClick={() => removeFromCart(item.id)} className="delete-btn" title="Quitar del carrito">×</button>
                            </li>
                        ))}
                    </ul>

                    {productosAgotados.length > 0 && (
                        <>
                            <p className="productoAgotadoMensaje">Debido a la alta demanda, algunos productos están agotados. Puedes eliminarlos rápidamente para continuar con tu compra sin inconvenientes.</p>
                            <button onClick={eliminarProductosAgotados} className="btn-eliminar-agotados">Eliminar productos agotados</button>
                        </>
                    )}

                    <div className="totalContainer">
                        <strong>Total:</strong> ${total}
                    </div>

                    <p className="modalText">Al completar y enviar este formulario, usted confirma su intención de realizar la compra. Nos contactaremos a la brevedad</p>

                    <p className="modalText">Formulario de Compra</p>

                    <form className="form" onSubmit={(e) => { e.preventDefault(); enviarPedidoYRedirigirWsp(); }}>
                        <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required disabled={loading} />
                        <input type="tel" placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))} required disabled={loading} />
                        <input type="email" placeholder="Email" value={correo} onChange={(e) => setCorreo(e.target.value)} required disabled={loading} />
                        <input type="text" placeholder="Dirección de envío" value={direccion} onChange={(e) => setDireccion(e.target.value)} required disabled={loading} />
                        <input
                            type="text"
                            placeholder="Piso y Departamento (opcional)"
                            value={departamento}
                            onChange={(e) => setDepartamento(e.target.value)}
                            disabled={loading}
                        />
                        <input type="text" placeholder="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} required disabled={loading} />
                        <input type="text" placeholder="Código Postal" value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} required disabled={loading} />
                        {error && <p className="form-error">{error}</p>}
                        <p className="modalText">Su pedido sera armado y aparecera listo para ser enviado por WhatsApp. Adjuntar comprobante de pago.</p>
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
                        <button className="btn-whatsapp" type="submit" disabled={loading || productosAgotados.length > 0}>
                            {loading ? "Enviando..." : "Enviar pedido por WhatsApp"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default PurchaseModal;

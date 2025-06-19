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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [productosAgotados, setProductosAgotados] = useState([]);

    const { cartItems, clearCart, removeFromCart } = useContext(CartContext);

    const total = cartItems.reduce(
        (acc, item) => acc + item.precio * item.cantidad,
        0
    );

    useEffect(() => {
        setTimeout(() => setVisible(true), 10);
    }, []);

    const normalizarNombre = (nombre) =>
        nombre.trim().toLowerCase().replace(/\s+/g, "-");

    // Verifica si hay productos con stockDisponible 0 o menor a cantidad pedida
    const checkStockAgotado = async () => {
        const agotados = [];
        for (const item of cartItems) {
            const ref = doc(db, "productos", normalizarNombre(item.titulo));
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const { cantidad = 0, reservados = 0 } = snap.data();
                const stockDisponible = cantidad - reservados;
                // Si stockDisponible es 0 o menor que cantidad pedida => está agotado o insuficiente
                if (stockDisponible <= 0 || stockDisponible < item.cantidad) {
                    agotados.push(item.id);
                }
            } else {
                // Producto no existe => también lo consideramos agotado
                agotados.push(item.id);
            }
        }
        setProductosAgotados(agotados);
    };

    useEffect(() => {
        checkStockAgotado();
    }, [cartItems]);

    const eliminarProductosAgotados = () => {
        productosAgotados.forEach(id => removeFromCart(id));
        setProductosAgotados([]);
        setError(null);
    };

    // Validación final al enviar pedido (también con lógica correcta)
    const validarStock = async () => {
        for (const item of cartItems) {
            const ref = doc(db, "productos", normalizarNombre(item.titulo));
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                return `El producto "${item.titulo}" ya no existe.`;
            }

            const { cantidad = 0, reservados = 0 } = snap.data();
            const stockDisponible = cantidad - reservados;

            // Stock disponible debe ser mayor o igual a la cantidad solicitada
            if (stockDisponible < item.cantidad) {
                return `El producto "${item.titulo}" no tiene suficiente stock.\nDisponible: ${stockDisponible}, Solicitado: ${item.cantidad}`;
            }
        }
        return null;
    };

    const reservarProductos = async () => {
        for (const item of cartItems) {
            const ref = doc(db, "productos", normalizarNombre(item.titulo));
            await updateDoc(ref, {
                reservados: increment(item.cantidad)
            });
        }
    };

    const guardarPedido = async (docId, fecha) => {
        const pedido = {
            cliente: nombre,
            telefono,
            correo,
            productos: cartItems.map(p => ({
                titulo: p.titulo,
                categoria: p.categoria,
                cantidad: p.cantidad,
                precioUnitario: p.precio,
                subtotal: p.precio * p.cantidad
            })),
            total,
            fecha
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
        setTimeout(() => {
            onClose();
        }, 200);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (productosAgotados.length > 0) {
            setError("Revisá tus productos agotados antes de continuar.");
            setLoading(false);
            return;
        }

        const docId = generarDocId(nombre);
        const fecha = new Intl.DateTimeFormat('es-AR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
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
            alert("Nos comunicaremos a la brevedad. ¡Gracias por tu compra!");
            handleClose();
        } catch (err) {
            console.error("Error al enviar pedido:", err);
            setError("Hubo un error al enviar el pedido. Intente nuevamente.");
            setLoading(false);
        }
    };

    return (
        <div
            className={`modal-backdrop ${visible ? "visible" : ""}`}
            ref={backdropRef}
            onClick={handleClickOutside}
        >
            <div className={`modal ${visible ? "fade-in" : "fade-out"}`}>
                <button className="close" onClick={handleClose}>×</button>
                <div className="modal-content">
                    <h2 className="modalTitle">Resumen del pedido</h2>
                    <p className="modalText">Verificá los productos antes de confirmar:</p>

                    <ul className="modal-product-list">
                        {cartItems.map((item) => {
                            const estaAgotado = productosAgotados.includes(item.id);
                            return (
                                <li
                                    key={item.id}
                                    className={`modal-product-item ${estaAgotado ? "agotado" : ""}`}
                                >
                                    <div>
                                        <strong>{item.titulo}</strong> <br />
                                        {item.cantidad} x ${item.precio} = <strong>${item.precio * item.cantidad}</strong>
                                    </div>

                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="delete-btn"
                                        title="Quitar del carrito"
                                    >
                                        ×
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {productosAgotados.length > 0 && (
                        <>
                            <p className="productoAgotadoMensaje">
                                Debido a la alta demanda, algunos productos están agotados. Puedes eliminarlos rápidamente para continuar con tu compra sin inconvenientes.</p>
                            <button onClick={eliminarProductosAgotados} className="btn-eliminar-agotados">
                                Eliminar productos agotados
                            </button>
                        </>
                    )}

                    <div className="totalContainer">
                        <strong>Total:</strong> ${total}
                    </div>

                    <form onSubmit={handleSubmit} className="form">
                        <input
                            type="text"
                            placeholder="Nombre"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            required
                            disabled={loading}
                        />
                        <input
                            type="tel"
                            placeholder="Teléfono"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
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
                        {error && <p className="form-error">{error}</p>}
                        <button type="submit" disabled={loading || productosAgotados.length > 0}>
                            {loading ? "Enviando..." : (productosAgotados.length > 0 ? "Revisá tus productos" : "Confirmar pedido")}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default PurchaseModal;

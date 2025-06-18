import { useEffect, useRef, useState, useContext } from "react";
import { doc, setDoc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { CartContext } from "../context/CartContext";

function PurchaseModal({ onClose, refetchProductos }) {
    const backdropRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [correo, setCorreo] = useState("");
    const [loading, setLoading] = useState(false);

    const { cartItems, clearCart, removeFromCart } = useContext(CartContext);

    const total = cartItems.reduce(
        (acc, item) => acc + item.precio * item.cantidad,
        0
    );

    useEffect(() => {
        setTimeout(() => setVisible(true), 10);
    }, []);

    const handleClickOutside = (e) => {
        if (e.target === backdropRef.current) {
            handleClose();
        }
    };

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => {
            if (typeof refetchProductos === "function") {
                refetchProductos();
            }
            onClose();
        }, 200);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const now = new Date();
        const fechaId = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}${now.getMinutes()}`;
        const fecha = new Intl.DateTimeFormat('es-AR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(now);

        const nombreNormalizado = nombre.trim().toLowerCase().replace(/\s+/g, "-");
        const docId = `pedido-${nombreNormalizado}-${fechaId}`;

        try {
            for (const item of cartItems) {
                const ref = doc(db, "productos", item.titulo.trim().toLowerCase().replace(/\s+/g, "-"));
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    alert(`El producto ${item.titulo} ya no existe.`);
                    handleClose();
                    return;
                }
                const data = snap.data();
                const cantidad = data.cantidad ?? 0;
                const reservados = data.reservados ?? 0;
                if (cantidad !== 0 && reservados >= cantidad) {
                    alert(`El producto ${item.titulo} ya no está disponible.`);
                    handleClose();
                    return;
                }
            }

            await setDoc(doc(db, "pedidos", docId), {
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
            });

            for (const item of cartItems) {
                const ref = doc(db, "productos", item.titulo.trim().toLowerCase().replace(/\s+/g, "-"));
                await updateDoc(ref, {
                    reservados: increment(item.cantidad)
                });
            }

            alert("Nos comunicaremos a la brevedad. ¡Gracias por tu compra!");
            clearCart();
            // Actualizo productos aquí justo después de limpiar carrito
            if (typeof refetchProductos === "function") {
                await refetchProductos();
            }
            handleClose();
        } catch (error) {
            console.error("Error al enviar pedido:", error);
            alert("Hubo un error al enviar el pedido.");
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
                        {cartItems.map((item) => (
                            <li key={item.id} className="modal-product-item">
                                <div>
                                    <strong>{item.titulo}</strong> ({item.categoria})<br />
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
                        ))}
                    </ul>

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
                        <button type="submit" disabled={loading}>
                            {loading ? "Enviando..." : "Confirmar pedido"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default PurchaseModal;

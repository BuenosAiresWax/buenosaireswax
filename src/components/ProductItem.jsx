import { useContext, useEffect, useState } from "react";
import { CartContext } from "../context/CartContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

import FaqModal from "./FaqModal";

import '../styles/ProductItem.css'

function ProductItem({ producto: productoProp, mostrarMensaje }) {
    const { cartItems, addToCart, removeFromCart } = useContext(CartContext);
    const [producto, setProducto] = useState(productoProp);
    const [mostrarFaq, setMostrarFaq] = useState(false);

    useEffect(() => {
        const ref = doc(db, "productos", productoProp.id);
        const unsubscribe = onSnapshot(ref, (docSnap) => {
            if (docSnap.exists()) {
                setProducto(docSnap.data());
            }
        });
        return () => unsubscribe();
    }, [productoProp.id]);

    const cantidadTotal = producto.cantidad ?? 0;
    const reservados = producto.reservados ?? 0;
    const stockDisponible = Math.max(0, cantidadTotal - reservados);

    const carritoItem = cartItems.find(item => item.id === productoProp.id);
    const cantidadEnCarrito = carritoItem ? carritoItem.cantidad : 0;

    const handleAdd = () => {
        if (cantidadEnCarrito >= stockDisponible) {
            mostrarMensaje("Límite stock disponible");
            return;
        }
        addToCart(productoProp);
        mostrarMensaje("Producto añadido al carrito");
    };

    const handleRemove = () => {
        removeFromCart(productoProp.id);
        mostrarMensaje("Producto eliminado del carrito");
    };

    return (
        <div className="product-card">
            <div className="image">
                <img src={producto.imagen} alt={producto.titulo} />
                {producto.escucha && (
                    <a
                        href={producto.escucha}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="play-button"
                        title="Escuchar"
                    >
                        ▶
                    </a>
                )}
            </div>

            <div className="info">
                <div className="itemTitleContainer">
                    <h3
                        style={
                            stockDisponible <= 0
                                ? { textDecoration: "line-through", color: "#888" }
                                : {}
                        }
                    >
                        {producto.titulo}
                    </h3>
                    <button
                        className="add-button"
                        onClick={handleAdd}
                        title="Agregar al carrito"
                        disabled={stockDisponible <= 0}
                    >
                        {stockDisponible <= 0 ? "×" : "+"}
                    </button>
                </div>
                <p className="price">${producto.precio}</p>
                <p className="description">{producto.descripcion} - {producto.estilo}</p>
                <h4 className="sello">
                    Made by: {producto.sello}
                </h4>

                <div className="stock">
                    Stock: {stockDisponible}
                    {cantidadEnCarrito > 0 && (
                        <span> (En carrito: {cantidadEnCarrito})</span>
                    )}
                </div>
            </div>

            {/* Botón flotante FAQ */}
            <div
                className="faq-button"
                onClick={() => setMostrarFaq(true)}
                title="Preguntas frecuentes"
            >
                i
            </div>

            {mostrarFaq && <FaqModal onClose={() => setMostrarFaq(false)} />}
        </div>
    );
}

export default ProductItem;

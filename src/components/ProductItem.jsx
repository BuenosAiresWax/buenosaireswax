import { useContext, useEffect, useState } from "react";
import { CartContext } from "../context/CartContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

function ProductItem({ producto: productoProp, mostrarMensaje }) {
    const { cartItems, addToCart, removeFromCart } = useContext(CartContext);
    const [producto, setProducto] = useState(productoProp); // estado local en tiempo real

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
        <div className="product-item">
            <div className="image">
                <img src={producto.imagen} alt={producto.titulo} />
            </div>

            <div className="info">
                <h2
                    className="productTitle"
                    style={stockDisponible <= 0 ? { textDecoration: "line-through" } : {}}
                >
                    {producto.titulo}
                </h2>
                <p className="price">${producto.precio}</p>
                <h3 className="description">{producto.descripcion}</h3>
                <p className="sello">Made by: {producto.sello}</p>
                <p className="textoEscucha">🔊 Escucha: <a className="enlaceEscucha" href={producto.escucha} target="_blank" rel="noopener noreferrer">{producto.titulo}</a></p>
            </div>

            <div className="cta">
                <div className="cta-content">
                    <div className="categoria">
                        <span> {producto.autor}</span>
                        <span>{producto.genero}</span>
                        <span>{producto.categoria}</span>
                    </div>

                    <div className="button-row">
                        <button
                            className={`reservarBtn ${stockDisponible <= 0 ? "agotado" : ""}`}
                            style={stockDisponible <= 0 ? { color: "rgb(255 0 0)" } : {}}
                            onClick={handleAdd}
                            disabled={stockDisponible <= 0}
                            title={stockDisponible <= 0 ? "Sin stock disponible" : ""}
                        >
                            {stockDisponible <= 0 ? "AGOTADO" : "Agregar al carrito"}
                        </button>
                        <button
                            className="removeBtn"
                            onClick={handleRemove}
                            title="Quitar del carrito"
                            style={stockDisponible <= 0 ? { color: "#b20000" } : {}}
                        >
                            ×
                        </button>
                    </div>

                    <div className="stock" style={stockDisponible <= 0 ? { color: "red", padding: "4px", borderRadius: "4px" } : {}}>
                        Stock: {stockDisponible}
                        {cantidadEnCarrito > 0 && (
                            <span style={{ marginLeft: "10px", fontWeight: "bold" }}>
                                (En carrito: {cantidadEnCarrito})
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}

export default ProductItem;

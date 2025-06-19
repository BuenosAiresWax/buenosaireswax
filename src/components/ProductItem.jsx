import { useContext } from "react";
import { CartContext } from "../context/CartContext";

function ProductItem({ producto, mostrarMensaje }) {
    const { cartItems, addToCart, removeFromCart } = useContext(CartContext);

    const reservados = producto.reservados ?? 0;
    const stockReal = producto.cantidad - reservados;

    const carritoItem = cartItems.find(item => item.id === producto.id);
    const cantidadEnCarrito = carritoItem ? carritoItem.cantidad : 0;

    const handleAdd = () => {
        if (cantidadEnCarrito >= stockReal) {
            mostrarMensaje("Límite stock disponible");
            return;
        }
        addToCart(producto);
        mostrarMensaje("Producto añadido al carrito");
    };

    const handleRemove = () => {
        removeFromCart(producto.id);
        mostrarMensaje("Producto eliminado del carrito");
    };

    return (
        <div className="product-item">
            <div className="image">
                <img src={producto.imagen} alt={producto.titulo} />
            </div>

            <div className="info">
                <h2 className="productTitle">{producto.titulo}</h2>
                <p className="price">${producto.precio}</p>
                <p className="description">{producto.descripcion}</p>
            </div>

            <div className="cta">
                <div className="cta-content">
                    <div className="categoria">{producto.categoria}</div>

                    <div className="button-row">
                        <button
                            className="reservarBtn"
                            onClick={handleAdd}
                            disabled={stockReal <= 0}
                            title={stockReal <= 0 ? "Sin stock disponible" : ""}
                        >
                            Comprar
                        </button>

                        <button
                            className="removeBtn"
                            onClick={handleRemove}
                            title="Quitar del carrito"
                        >
                            ×
                        </button>
                    </div>

                    <div className="stock">
                        Stock: {stockReal > 0 ? stockReal : 0}
                        {cantidadEnCarrito > 0 && (
                            <span style={{ marginLeft: "10px", fontWeight: "bold" }}>
                                (En carrito: {cantidadEnCarrito})
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProductItem;

import { useContext, useState } from "react";
import { CartContext } from "../context/CartContext";
import {
  getCartItemKey,
  getCatalogConfig,
  getProductCollectionName,
  isCollectionIncludedInCheckout,
} from "../utils/catalog";

import "../styles/CartPopupButton.css";

export default function CartPopupButton({ onOpen, catalogKey = "drop" }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { cartItems, removeFromCart } = useContext(CartContext);
  const catalog = getCatalogConfig(catalogKey);
  const cartItemsByCatalog = cartItems.filter(
    (item) =>
      isCollectionIncludedInCheckout(getProductCollectionName(item), catalogKey),
  );
  const total = cartItemsByCatalog.reduce((sum, item) => {
    const precio = Number(item?.precio) || 0;
    const cantidad = Number(item?.cantidad) || 0;
    return sum + precio * cantidad;
  }, 0);
  const totalQuantity = cartItemsByCatalog.reduce(
    (sum, item) => sum + (Number(item?.cantidad) || 0),
    0,
  );

  const handleCheckout = () => {
    onOpen();
  };

  const handleRemoveItem = (producto) => {
    removeFromCart(producto);
  };

  if (totalQuantity === 0) {
    return null;
  }

  return (
    <div className="cart-popup">
      <div className="cart-popup-header">
        <h3>🛒 Carrito ({totalQuantity})</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`toggle-cart-button ${isExpanded ? "expanded" : "collapsed"}`}
          aria-label={isExpanded ? "Contraer carrito" : "Expandir carrito"}
        >
          ▼
        </button>
      </div>
      {isExpanded && (
        <>
          <div className="cart-items">
            {cartItemsByCatalog.map((item) => (
              <div key={item.cartKey || getCartItemKey(item)} className="cart-item">
                {item?.imagen ? (
                  <img
                    src={item.imagen}
                    alt={item?.titulo || "Producto sin nombre"}
                    className="cart-item-image"
                  />
                ) : null}
                <div className="cart-item-info">
                  <p className="cart-item-name">{item?.titulo || "Producto sin nombre"}</p>
                  <p className="cart-item-price">
                    ${(Number(item?.precio) || 0).toLocaleString("es-AR")}
                  </p>
                  <p className="cart-item-quantity">Cant: {Number(item?.cantidad) || 0}</p>
                </div>
                <button
                  onClick={() => handleRemoveItem(item)}
                  className="cart-item-remove"
                  aria-label={`Eliminar ${item?.titulo || "producto"} del carrito`}
                  title="Eliminar del carrito"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="cart-total">
            <p>Total: ${total.toLocaleString('es-AR')}</p>
          </div>
          <button onClick={handleCheckout} className="checkout-button">
            Finalizar compra
          </button>
        </>
      )}
    </div>
  );
}

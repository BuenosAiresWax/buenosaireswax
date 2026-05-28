import { useContext, useEffect, useState } from "react";
import { CartContext } from "../context/CartContext";
import {
  getCartItemKey,
  getProductCollectionName,
  isCollectionIncludedInCheckout,
} from "../utils/catalog";

import "../styles/CartPopupButton.css";

export default function CartPopupButton({
  onOpen,
  catalogKey = "drop",
  isHidden = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { cartItems, removeFromCart } = useContext(CartContext);
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

  useEffect(() => {
    if (isHidden) {
      setIsExpanded(false);
    }
  }, [isHidden]);

  const handleCheckout = () => {
    setIsExpanded(false);
    onOpen();
  };

  const handleRemoveItem = (producto) => {
    removeFromCart(producto);
  };

  const handleToggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  if (totalQuantity === 0 || isHidden) {
    return null;
  }

  return (
    <div className="cart-popup">
      <div
        className="cart-popup-header"
        onClick={handleToggleExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleToggleExpanded();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isExpanded ? "Contraer carrito" : "Expandir carrito"}
      >
        <h3>🛒 Carrito ({totalQuantity})</h3>
        <span
          className={`toggle-cart-button ${isExpanded ? "expanded" : "collapsed"}`}
          aria-hidden="true"
        >
          ▼
        </span>
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

import { useContext, useState } from "react";
import { CartContext } from "../context/CartContext";

import "../styles/CartPopupButton.css";

export default function CartPopupButton({ onOpen }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { cartItems, removeFromCart, getTotalQuantity } = useContext(CartContext);
  const total = cartItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const totalQuantity = getTotalQuantity();

  const handleCheckout = () => {
    onOpen();
  };

  const handleRemoveItem = (productId) => {
    removeFromCart(productId);
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
            {cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <img src={item.imagen} alt={item.titulo} className="cart-item-image" />
                <div className="cart-item-info">
                  <p className="cart-item-name">{item.titulo}</p>
                  <p className="cart-item-price">${item.precio.toLocaleString('es-AR')}</p>
                  <p className="cart-item-quantity">Cant: {item.cantidad}</p>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="cart-item-remove"
                  aria-label={`Eliminar ${item.titulo} del carrito`}
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

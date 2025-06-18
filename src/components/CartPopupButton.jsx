import { useContext, useEffect, useState } from "react";
import { CartContext } from "../context/CartContext";
import carritoLleno from '../../assets/icons/carrito-lleno.svg';
import carritoVacio from '../../assets/icons/carrito-vacio.svg';

import "../styles/CartPopupButton.css";

export default function CartPopupButton({ onOpen }) {
  const { getTotalQuantity } = useContext(CartContext);
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);

  const totalCantidad = getTotalQuantity();

  useEffect(() => {
    if (totalCantidad > 0) {
      setShouldRender(true);
      setTimeout(() => setVisible(true), 20);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [totalCantidad]);

  if (!shouldRender) return null;

  return (
    <button
      onClick={onOpen}
      aria-label="Abrir carrito"
      title="Abrir carrito"
      className={`cart-popup-button ${visible ? "visible" : "hidden"}`}
    >
      <img
        src={totalCantidad > 0 ? carritoLleno : carritoVacio}
        alt="Carrito"
        className="cart-icon"
      />
      <span className="cart-count">{totalCantidad}</span>
    </button>
  );
}

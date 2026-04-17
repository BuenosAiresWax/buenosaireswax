import { useContext } from "react";
import { Outlet } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import Footer from "./Footer";
import PlayerBar from "../player/PlayerBar";

import logo from "../../assets/logo/header-logo.png";
import carritoVacio from "../../assets/icons/carrito-vacio.svg";
import carritoLleno from "../../assets/icons/carrito-lleno.svg";

function AppLayout() {
  const { getTotalQuantity } = useContext(CartContext);
  const totalCantidad = getTotalQuantity();

  return (
    <div className="app-container" style={{ paddingBottom: "84px" }}>
      <div className="headerContainer">
        <img src={logo} alt="bawax" className="logo" />

        <div className="rightNav">
          <a
            href="https://wa.me/5491165825180?text=Hola%20BaWax%2C%20tengo%20una%20consulta"
            target="_blank"
            rel="noopener noreferrer"
            className="contactoNav"
          >
            CONTACTO
          </a>

          <div
            className="cartIcon"
            onClick={() => {
              if (totalCantidad > 0) {
                // Aquí podrías abrir el modal del carrito si es necesario
              }
            }}
            style={{ cursor: totalCantidad > 0 ? "pointer" : "default" }}
            title={totalCantidad > 0 ? "Ver carrito" : "Carrito vacío"}
          >
            <img
              src={totalCantidad > 0 ? carritoLleno : carritoVacio}
              alt="Carrito"
              className="cartSVG"
            />
            <span className="cartCount">{totalCantidad}</span>
          </div>
        </div>
      </div>

      <Outlet />

      <Footer />

      {/* Player global persistente */}
      <PlayerBar />
    </div>
  );
}

export default AppLayout;
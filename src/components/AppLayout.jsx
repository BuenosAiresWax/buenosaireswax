import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Footer from "./Footer";
import PlayerBar from "../player/PlayerBar";

import logo from "../../assets/logo/header-logo.png";

const ACCESS_VERSION = import.meta.env.VITE_ACCESS_VERSION;

function hasValidAccess() {
  const isAuth = localStorage.getItem("autenticado") === "true";
  const savedVersion = localStorage.getItem("accessVersion");
  return isAuth && savedVersion === ACCESS_VERSION;
}

function AppLayout() {
  const location = useLocation();
  const [autenticado, setAutenticado] = useState(() => hasValidAccess());

  const navItems = [
    { to: "/", label: "Ultimo Drop" },
    { to: "/tienda", label: "Tienda Fisica" },
    { to: "/equipamiento", label: "Equipamiento" },
  ];

  useEffect(() => {
    const syncAuthState = () => setAutenticado(hasValidAccess());

    window.addEventListener("storage", syncAuthState);
    window.addEventListener("bawax-auth-changed", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("bawax-auth-changed", syncAuthState);
    };
  }, []);

  const isDropAccessActive = location.pathname === "/" && !autenticado;

  return (
    <div className="app-container" style={{ paddingBottom: "84px" }}>
      <div className="headerContainer">
        <NavLink to="/" className="logoLink" aria-label="Ir al inicio de BAWAX">
          <img src={logo} alt="bawax" className="logo" />
        </NavLink>

        <nav className="centerNav" aria-label="Navegacion principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `centerNavLink${isActive ? " active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="rightNav">
          <a
            href="https://wa.me/5491165825180?text=Hola%20BaWax%2C%20tengo%20una%20consulta"
            target="_blank"
            rel="noopener noreferrer"
            className="contactoNav"
          >
            CONTACTO
          </a>
        </div>
      </div>

      <Outlet />

      <Footer />

      {/* Player global persistente */}
      {!isDropAccessActive && <PlayerBar />}
    </div>
  );
}

export default AppLayout;
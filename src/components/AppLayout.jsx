import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Footer from "./Footer";
import PlayerBar from "../player/PlayerBar";
import { isDropAccessWindowActive } from "../utils/dropSchedule";

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
    { to: "/drop", label: "Próximo Drop" },
    { to: "/tienda", label: "Tienda de Vinilos" },
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

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const visualViewport = window.visualViewport;

    const updateViewportGap = () => {
      const viewportGap = visualViewport
        ? Math.max(
            0,
            window.innerHeight - visualViewport.height - visualViewport.offsetTop,
          )
        : 0;

      root.style.setProperty(
        "--visual-viewport-bottom-gap",
        `${viewportGap}px`,
      );
    };

    updateViewportGap();

    if (visualViewport) {
      visualViewport.addEventListener("resize", updateViewportGap);
      visualViewport.addEventListener("scroll", updateViewportGap);
    }

    window.addEventListener("resize", updateViewportGap);
    window.addEventListener("orientationchange", updateViewportGap);

    return () => {
      root.style.removeProperty("--visual-viewport-bottom-gap");

      if (visualViewport) {
        visualViewport.removeEventListener("resize", updateViewportGap);
        visualViewport.removeEventListener("scroll", updateViewportGap);
      }

      window.removeEventListener("resize", updateViewportGap);
      window.removeEventListener("orientationchange", updateViewportGap);
    };
  }, []);

  const isDropAccessActive =
    location.pathname === "/" && !autenticado && isDropAccessWindowActive();
  const isEquipamientoRoute =
    location.pathname === "/equipamiento" ||
    location.pathname.startsWith("/equipamiento/");

  return (
    <div
      className="app-container"
      style={{ paddingBottom: "calc(84px + var(--visual-viewport-bottom-gap, 0px))" }}
    >
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
      {!isDropAccessActive && !isEquipamientoRoute && <PlayerBar />}
    </div>
  );
}

export default AppLayout;
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/config";
import ProductList from "./components/ProductList";
import PurchaseModal from "./components/PurchaseModal";
import CartPopupButton from "./components/CartPopupButton";
import DropAccess from "./components/DropAccess";
import HeroSlider from "./components/HeroSlider";
import CatalogPage from "./components/CatalogPage";

import "./styles/styles.css";

import logo from "../assets/logo/header-logo.png";

const ACCESS_VERSION = import.meta.env.VITE_ACCESS_VERSION;

/* ===============================
   FECHA GLOBAL DEL DROP
   (solo cambias esto cada mes)
================================ */

const DROP_DATE = import.meta.env.VITE_DROP_DATE || "2026-04-28T15:20:00";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function App() {
  const [autenticado, setAutenticado] = useState(() => {
    const isAuth = localStorage.getItem("autenticado") === "true";
    const savedVersion = localStorage.getItem("accessVersion");
    return isAuth && savedVersion === ACCESS_VERSION;
  });

  const [productos, setProductos] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [ventanaDropActiva, setVentanaDropActiva] = useState(false);

  useEffect(() => {
    const actualizarVentanaDrop = () => {
      const fechaDrop = new Date(DROP_DATE);
      const ahora = new Date();
      const diferenciaMs = fechaDrop - ahora;
      setVentanaDropActiva(diferenciaMs > 0 && diferenciaMs < THREE_DAYS_MS);
    };

    actualizarVentanaDrop();
    const intervalId = setInterval(actualizarVentanaDrop, 60000);

    return () => clearInterval(intervalId);
  }, []);

  /* --------------------------------
     STRUCTURED DATA (SEO)
  -------------------------------- */
  useEffect(() => {
    const baseUrl = window.location.origin;

    const dropDate = new Date(DROP_DATE);

    const dropMonth = dropDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    const schema = [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: "BAWAX",
        url: baseUrl,
        logo: logo,
        sameAs: [
          "https://www.instagram.com/buenosaireswax/",
          "https://www.youtube.com/@BuenosAiresWax",
        ],
      },

      {
        "@context": "https://schema.org",
        "@type": "MusicStore",
        "@id": `${baseUrl}/#musicstore`,
        name: "BAWAX",
        url: baseUrl,
        parentOrganization: {
          "@id": `${baseUrl}/#organization`,
        },
        description:
          "Discos de vinilo nuevos y usados en Buenos Aires Wax. Drops nuevos cada mes, envíos a todo el país.",
        address: {
          "@type": "PostalAddress",
          addressCountry: "AR",
        },
      },

      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: "Buenos Aires Wax",
        inLanguage: "es-AR",
        publisher: {
          "@id": `${baseUrl}/#organization`,
        },
        about: {
          "@id": `${baseUrl}/#musicstore`,
        },
      },

      {
        "@context": "https://schema.org",
        "@type": "Event",
        "@id": `${baseUrl}/#vinyl-drop`,
        name: `BAWAX Vinyl Drop – ${dropMonth}`,
        description:
          "Nuevo drop mensual de discos de vinilo en Buenos Aires Wax. Ediciones seleccionadas para DJs y coleccionistas.",
        startDate: DROP_DATE,
        endDate: new Date(
          new Date(DROP_DATE).setDate(new Date(DROP_DATE).getDate() + 28),
        ).toISOString(),
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: {
          "@type": "VirtualLocation",
          url: baseUrl,
        },
        organizer: {
          "@id": `${baseUrl}/#organization`,
        },
        image: [`${baseUrl}/social-preview.jpg`],
      },

      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "@id": `${baseUrl}/#drop-list`,
        name: `BAWAX Vinyl Drop – ${dropMonth}`,
        description: "Listado de discos disponibles en el drop.",
        itemListOrder: "https://schema.org/ItemListUnordered",
        numberOfItems: productos.length,
        itemListElement: productos.map((producto, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: producto.nombre || "Vinyl Record",
        })),
      },
    ];

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schema);

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [productos]);

  /* --------------------------------
     FIREBASE PRODUCTS
  -------------------------------- */

  useEffect(() => {
    if (!autenticado) return;

    const unsubscribe = onSnapshot(collection(db, "productos"), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProductos(docs);
    });

    return () => unsubscribe();
  }, [autenticado]);

  /* --------------------------------
     AUTH DROP
  -------------------------------- */

  const manejarAutenticacion = () => {
    setAutenticado(true);

    localStorage.setItem("autenticado", "true");
    localStorage.setItem("accessVersion", ACCESS_VERSION);
    window.dispatchEvent(new Event("bawax-auth-changed"));
  };

  if (!ventanaDropActiva) {
    return (
      <>
        <CatalogPage catalogKey="tienda" />
        <CartPopupButton onOpen={() => setMostrarModal(true)} catalogKey="tienda" />
        {mostrarModal && (
          <PurchaseModal onClose={() => setMostrarModal(false)} catalogKey="tienda" />
        )}
      </>
    );
  }

  if (!autenticado) {
    return (
      <>
        <HeroSlider />
        <DropAccess
          fechaObjetivo={DROP_DATE}
          onAccesoPermitido={manejarAutenticacion}
        />
      </>
    );
  }

  return (
    <>
      <HeroSlider />
      <ProductList catalogKey="drop" />
      <CartPopupButton onOpen={() => setMostrarModal(true)} catalogKey="drop" />
      {mostrarModal && (
        <PurchaseModal onClose={() => setMostrarModal(false)} catalogKey="drop" />
      )}
    </>
  );
}

export default App;

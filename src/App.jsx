import { useEffect, useState, useContext } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase/config";
import { CartContext } from "./context/CartContext";
import ProductList from "./components/ProductList";
import PurchaseModal from "./components/PurchaseModal";
import CartPopupButton from "./components/CartPopupButton";
import LoaderOverlay from "./components/LoaderOverlay";
import Footer from "./components/Footer";
import DropAccess from "./components/DropAccess";
import HeroSlider from "./components/HeroSlider";

import "./styles/styles.css";

import logo from "../assets/logo/header-logo.png";
import carritoVacio from "../assets/icons/carrito-vacio.svg";
import carritoLleno from "../assets/icons/carrito-lleno.svg";

const ACCESS_VERSION = import.meta.env.VITE_ACCESS_VERSION;

/* ===============================
   FECHA GLOBAL DEL DROP
   (solo cambias esto cada mes)
================================ */

const DROP_DATE = "2026-04-14T20:00:00";

function App() {
  const [autenticado, setAutenticado] = useState(() => {
    const isAuth = localStorage.getItem("autenticado") === "true";
    const savedVersion = localStorage.getItem("accessVersion");
    return isAuth && savedVersion === ACCESS_VERSION;
  });

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);

  const { getTotalQuantity } = useContext(CartContext);

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

  const fetchProductos = async () => {
    setLoading(true);

    try {
      const productosRef = collection(db, "productos");

      const snapshot = await getDocs(productosRef);

      const docs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((producto) => {
          const cantidad = producto.cantidad;
          const reservas = producto.reservados ?? 0;

          return cantidad === undefined || reservas < cantidad;
        });

      setProductos(docs);
    } catch (error) {
      console.error("Error al cargar productos", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autenticado) {
      fetchProductos();
    }
  }, [autenticado]);

  /* --------------------------------
     AUTH DROP
  -------------------------------- */

  const manejarAutenticacion = () => {
    setAutenticado(true);

    localStorage.setItem("autenticado", "true");
    localStorage.setItem("accessVersion", ACCESS_VERSION);
  };

  const totalCantidad = getTotalQuantity();

  return (
    <div className="app-container">
      <LoaderOverlay visible={autenticado && loading} />

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
                setMostrarModal(true);
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

      <HeroSlider />

      {!autenticado ? (
        <DropAccess
          fechaObjetivo={DROP_DATE}
          onAccesoPermitido={manejarAutenticacion}
        />
      ) : (
        <ProductList
          productos={productos}
          loading={loading}
          refetchProductos={fetchProductos}
        />
      )}

      <CartPopupButton onOpen={() => setMostrarModal(true)} />

      {mostrarModal && (
        <PurchaseModal
          onClose={() => setMostrarModal(false)}
          refetchProductos={fetchProductos}
        />
      )}

      <Footer />
    </div>
  );
}

export default App;

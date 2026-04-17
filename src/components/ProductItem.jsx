import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { PlayerContext } from "../player/PlayerContext.jsx"; // <-- NUEVO
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

import FaqModal from "./FaqModal";
import "../styles/ProductItem.css";

const HARDCODED_SC_URL = "https://soundcloud.com/forss/flickermood"; // <-- NUEVO (válido)

function ProductItem({ producto: productoProp, mostrarMensaje }) {
  const { cartItems, addToCart, removeFromCart } = useContext(CartContext);
  const player = useContext(PlayerContext);
  const setTrack = player?.setTrack ?? (() => {}); // <-- NUEVO
  const navigate = useNavigate();

  const [producto, setProducto] = useState(productoProp);
  const [mostrarFaq, setMostrarFaq] = useState(false);

  const [showTooltip, setShowTooltip] = useState(false);
  const [hidingTooltip, setHidingTooltip] = useState(false);

  useEffect(() => {
    const ref = doc(db, "productos", productoProp.id);

    const unsubscribe = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        setProducto(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [productoProp.id]);

  const cantidadTotal = producto.cantidad ?? 0;
  const reservados = producto.reservados ?? 0;
  const stockDisponible = Math.max(0, cantidadTotal - reservados);

  const carritoItem = cartItems.find((item) => item.id === productoProp.id);
  const cantidadEnCarrito = carritoItem ? carritoItem.cantidad : 0;

  const handleAdd = () => {
    if (cantidadEnCarrito >= stockDisponible) {
      mostrarMensaje("Límite stock disponible");
      return;
    }

    addToCart(productoProp);
    mostrarMensaje("Producto añadido al carrito");
  };

  const handleRemove = () => {
    removeFromCart(productoProp.id);
    mostrarMensaje("Producto eliminado del carrito");
  };

  const handleCardClick = (e) => {
    if (
      e.target.closest(".add-button") ||
      e.target.closest(".faq-button") ||
      e.target.closest(".play-button")
    ) {
      return;
    }
    navigate(`/producto/${productoProp.id}`);
  };

  const fullDescription = `${producto.descripcion || ""} - ${producto.estilo || ""}`;
  const shortDescription = fullDescription.slice(0, 150);
  const isLong = fullDescription.length > 150;

  const handleDescriptionClick = () => {
    if (window.innerWidth <= 768) {
      setShowTooltip(true);
      setHidingTooltip(false);

      setTimeout(() => {
        setHidingTooltip(true);

        setTimeout(() => {
          setShowTooltip(false);
          setHidingTooltip(false);
        }, 300);
      }, 4000);
    }
  };

  // ... tu useEffect del schema queda igual ...

  /* ================================
   SCHEMA PRODUCT + MUSIC
================================ */
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",

      "@type": "Product",

      "@id": `${window.location.origin}/#producto-${productoProp.id}`,

      name: producto.titulo,

      image: producto.imagen ? [producto.imagen] : [],

      description: `${producto.descripcion || ""} ${producto.estilo || ""}`,

      sku: productoProp.id,

      brand: {
        "@type": "Brand",
        name: producto.sello || "Unknown",
      },

      /* relación musical */

      isRelatedTo: {
        "@type": "MusicAlbum",

        name: producto.titulo,

        byArtist: {
          "@type": "MusicGroup",
          name: producto.autor || "Unknown Artist",
        },

        genre: producto.genero || "Electronic",

        recordLabel: {
          "@type": "Organization",
          name: producto.sello || "Unknown Label",
        },
      },

      /* oferta */
      offers: {
        "@type": "Offer",

        priceCurrency: "ARS",

        price: producto.precio ?? 0,

        priceValidUntil: new Date(
          new Date().setDate(new Date().getDate() + 30),
        ).toISOString(),

        availability:
          stockDisponible > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",

        url: window.location.origin,
      },
    };

    const scriptId = `schema-product-${productoProp.id}`;

    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement("script");

      script.type = "application/ld+json";

      script.id = scriptId;

      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema);

    return () => {
      const existing = document.getElementById(scriptId);

      if (existing) existing.remove();
    };
  }, [producto, stockDisponible, productoProp.id]);

  return (
    <div className="product-card" onClick={handleCardClick}>
      <div className="image">
        <img
          src={producto.imagen}
          alt={producto.titulo}
          className={stockDisponible <= 0 ? "agotadoImagen" : ""}
        />

        {/* Botón ESCUCHAR (player global) */}
        <button
          type="button"
          className="play-button"
          title="Escuchar"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTrack(HARDCODED_SC_URL, true, {
              titulo: producto.titulo,
              autor: producto.autor,
              imagen: producto.imagen,
              sello: producto.sello,
            });
          }}
        >
          🔊
        </button>
      </div>

      <div className="info">
        <div className="itemTitleContainer">
          <h3 className={stockDisponible <= 0 ? "agotado" : ""}>
            {producto.titulo}
          </h3>

          <button
            className="add-button"
            onClick={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            title="Agregar al carrito"
            disabled={stockDisponible <= 0}
          >
            {stockDisponible <= 0 ? "×" : "+"}
          </button>
        </div>

        <p className="autor">{producto.autor}</p>

        <p className={`price ${stockDisponible <= 0 ? "agotado" : ""}`}>
          $
          {(producto?.precio ?? 0).toLocaleString("es-AR", {
            minimumFractionDigits: 0,
          })}
        </p>

        <div className="description-container" onClick={handleDescriptionClick}>
          <p className="description" title={fullDescription}>
            {`${shortDescription}${isLong ? "... ver mas" : ""}`}
          </p>

          {showTooltip && (
            <div className={`tooltip-mobile ${hidingTooltip ? "fade-out" : ""}`}>
              {fullDescription}
            </div>
          )}
        </div>

        <h4 className="sello">Label: {producto.sello}</h4>

        <div className={`stock ${stockDisponible <= 0 ? "agotadoStock" : ""}`}>
          Stock: {stockDisponible > 0 ? stockDisponible : "AGOTADO"}
          {cantidadEnCarrito > 0 && (
            <span> (En carrito: {cantidadEnCarrito})</span>
          )}
        </div>
      </div>

      <div
        className="faq-button"
        onClick={(e) => {
          e.preventDefault();
          setMostrarFaq(true);
        }}
        title="Preguntas frecuentes"
      >
        i
      </div>

      {mostrarFaq && <FaqModal onClose={() => setMostrarFaq(false)} />}
    </div>
  );
}

export default ProductItem;
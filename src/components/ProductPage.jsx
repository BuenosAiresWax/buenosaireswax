import { useEffect, useState, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { CartContext } from "../context/CartContext";
import { PlayerContext } from "../player/PlayerContext.jsx"; // <-- NUEVO
import PurchaseModal from "./PurchaseModal";
import CartPopupButton from "./CartPopupButton";
import LoaderOverlay from "./LoaderOverlay";
import {
  attachCatalogMeta,
  getCartItemKey,
  getCatalogBreadcrumbLabel,
  getCatalogConfig,
  getCatalogKeyByCollectionName,
  getProductPricing,
  isNewInProduct,
} from "../utils/catalog";

import "../styles/ProductPage.css";

const PLACEHOLDER_LISTEN_URL = "https://ejemplo.com/escucha";

function ProductPage({ catalogKey = "drop" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cartItems, addToCart, removeFromCart } = useContext(CartContext);
  const { setTrack } = useContext(PlayerContext); // <-- NUEVO
  const catalog = getCatalogConfig(catalogKey);

  const [producto, setProducto] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, catalog.collectionName, id);
    setIsLoading(true);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProducto(
          attachCatalogMeta({ id: snap.id, ...snap.data() }, catalog.key),
        );
      } else {
        setProducto(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [catalog.collectionName, catalog.key, id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [id, catalog.key]);

  useEffect(() => {
    if (!producto) return;

    const stockDisponible = (producto.cantidad ?? 0) - (producto.reservados ?? 0);
    const productUrl =
      typeof window !== "undefined"
        ? window.location.href
        : `${catalog.listPath}/${id}`;
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      sku: id,
      url: productUrl,
      name: producto.titulo,
      image: producto.imagen,
      description: producto.descripcion,
      brand: {
        "@type": "Brand",
        name: producto.sello || producto.autor || "Bawax",
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "ARS",
        price: pricing.precioFinal,
        itemCondition: "https://schema.org/NewCondition",
        availability:
          stockDisponible > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schema);

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [producto]);

  if (isLoading) {
    return (
      <>
        <LoaderOverlay visible={true} />
        <div className="detail-loading-space" aria-hidden="true" />
      </>
    );
  }

  if (!producto && !isLoading) {
    return (
      <>
        <p className="detail-loading">Producto no encontrado.</p>
      </>
    );
  }

  const stockDisponible = (producto.cantidad ?? 0) - (producto.reservados ?? 0);
  const isEquipamientoCatalog =
    catalog.key === "equipamiento" ||
    producto.catalogKey === "equipamiento" ||
    producto.collectionName === "equipamiento";
  const breadcrumbCatalogKey =
    producto.catalogKey ||
    getCatalogKeyByCollectionName(producto.collectionName || catalog.collectionName);
  const breadcrumbRootLabel = getCatalogBreadcrumbLabel(breadcrumbCatalogKey);
  const cartActionLabel = isEquipamientoCatalog
    ? "Consultar disponibilidad"
    : "Añadir al carrito";
  const escuchaUrl = (producto.escucha || "").trim();
  const normalizedEscuchaUrl = escuchaUrl.toLowerCase();
  const hasPlaceholderEscuchaUrl =
    normalizedEscuchaUrl === PLACEHOLDER_LISTEN_URL.toLowerCase();
  const hasValidEscuchaUrl = /^https?:\/\//i.test(escuchaUrl);
  const canPlayProduct =
    !isEquipamientoCatalog &&
    !hasPlaceholderEscuchaUrl &&
    hasValidEscuchaUrl;
  const pricing = getProductPricing(producto);
  const showSaleBadge = pricing.esSale;
  const showNewInBadge = isNewInProduct(producto);

  const cartKey = getCartItemKey({ id, collectionName: catalog.collectionName });
  const carritoItem = cartItems.find((item) => getCartItemKey(item) === cartKey);
  const cantidadEnCarrito = carritoItem ? carritoItem.cantidad : 0;

  const handleAdd = () => {
    if (cantidadEnCarrito >= stockDisponible) return;
    addToCart(attachCatalogMeta({ ...producto, id }, catalog.key));
  };

  const handleRemove = () => {
    removeFromCart({ id, collectionName: catalog.collectionName });
  };

  const handlePlay = () => {
    if (!canPlayProduct) return;

    setTrack(escuchaUrl, true, {
      titulo: producto.titulo,
      autor: producto.autor,
      imagen: producto.imagen,
      sello: producto.sello,
    });
  };

  return (
    <>
      <LoaderOverlay visible={isLoading} />
      <div className="detail-grid">
        <div className="breadcrumb">
          <button
            className="breadcrumb-back"
            onClick={() =>
              window.history.state?.idx > 0
                ? navigate(-1)
                : navigate(catalog.listPath)
            }
          >
            {breadcrumbRootLabel}
          </button>
          &gt; <span>{producto.titulo}</span>
        </div>

        {/* LEFT - IMAGEN */}
        <div className="detail-left">
          <img
            src={producto.imagen}
            alt={producto.titulo}
            className="detail-image"
          />
        </div>

        {/* CENTER - INFO */}
        <div className="detail-center">
          <h1 className="detail-title">{producto.titulo}</h1>
          <h3 className="detail-artist">{producto.autor}</h3>

          {/* TRACKLIST */}
          {producto.tracks && (
            <div className="tracklist">
              <h4>TRACKLIST</h4>
              {producto.tracks.map((track, i) => (
                <div key={i} className="track">
                  {track}
                </div>
              ))}
            </div>
          )}

          {/* DESCRIPCIÓN */}
          <p className="detail-description">{producto.descripcion}</p>

          {/* TAGS */}
          <div className="tags-section">
            <p className="tags-title">Categorias</p>
            <div className="tags" aria-label="Categorias del producto">
              {producto.genero && <span>{producto.genero}</span>}
              {producto.estilo && <span>{producto.estilo}</span>}
              <span className="tag-vinyl">Vinyl</span>
            </div>
          </div>

          {/* Botón que controla el PLAYER GLOBAL */}
          {canPlayProduct && (
            <button className="detail-play-btn" onClick={handlePlay}>
              🔊 Reproducir
            </button>
          )}
        </div>

        {/* RIGHT - META */}
        <div className="detail-right">
          <div className="detail-meta-card">
            <div className="meta-row">
              <span className="meta-key">Label:</span>
              <span className="meta-value">{producto.autor || "-"}</span>
            </div>

            <div className="meta-row">
              <span className="meta-key">Formato:</span>
              <span className="meta-value">12&quot; Vinyl</span>
            </div>

            <div className="meta-price-block">
              <span className="meta-key">Precio:</span>

              {isEquipamientoCatalog ? (
                <span className="meta-price-main">Consultar</span>
              ) : showSaleBadge ? (
                <span className="meta-price-stack">
                  <span className="meta-price-old">
                    ${pricing.precioOriginal.toLocaleString("es-AR")}
                  </span>
                  <span className="meta-price-main-row">
                    <span className="meta-price-main">
                      ${pricing.precioFinal.toLocaleString("es-AR")}
                    </span>
                    <span className="meta-price-badge">15% off</span>
                  </span>
                </span>
              ) : showNewInBadge ? (
                <span className="meta-price-main-row">
                  <span className="meta-price-main meta-price-main-default">
                    ${pricing.precioFinal.toLocaleString("es-AR")}
                  </span>
                  <span className="meta-price-badge meta-new-in-badge">New</span>
                </span>
              ) : (
                <span className="meta-price-main">
                  ${pricing.precioFinal.toLocaleString("es-AR")}
                </span>
              )}
            </div>
          </div>

          <p className={stockDisponible > 0 ? "stock-ok" : "stock-off"}>
            {stockDisponible > 0 ? "DISPONIBLE" : "AGOTADO"}
          </p>

          {stockDisponible > 0 && (
            <div className="cart-actions">
              <button onClick={handleAdd}>{`🛒 ${cartActionLabel}`}</button>
              {cantidadEnCarrito > 0 && (
                <button onClick={handleRemove}>Remover</button>
              )}
            </div>
          )}

          {cantidadEnCarrito > 0 && <p>En carrito: {cantidadEnCarrito}</p>}
        </div>
      </div>

      <CartPopupButton
        onOpen={() => setMostrarModal(true)}
        catalogKey={catalog.key}
        isHidden={mostrarModal}
      />

      {mostrarModal && (
        <PurchaseModal
          onClose={() => setMostrarModal(false)}
          catalogKey={catalog.key}
          refetchProductos={() => { }}
        />
      )}
    </>
  );
}

export default ProductPage;
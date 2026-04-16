import { useEffect, useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { CartContext } from "../context/CartContext";
import PurchaseModal from "./PurchaseModal";
import CartPopupButton from "./CartPopupButton";

import "../styles/ProductPage.css";

function ProductPage() {
  const { id } = useParams();
  const { cartItems, addToCart, removeFromCart } = useContext(CartContext);
  const [producto, setProducto] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => {
    const ref = doc(db, "productos", id);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProducto({ id: snap.id, ...snap.data() });
      }
    });

    return () => unsubscribe();
  }, [id]);

  if (!producto) return <p className="detail-loading">Cargando...</p>;

  const stockDisponible =
    (producto.cantidad ?? 0) - (producto.reservados ?? 0);

  const carritoItem = cartItems.find((item) => item.id === id);
  const cantidadEnCarrito = carritoItem ? carritoItem.cantidad : 0;

  const handleAdd = () => {
    if (cantidadEnCarrito >= stockDisponible) {
      return;
    }
    addToCart(producto);
  };

  const handleRemove = () => {
    removeFromCart(id);
  };

  return (
    <>
      <div className="detail-grid">
        <div className="breadcrumb">
          <Link to="/">Inicio</Link> &gt; <span>{producto.titulo}</span>
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

            {/* PLAYER */}
            {producto.escucha && (
              <iframe
                className="detail-player"
                src={`https://w.soundcloud.com/player/?url=${producto.escucha}`}
                allow="autoplay"
              />
            )}

            {/* DESCRIPCIÓN */}
            <p className="detail-description">
              {producto.descripcion}
            </p>

            {/* TAGS */}
            <div className="tags">
              {producto.genero && <span>{producto.genero}</span>}
              {producto.estilo && <span>{producto.estilo}</span>}
              <span>Vinyl</span>
            </div>
          </div>

          {/* RIGHT - META */}
          <div className="detail-right">
            <p><strong>Label:</strong> {producto.autor || "-"}</p>
            <p><strong>Formato:</strong> 12" Vinyl</p>
            <p className="detail-right-price"><strong>Precio:</strong> ${producto.precio ? producto.precio.toLocaleString('es-AR') : '-'}</p>
            
            <p className={stockDisponible > 0 ? "stock-ok" : "stock-off"}>
              {stockDisponible > 0 ? "DISPONIBLE" : "AGOTADO"}
            </p>

            {stockDisponible > 0 && (
              <div className="cart-actions">
                <button onClick={handleAdd}>Añadir al carrito</button>
                {cantidadEnCarrito > 0 && (
                  <button onClick={handleRemove}>Remover</button>
                )}
              </div>
            )}

            {cantidadEnCarrito > 0 && (
              <p>En carrito: {cantidadEnCarrito}</p>
            )}
          </div>

        </div>

        <CartPopupButton onOpen={() => setMostrarModal(true)} />

        {mostrarModal && (
          <PurchaseModal
            onClose={() => setMostrarModal(false)}
            refetchProductos={() => {}} // No needed
          />
        )}
      </>
  );
}

export default ProductPage;
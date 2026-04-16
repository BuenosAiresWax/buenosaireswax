import { useEffect, useState, useContext } from "react";
import { useParams, useLocation } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

import { CartContext } from "../context/CartContext";
import Header from "./Header";

function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();

  const { cartItems, addToCart, removeFromCart } = useContext(CartContext);

  const [producto, setProducto] = useState(location.state || null);

  useEffect(() => {
    const ref = doc(db, "productos", id);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProducto({ id: snap.id, ...snap.data() });
      }
    });

    return () => unsubscribe();
  }, [id]);

  /* -------------------------------
     STRUCTURED DATA PRODUCT
  --------------------------------*/
  useEffect(() => {
    if (!producto) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: producto.titulo,
      image: producto.imagen,
      description: producto.descripcion,
      brand: {
        "@type": "Brand",
        name: producto.sello,
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "ARS",
        price: producto.precio,
        availability:
          (producto.cantidad ?? 0) - (producto.reservados ?? 0) > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schema);

    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, [producto]);

  if (!producto) return null;

  const stockDisponible = (producto.cantidad ?? 0) - (producto.reservados ?? 0);

  const carritoItem = cartItems.find((i) => i.id === producto.id);
  const cantidadEnCarrito = carritoItem?.cantidad || 0;

  return (
    <>
      <Header onCartClick={() => {}} />

      <div className="detail-container">
        <h1>{producto.titulo}</h1>

        <button onClick={() => addToCart(producto)}>Agregar</button>

        {cantidadEnCarrito > 0 && (
          <button onClick={() => removeFromCart(producto.id)}>Quitar</button>
        )}
      </div>
    </>
  );
}

export default ProductDetail;

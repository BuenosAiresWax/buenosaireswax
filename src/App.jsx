import { useEffect, useState, useContext } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase/config";
import { CartContext } from "./context/CartContext";
import Hero from "./components/Hero";
import ProductList from "./components/ProductList";
import PurchaseModal from "./components/PurchaseModal";
import CartPopupButton from "./components/CartPopupButton";
import LoaderOverlay from "./components/LoaderOverlay";
import Footer from "./components/Footer";
import DropAccess from "./components/DropAccess";

import "./styles/styles.css";

import logo from '../assets/logo/header-logo.png';
import carritoVacio from '../assets/icons/carrito-vacio.svg';
import carritoLleno from '../assets/icons/carrito-lleno.svg';

function App() {
  // Leer el valor guardado en localStorage para inicializar autenticado
  const [autenticado, setAutenticado] = useState(() => {
    return localStorage.getItem("autenticado") === "true";
  });

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);

  const { getTotalQuantity } = useContext(CartContext);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const productosRef = collection(db, "productos");
      const snapshot = await getDocs(productosRef);
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(producto => {
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

  // Cuando el usuario se autentica guardamos en localStorage
  const manejarAutenticacion = () => {
    setAutenticado(true);
    localStorage.setItem("autenticado", "true");
  };

  const totalCantidad = getTotalQuantity();

  return (
    <div className="app-container">
      <LoaderOverlay visible={autenticado && loading} />

      <div className="headerContainer">
        <img src={logo} alt="eStock" className="logo" />

        <div className="rightNav">
          <a className="contactoNav" href="#">Contacto</a>
          <div
            className="cartIcon"
            onClick={() => {
              if (totalCantidad > 0) {
                setMostrarModal(true);
              }
            }}
            style={{ cursor: totalCantidad > 0 ? 'pointer' : 'default' }}
            title={totalCantidad > 0 ? 'Ver carrito' : 'Carrito vacío'}
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

      <Hero />

      {!autenticado ? (
        <DropAccess
          fechaObjetivo="2025-08-02T20:00:00"
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

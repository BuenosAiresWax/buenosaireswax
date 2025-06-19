import { useEffect, useState, useContext } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase/config";
import ProductList from "./components/ProductList";
import PurchaseModal from "./components/PurchaseModal";
import { CartContext } from "./context/CartContext";

import "./styles/styles.css";
import logo from '../assets/img/logoConNombre.png';
import logoFooter from '../assets/logo/logo-junto-negro.png';

// Importar íconos locales
import carritoVacio from '../assets/icons/carrito-vacio.svg';
import carritoLleno from '../assets/icons/carrito-lleno.svg';

import CartPopupButton from "./components/CartPopupButton";  // Importar nuevo botón
import LoaderOverlay from "./components/LoaderOverlay";


function App() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);

  const { getTotalQuantity } = useContext(CartContext);

  const fetchProductos = async () => {
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
    fetchProductos();
  }, []);

  const totalCantidad = getTotalQuantity();

  return (
    <div className="app-container">
      <LoaderOverlay visible={loading} />
      {/* Header */}
      <div className="headerContainer">
        <img src={logo} alt="eStock" className="logo" />

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

      <h1 className="tituloPrincipal">Buenos Aires Wax</h1>

      <h2 className="tituloSecundario">Online Vinyl Record Store</h2>


      <ProductList
        productos={productos}
        loading={loading}
        refetchProductos={fetchProductos}
      />

      <div className="footerContainer">
        <img src={logoFooter} alt="" />
      </div>

      {/* Botón flotante para abrir carrito */}
      <CartPopupButton onOpen={() => setMostrarModal(true)} />

      {mostrarModal && (
        <PurchaseModal
          onClose={() => setMostrarModal(false)}
          refetchProductos={fetchProductos}
        />
      )}
    </div>
  );
}

export default App;

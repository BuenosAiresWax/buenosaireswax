import { useContext, useState, useEffect } from "react";
import { CartContext } from "../context/CartContext";
import ProductItem from "./ProductItem";
import ProductSkeleton from "./ProductSkeleton";
import Filters from "./Filters";
import Notificacion from "./Notificacion";
import { useNotificacion } from "../hooks/useNotificacion";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

const ProductList = () => {
    const { cartItems } = useContext(CartContext);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroTexto, setFiltroTexto] = useState("");
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
    const { mensaje, visible, mostrarMensaje } = useNotificacion(1000);

    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, "productos"),
            (snapshot) => {
                const productosActualizados = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        titulo: data.titulo || "Sin título",
                        categoria: data.categoria || "",
                        ...data,
                    };
                });
                setProductos(productosActualizados);
                setLoading(false);
            },
            (error) => {
                console.error("Error al obtener productos:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe(); // limpieza
    }, []);

    useEffect(() => {
        if (cartItems.length === 0) {
            mostrarMensaje("Carrito vacío");
        }
    }, [cartItems, mostrarMensaje]);

    const productosFiltrados = productos.filter((producto) => {
        const coincideTexto = (producto.titulo || "")
            .toLowerCase()
            .includes(filtroTexto.toLowerCase());
        const coincideCategoria =
            categoriaSeleccionada === "" ||
            (producto.categoria || "") === categoriaSeleccionada;
        return coincideTexto && coincideCategoria;
    });

    if (loading) {
        return (
            <div className="product-list">
                {[1, 2, 3].map((_, i) => (
                    <ProductSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
        <div>
            <Filters
                filtroTexto={filtroTexto}
                setFiltroTexto={setFiltroTexto}
                categoriaSeleccionada={categoriaSeleccionada}
                setCategoriaSeleccionada={setCategoriaSeleccionada}
            />

            <Notificacion mensaje={mensaje} visible={visible} />

            <div className="product-list">
                {productosFiltrados.length === 0 ? (
                    <div className="product-item no-results">
                        <div className="info">
                            <h2>Ups!</h2>
                            <p>Seguinos en redes y no te pierdas nuestros drops.</p>
                        </div>
                    </div>
                ) : (
                    productosFiltrados.map((producto) => (
                        <ProductItem
                            key={producto.id}
                            producto={producto}
                            mostrarMensaje={mostrarMensaje}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default ProductList;

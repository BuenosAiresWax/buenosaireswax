import { useContext, useEffect, useState, useMemo, useRef, useCallback } from "react";
import { CartContext } from "../context/CartContext";
import { useNotificacion } from "../hooks/useNotificacion";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import ProductItem from "./ProductItem";
import ProductSkeleton from "./ProductSkeleton";
import Filters from "./Filters";
import Notificacion from "./Notificacion";
import Spinner from "./Spinner";

const BATCH_SIZE = 15;
const MIN_LOADING_TIME = 800; // ms mínimo para mostrar spinner

const ProductList = () => {
    const { cartItems } = useContext(CartContext);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(BATCH_SIZE);
    const [filtroTexto, setFiltroTexto] = useState("");
    const [filtroSeleccionado, setFiltroSeleccionado] = useState("");
    const { mensaje, visible, mostrarMensaje } = useNotificacion(1000);

    const sentinelRef = useRef();
    const loadingStartRef = useRef(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "productos"), (snapshot) => {
            const productosActualizados = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setProductos(productosActualizados);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (cartItems.length === 0) {
            mostrarMensaje("Carrito vacío");
        }
    }, [cartItems, mostrarMensaje]);

    const productosFiltrados = useMemo(() => {
        return productos.filter((producto) => {
            const coincideTexto = (producto.titulo || "")
                .toLowerCase()
                .includes(filtroTexto.toLowerCase());
            const coincideFiltro =
                filtroSeleccionado === "" ||
                producto.categoria === filtroSeleccionado ||
                producto.autor === filtroSeleccionado;
            return coincideTexto && coincideFiltro;
        });
    }, [productos, filtroTexto, filtroSeleccionado]);

    const productosLimitados = productosFiltrados.slice(0, limit);

    const cargarMas = useCallback(
        (node) => {
            if (sentinelRef.current) sentinelRef.current.disconnect();

            sentinelRef.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !isLoadingMore) {
                    setIsLoadingMore(true);
                    loadingStartRef.current = Date.now();

                    setTimeout(() => {
                        setLimit((prev) => Math.min(prev + BATCH_SIZE, productosFiltrados.length));
                        const elapsed = Date.now() - loadingStartRef.current;
                        const remaining = MIN_LOADING_TIME - elapsed;
                        if (remaining > 0) {
                            setTimeout(() => setIsLoadingMore(false), remaining);
                        } else {
                            setIsLoadingMore(false);
                        }
                    }, 500); // simula un pequeño delay para la carga
                }
            });

            if (node) sentinelRef.current.observe(node);
        },
        [productosFiltrados.length, isLoadingMore]
    );

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
                categoriaSeleccionada={filtroSeleccionado}
                setCategoriaSeleccionada={setFiltroSeleccionado}
                productos={productos}
            />

            <Notificacion mensaje={mensaje} visible={visible} />

            <div className="product-list">
                {productosLimitados.length === 0 ? (
                    <div className="product-item no-results">
                        <div className="info">
                            <h2>Ups!</h2>
                            <p>Seguinos en redes y no te pierdas nuestros drops.</p>
                        </div>
                    </div>
                ) : (
                    productosLimitados.map((producto) => (
                        <ProductItem key={producto.id} producto={producto} mostrarMensaje={mostrarMensaje} />
                    ))
                )}
            </div>

            {/* Loader spinner para scroll infinito */}
            {isLoadingMore && (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                    <Spinner />
                </div>
            )}

            {/* Sentinel invisible para IntersectionObserver */}
            {!isLoadingMore && limit < productosFiltrados.length && (
                <div ref={cargarMas} style={{ height: "1px" }} />
            )}
        </div>
    );
};

export default ProductList;

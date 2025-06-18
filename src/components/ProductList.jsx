import { useContext, useState, useEffect } from "react";
import { CartContext } from "../context/CartContext";
import ProductItem from "./ProductItem";
import ProductSkeleton from "./ProductSkeleton";
import Filters from "./Filters";

const ProductList = ({ productos, loading, refetchProductos }) => {
    const [filtroTexto, setFiltroTexto] = useState("");
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");

    const { cartItems } = useContext(CartContext);
    const [mostrarCarritoVacio, setMostrarCarritoVacio] = useState(false);

    useEffect(() => {
        if (cartItems.length === 0) {
            setMostrarCarritoVacio(true);
            const timeout = setTimeout(() => setMostrarCarritoVacio(false), 3000);
            return () => clearTimeout(timeout);
        }
    }, [cartItems]);

    const productosFiltrados = productos.filter((producto) => {
        const coincideTexto = producto.titulo.toLowerCase().includes(filtroTexto.toLowerCase());
        const coincideCategoria =
            categoriaSeleccionada === "" || producto.categoria === categoriaSeleccionada;

        return coincideTexto && coincideCategoria;
    });

    if (loading) {
        return (
            <div className="product-list">
                {[1, 2, 3].map((_, i) => <ProductSkeleton key={i} />)}
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

            {mostrarCarritoVacio && (
                <div className="stock-aviso" style={{ marginBottom: "16px" }}>
                    Carrito vacío
                </div>
            )}

            <div className="product-list">
                {productosFiltrados.length === 0 ? (
                    <div className="product-item no-results">
                        <div className="info">
                            <h2>Ups!</h2>
                            <p>Seguinos en redes para enterarte cuando haya stock disponible</p>
                        </div>
                    </div>
                ) : (
                    productosFiltrados.map((producto) => (
                        <ProductItem
                            key={producto.id}
                            producto={producto}
                            refetchProductos={refetchProductos}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default ProductList;

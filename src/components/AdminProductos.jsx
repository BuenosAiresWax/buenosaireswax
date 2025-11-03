// src/components/ProductosAdmin.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/adminProductos.css";

export default function ProductosAdmin() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProductos = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "productos"));
                const productosData = querySnapshot.docs.map((doc) => {
                    const data = doc.data();

                    return {
                        id: doc.id,
                        titulo: data.titulo || "Sin título",
                        autor: data.autor || "Desconocido",
                        genero: data.genero || "No especificado",
                        estilo: data.estilo || "—",
                        categoria: data.categoria || "Sin categoría",
                        sello: data.sello || "Sin sello",
                        precio: typeof data.precio === "number" ? data.precio : 0,
                        descripcion: data.descripcion || "Sin descripción disponible.",
                        cantidad:
                            typeof data.cantidad === "number" && data.cantidad >= 0
                                ? data.cantidad
                                : 0,
                        reservados:
                            typeof data.reservados === "number" && data.reservados >= 0
                                ? data.reservados
                                : 0,
                        imagen: data.imagen || "/placeholder-image.png", // ruta local o genérica
                    };
                });

                setProductos(productosData);
            } catch (err) {
                console.error("Error al obtener productos:", err);
                setError("No se pudieron cargar los productos. Intenta nuevamente más tarde.");
            } finally {
                setLoading(false);
            }
        };

        fetchProductos();
    }, []);

    if (loading) return <p className="loading">Cargando productos...</p>;
    if (error) return <p className="error">{error}</p>;

    return (
        <div className="productos-admin-container">
            <h2 className="productos-admin-title">Inventario de Productos</h2>

            {productos.length === 0 ? (
                <p>No hay productos cargados.</p>
            ) : (
                <div className="productos-list">
                    {productos.map((producto) => {
                        const disponibles = Math.max(
                            0,
                            (producto.cantidad || 0) - (producto.reservados || 0)
                        );

                        return (
                            <div key={producto.id} className="producto-card">
                                <img
                                    src={producto.imagen}
                                    alt={producto.titulo}
                                    className="producto-imagen"
                                    onError={(e) => (e.target.src = "/placeholder-image.png")}
                                />
                                <div className="producto-info">
                                    <h3>{producto.titulo}</h3>

                                    <p className="precio"><strong>Precio:</strong> ${producto.precio.toLocaleString()}</p>

                                    <div className="info-grid">
                                        <p><strong>Autor:</strong> {producto.autor}</p>
                                        <p><strong>Género:</strong> {producto.genero} — {producto.estilo}</p>
                                        <p><strong>Categoría:</strong> {producto.categoria}</p>
                                        <p><strong>Sello:</strong> {producto.sello}</p>
                                    </div>

                                    <p className="descripcion">{producto.descripcion}</p>

                                    <div className="stock-info">
                                        <div className="stock-item total">
                                            <span>Stock total</span>
                                            <strong>{producto.cantidad}</strong>
                                        </div>
                                        <div className="stock-item reservados">
                                            <span>Reservados</span>
                                            <strong>{producto.reservados}</strong>
                                        </div>
                                        <div
                                            className={`stock-item disponibles ${disponibles <= 1 ? "low" : ""
                                                }`}
                                        >
                                            <span>Disponibles</span>
                                            <strong>{disponibles}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

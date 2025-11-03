import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import "./AdminProductos.css";

export default function AdminProductos() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProductos = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "productos"));
                const items = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProductos(items);
            } catch (error) {
                console.error("Error cargando productos:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProductos();
    }, []);

    if (loading) return <p>Cargando productos...</p>;

    return (
        <div className="admin-container">
            <h2 className="admin-title">Productos</h2>

            {productos.length === 0 ? (
                <p>No hay productos en la base de datos.</p>
            ) : (
                <div className="productos-grid">
                    {productos.map(prod => (
                        <div key={prod.id} className="product-card">
                            <img src={prod.imagen} alt={prod.titulo} />

                            <div className="product-details">
                                <h3>{prod.titulo}</h3>
                                <div><strong>Autor:</strong> {prod.autor}</div>
                                <div>
                                    <strong>Categoría:</strong> {prod.categoria} |
                                    <strong> Género:</strong> {prod.genero} |
                                    <strong> Estilo:</strong> {prod.estilo}
                                </div>
                                <div><strong>Sello:</strong> {prod.sello}</div>
                                <div>
                                    <strong>Cantidad disponible:</strong> {prod.cantidad} |
                                    <strong> Reservados:</strong> {prod.reservados}
                                </div>
                                <div><strong>Precio:</strong> ${prod.precio.toLocaleString("es-AR")}</div>
                                <div>
                                    <strong>Descripción:</strong>
                                    <p>{prod.descripcion}</p>
                                </div>
                                {prod.escucha && (
                                    <div>
                                        <a href={prod.escucha} target="_blank" rel="noopener noreferrer">
                                            Escuchar / Más info
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

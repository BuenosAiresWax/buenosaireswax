import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/adminProductos.css";
import "../styles/admin.css"; // para reusar las clases de orden y refresh

export default function ProductosAdmin() {
    const [productos, setProductos] = useState([]);
    const [productosFiltrados, setProductosFiltrados] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editando, setEditando] = useState(null);
    const [formData, setFormData] = useState({});
    const [modal, setModal] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [orden, setOrden] = useState("mayorPrecio"); // mayorPrecio o menorPrecio

    // 🔄 Cargar productos
    const fetchProductos = async () => {
        setLoading(true);
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
                    cantidad: typeof data.cantidad === "number" ? data.cantidad : 0,
                    reservados: typeof data.reservados === "number" ? data.reservados : 0,
                    imagen: data.imagen || "/placeholder-image.png",
                };
            });

            // ordenar por precio descendente por defecto
            const ordenados = [...productosData].sort((a, b) => b.precio - a.precio);
            setProductos(ordenados);
            setProductosFiltrados(ordenados);
        } catch (err) {
            console.error("Error al obtener productos:", err);
            setError("No se pudieron cargar los productos. Intenta nuevamente más tarde.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProductos();
    }, []);

    // 🔍 Filtrar por nombre
    useEffect(() => {
        if (busqueda.trim() === "") {
            setProductosFiltrados(productos);
        } else {
            const filtrados = productos.filter((p) =>
                p.titulo.toLowerCase().includes(busqueda.toLowerCase())
            );
            setProductosFiltrados(filtrados);
        }
    }, [busqueda, productos]);

    // 🔁 Ordenar productos por precio
    const handleOrdenChange = (e) => {
        const nuevoOrden = e.target.value;
        setOrden(nuevoOrden);

        const productosOrdenados = [...productosFiltrados].sort((a, b) =>
            nuevoOrden === "mayorPrecio" ? b.precio - a.precio : a.precio - b.precio
        );
        setProductosFiltrados(productosOrdenados);
    };

    const handleEdit = (producto) => {
        setEditando(producto.id);
        setFormData({ ...producto });
    };

    const handleCancel = () => {
        setEditando(null);
        setFormData({});
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === "precio" || name === "cantidad" || name === "reservados"
                    ? Number(value)
                    : value,
        }));
    };

    const handleSave = (id) => {
        setModal({
            type: "confirm",
            message: "¿Guardar los cambios realizados en este producto?",
            onConfirm: async () => {
                setProcessing(true);
                setModal({ type: "loading", message: "Guardando cambios..." });

                try {
                    const docRef = doc(db, "productos", id);
                    await updateDoc(docRef, formData);
                    setProductos((prev) =>
                        prev.map((p) => (p.id === id ? { ...p, ...formData } : p))
                    );

                    setTimeout(() => {
                        setModal({
                            type: "success",
                            message: "✅ Cambios guardados correctamente.",
                            onClose: () => {
                                setModal(null);
                                setEditando(null);
                                setProcessing(false);
                            },
                        });
                    }, 600);
                } catch (err) {
                    console.error("Error al actualizar producto:", err);
                    setModal({
                        type: "error",
                        message: "❌ No se pudo guardar el producto. Intenta nuevamente.",
                        onClose: () => setModal(null),
                    });
                    setProcessing(false);
                }
            },
        });
    };

    const handleDelete = (id, titulo) => {
        setModal({
            type: "confirm",
            message: `¿Eliminar el producto "${titulo}"? Esta acción no se puede deshacer.`,
            onConfirm: async () => {
                setProcessing(true);
                setModal({ type: "loading", message: "Eliminando producto..." });

                try {
                    await deleteDoc(doc(db, "productos", id));
                    setProductos((prev) => prev.filter((p) => p.id !== id));

                    setTimeout(() => {
                        setModal({
                            type: "success",
                            message: "🗑️ Producto eliminado correctamente.",
                            onClose: () => {
                                setModal(null);
                                setProcessing(false);
                            },
                        });
                    }, 600);
                } catch (err) {
                    console.error("Error al eliminar producto:", err);
                    setModal({
                        type: "error",
                        message: "❌ No se pudo eliminar el producto. Intenta nuevamente.",
                        onClose: () => setModal(null),
                    });
                    setProcessing(false);
                }
            },
        });
    };

    if (loading) return <p className="loading">Cargando productos...</p>;
    if (error) return <p className="error">{error}</p>;

    return (
        <div className="productos-admin-container">
            <h2 className="productos-admin-title">Inventario de Productos</h2>

            {/* 🔽 Controles de búsqueda, orden y refresh */}
            <div className="orden-selector">
                <input
                    type="text"
                    placeholder="Buscar por titulo..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="search-input"
                />
                <select value={orden} onChange={handleOrdenChange}>
                    <option value="mayorPrecio">Mayor precio primero</option>
                    <option value="menorPrecio">Menor precio primero</option>
                </select>
                <button className="refresh-btn" onClick={fetchProductos} disabled={processing}>
                    🔄 Refresh
                </button>
            </div>

            {productosFiltrados.length === 0 ? (
                <p>No hay productos que coincidan con la búsqueda.</p>
            ) : (
                <div className="productos-list">
                    {productosFiltrados.map((producto) => {
                        const disponibles = Math.max(
                            0,
                            (producto.cantidad || 0) - (producto.reservados || 0)
                        );
                        const isEditing = editando === producto.id;

                        return (
                            <div key={producto.id} className="producto-card">
                                {!isEditing && (
                                    <div className="card-actions">
                                        <button
                                            className="edit-btn"
                                            onClick={() => !processing && handleEdit(producto)}
                                            title="Editar producto"
                                            disabled={processing}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() =>
                                                !processing &&
                                                handleDelete(producto.id, producto.titulo)
                                            }
                                            title="Eliminar producto"
                                            disabled={processing}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                )}

                                <img
                                    src={producto.imagen}
                                    alt={producto.titulo}
                                    className="producto-imagen"
                                    onError={(e) => (e.target.src = "/assets/logo/B-negro.png")}
                                />

                                <div className="producto-info">
                                    {isEditing ? (
                                        <>
                                            <input
                                                name="titulo"
                                                value={formData.titulo}
                                                onChange={handleChange}
                                                className="input-edit"
                                            />
                                            <input
                                                name="precio"
                                                value={formData.precio}
                                                onChange={handleChange}
                                                className="input-edit"
                                                type="number"
                                            />
                                            <textarea
                                                name="descripcion"
                                                value={formData.descripcion}
                                                onChange={handleChange}
                                                className="textarea-edit"
                                            />
                                            <div className="info-grid">
                                                {["autor", "genero", "estilo", "categoria", "sello"].map(
                                                    (campo) => (
                                                        <input
                                                            key={campo}
                                                            name={campo}
                                                            value={formData[campo]}
                                                            onChange={handleChange}
                                                            className="input-edit"
                                                        />
                                                    )
                                                )}
                                            </div>
                                            <div className="stock-info">
                                                <input
                                                    name="cantidad"
                                                    value={formData.cantidad}
                                                    onChange={handleChange}
                                                    className="input-edit small"
                                                    type="number"
                                                />
                                                <input
                                                    name="reservados"
                                                    value={formData.reservados}
                                                    onChange={handleChange}
                                                    className="input-edit small"
                                                    type="number"
                                                />
                                            </div>
                                            <div className="edit-actions">
                                                <button
                                                    className="btn-save"
                                                    onClick={() => !processing && handleSave(producto.id)}
                                                    disabled={processing}
                                                >
                                                    {processing ? "Guardando..." : "Guardar"}
                                                </button>
                                                <button
                                                    className="btn-cancel"
                                                    onClick={!processing ? handleCancel : undefined}
                                                    disabled={processing}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3>{producto.titulo}</h3>
                                            <p className="precio">
                                                <strong>Precio:</strong> ${producto.precio.toLocaleString()}
                                            </p>
                                            <div className="info-grid">
                                                <p><strong>Autor:</strong> {producto.autor}</p>
                                                <p><strong>Género:</strong> {producto.genero} — {producto.estilo}</p>
                                                <p><strong>Categoría:</strong> {producto.categoria}</p>
                                                <p><strong>Sello:</strong> {producto.sello}</p>
                                            </div>
                                            <p className="descripcion">{producto.descripcion}</p>
                                            <div className="stock-info">
                                                <div className="stock-item total">
                                                    <span>Stock</span>
                                                    <strong>{producto.cantidad}</strong>
                                                </div>
                                                <div className="stock-item reservados">
                                                    <span>Reservados</span>
                                                    <strong>{producto.reservados}</strong>
                                                </div>
                                                <div
                                                    className={`stock-item disponibles ${disponibles <= 1 ? "low" : ""}`}
                                                >
                                                    <span>Disponibles</span>
                                                    <strong>{disponibles}</strong>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 🪟 Modal dinámico */}
            {modal && (
                <div className="modal-overlay">
                    <div className={`modal ${modal.fadeOut ? "fadeOut" : "fadeIn"}`}>
                        <p>{modal.message}</p>
                        {modal.type === "confirm" && (
                            <div className="modal-buttons">
                                <button
                                    className="confirm-btn"
                                    onClick={() => modal.onConfirm()}
                                >
                                    Confirmar
                                </button>
                                <button
                                    className="cancel-btn"
                                    onClick={() => setModal(null)}
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                        {["success", "error"].includes(modal.type) && (
                            <button
                                className="ok-btn"
                                onClick={() => {
                                    if (modal.onClose) modal.onClose();
                                    else setModal(null);
                                }}
                            >
                                OK
                            </button>
                        )}
                        {modal.type === "loading" && (
                            <div className="modal-buttons">
                                <p className="loading">⏳ {modal.message}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

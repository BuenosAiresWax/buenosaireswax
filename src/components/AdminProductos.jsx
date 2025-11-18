import { useEffect, useState, useRef } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, limit, startAfter } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/adminProductos.css";
import "../styles/admin.css";

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
    const [orden, setOrden] = useState("mayorPrecio");

    const [ultimoDoc, setUltimoDoc] = useState(null);
    const [cargandoMas, setCargandoMas] = useState(false);
    const LIMITE = 30;

    const loaderRef = useRef(null);

    const fetchProductos = async (loadMore = false) => {
        try {
            if (loadMore) setCargandoMas(true);
            else setLoading(true);

            let ref = query(
                collection(db, "productos"),
                orderBy("precio", "desc"),
                limit(LIMITE)
            );

            if (loadMore && ultimoDoc) {
                ref = query(
                    collection(db, "productos"),
                    orderBy("precio", "desc"),
                    startAfter(ultimoDoc),
                    limit(LIMITE)
                );
            }

            const snap = await getDocs(ref);
            const last = snap.docs[snap.docs.length - 1] || null;
            setUltimoDoc(last);

            const nuevos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

            if (!loadMore) {
                setProductos(nuevos);
                setProductosFiltrados(nuevos);
            } else {
                setProductos((prev) => [...prev, ...nuevos]);
                setProductosFiltrados((prev) => [...prev, ...nuevos]);
            }
        } catch (err) {
            console.error(err);
            setError("No se pudieron cargar los productos.");
        } finally {
            setLoading(false);
            setCargandoMas(false);
        }
    };

    useEffect(() => {
        fetchProductos();
    }, []);

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

    useEffect(() => {
        if (!loaderRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !cargandoMas && ultimoDoc) {
                    fetchProductos(true);
                }
            },
            { threshold: 1 }
        );
        observer.observe(loaderRef.current);

        return () => observer.disconnect();
    }, [loaderRef.current, cargandoMas, ultimoDoc]);

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
                            message: "Cambios guardados correctamente.",
                            onClose: () => {
                                setModal(null);
                                setEditando(null);
                                setProcessing(false);
                            },
                        });
                    }, 600);
                } catch (err) {
                    setModal({
                        type: "error",
                        message: "No se pudo guardar el producto.",
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
            message: `¿Eliminar el producto "${titulo}"?`,
            onConfirm: async () => {
                setProcessing(true);
                setModal({ type: "loading", message: "Eliminando producto..." });

                try {
                    await deleteDoc(doc(db, "productos", id));
                    setProductos((prev) => prev.filter((p) => p.id !== id));

                    setTimeout(() => {
                        setModal({
                            type: "success",
                            message: "Producto eliminado.",
                            onClose: () => {
                                setModal(null);
                                setProcessing(false);
                            },
                        });
                    }, 600);
                } catch (err) {
                    setModal({
                        type: "error",
                        message: "No se pudo eliminar el producto.",
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
                <button className="refresh-btn" onClick={() => fetchProductos()} disabled={processing}>
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
                            <div
                                key={producto.id}
                                className={`producto-card ${disponibles === 0
                                    ? "sin-stock"
                                    : disponibles === 1
                                        ? "stock-bajo"
                                        : "stock-ok"
                                    }`}
                            >
                                {!isEditing && (
                                    <div className="card-actions">
                                        <button
                                            className="edit-btn"
                                            onClick={() => !processing && handleEdit(producto)}
                                            disabled={processing}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() => !processing && handleDelete(producto.id, producto.titulo)}
                                            disabled={processing}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                )}

                                {producto.imagen ? (
                                    <img
                                        src={producto.imagen}
                                        alt={producto.titulo}
                                        className="producto-imagen"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.style.display = "none";
                                            e.target.insertAdjacentHTML(
                                                "afterend",
                                                '<div class="producto-imagen-placeholder"></div>'
                                            );
                                        }}
                                    />
                                ) : (
                                    <div className="producto-imagen-placeholder"></div>
                                )}

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
                                                <strong>Precio:</strong> ${producto.precio?.toLocaleString()}
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
                                                <div className={`stock-item disponibles ${disponibles <= 1 ? "low" : ""}`}>
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
                    <div ref={loaderRef} />
                    {cargandoMas && <p className="loading">Cargando más...</p>}
                </div>
            )}

            {modal && (
                <div className="admin-modal-overlay">
                    <div className="modal-admin">
                        <p>{modal.message}</p>

                        {modal.type === "confirm" && (
                            <div className="modal-admin-buttons">
                                <button className="confirm-btn" onClick={() => modal.onConfirm()}>
                                    Confirmar
                                </button>
                                <button className="cancel-btn" onClick={() => setModal(null)}>
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
                            <div className="modal-admin-buttons">
                                <p className="loading">⏳ {modal.message}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

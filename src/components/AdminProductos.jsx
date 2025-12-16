import { useMemo, useState, useRef } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAdminData } from "../context/AdminDataContext";

import "../styles/adminProductos.css";
import "../styles/admin.css";

export default function ProductosAdmin() {
    const { productos, loading, refetch } = useAdminData();

    const [busqueda, setBusqueda] = useState("");
    const [error, setError] = useState(null);
    const [editando, setEditando] = useState(null);
    const [formData, setFormData] = useState({});
    const [modal, setModal] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [orden, setOrden] = useState("mayorPrecio");

    // Infinite scroll (se mantiene aunque ahora cargue todo del contexto)
    const loaderRef = useRef(null);

    /* -----------------------------
       USE MEMO
    ------------------------------ */
    const productosFiltrados = useMemo(() => {
        let lista = [...productos];

        // 🔍 búsqueda
        if (busqueda.trim() !== "") {
            lista = lista.filter((p) =>
                p.titulo?.toLowerCase().includes(busqueda.toLowerCase())
            );
        }

        // ↕️ orden
        lista.sort((a, b) =>
            orden === "mayorPrecio"
                ? (b.precio || 0) - (a.precio || 0)
                : (a.precio || 0) - (b.precio || 0)
        );

        return lista;
    }, [productos, busqueda, orden]);
    /* -----------------------------
       ORDEN
    ------------------------------ */
    const handleOrdenChange = (e) => {
        setOrden(e.target.value);
    };
    /* -----------------------------
       EDICIÓN
    ------------------------------ */
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
                    await updateDoc(doc(db, "productos", id), formData);

                    await refetch();

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
                    console.error(err);
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

    /* -----------------------------
       ELIMINAR
    ------------------------------ */
    const handleDelete = (id, titulo) => {
        setModal({
            type: "confirm",
            message: `¿Eliminar el producto "${titulo}"?`,
            onConfirm: async () => {
                setProcessing(true);
                setModal({ type: "loading", message: "Eliminando producto..." });

                try {
                    await deleteDoc(doc(db, "productos", id));
                    await refetch();

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
                    console.error(err);
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

    /* -----------------------------
       ESTADOS
    ------------------------------ */
    if (loading) return <p className="loading">Cargando productos...</p>;
    if (error) return <p className="error">{error}</p>;

    return (
        <div className="productos-admin-container">
            <h2 className="productos-admin-title">Inventario de Productos</h2>

            <div className="orden-selector">
                <input
                    type="text"
                    placeholder="Buscar por título..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="search-input"
                />

                <select value={orden} onChange={handleOrdenChange}>
                    <option value="mayorPrecio">Mayor precio primero</option>
                    <option value="menorPrecio">Menor precio primero</option>
                </select>

                <button
                    className="refresh-btn"
                    onClick={refetch}
                    disabled={processing}
                >
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
                            (producto.cantidad || 0) -
                            (producto.reservados || 0)
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
                                            onClick={() =>
                                                !processing &&
                                                handleEdit(producto)
                                            }
                                            disabled={processing}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() =>
                                                !processing &&
                                                handleDelete(
                                                    producto.id,
                                                    producto.titulo
                                                )
                                            }
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
                                    />
                                ) : (
                                    <div className="producto-imagen-placeholder" />
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
                                                type="number"
                                                value={formData.precio}
                                                onChange={handleChange}
                                                className="input-edit"
                                            />
                                            <textarea
                                                name="descripcion"
                                                value={formData.descripcion}
                                                onChange={handleChange}
                                                className="textarea-edit"
                                            />

                                            <div className="info-grid">
                                                {[
                                                    "autor",
                                                    "genero",
                                                    "estilo",
                                                    "categoria",
                                                    "sello",
                                                ].map((campo) => (
                                                    <input
                                                        key={campo}
                                                        name={campo}
                                                        value={
                                                            formData[campo] ||
                                                            ""
                                                        }
                                                        onChange={handleChange}
                                                        className="input-edit"
                                                    />
                                                ))}
                                            </div>

                                            <div className="stock-info">
                                                <input
                                                    name="cantidad"
                                                    type="number"
                                                    value={formData.cantidad}
                                                    onChange={handleChange}
                                                    className="input-edit small"
                                                />
                                                <input
                                                    name="reservados"
                                                    type="number"
                                                    value={formData.reservados}
                                                    onChange={handleChange}
                                                    className="input-edit small"
                                                />
                                            </div>

                                            <div className="edit-actions">
                                                <button
                                                    className="btn-save"
                                                    onClick={() =>
                                                        handleSave(producto.id)
                                                    }
                                                    disabled={processing}
                                                >
                                                    {processing
                                                        ? "Guardando..."
                                                        : "Guardar"}
                                                </button>
                                                <button
                                                    className="btn-cancel"
                                                    onClick={handleCancel}
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
                                                <strong>Precio:</strong> $
                                                {producto.precio?.toLocaleString()}
                                            </p>

                                            <div className="info-grid">
                                                <p>
                                                    <strong>Autor:</strong>{" "}
                                                    {producto.autor}
                                                </p>
                                                <p>
                                                    <strong>Género:</strong>{" "}
                                                    {producto.genero} —{" "}
                                                    {producto.estilo}
                                                </p>
                                                <p>
                                                    <strong>Categoría:</strong>{" "}
                                                    {producto.categoria}
                                                </p>
                                                <p>
                                                    <strong>Sello:</strong>{" "}
                                                    {producto.sello}
                                                </p>
                                            </div>

                                            <p className="descripcion">
                                                {producto.descripcion}
                                            </p>

                                            <div className="stock-info">
                                                <div className="stock-item total">
                                                    <span>Stock</span>
                                                    <strong>
                                                        {producto.cantidad}
                                                    </strong>
                                                </div>
                                                <div className="stock-item reservados">
                                                    <span>Reservados</span>
                                                    <strong>
                                                        {producto.reservados}
                                                    </strong>
                                                </div>
                                                <div
                                                    className={`stock-item disponibles ${disponibles <= 1
                                                        ? "low"
                                                        : ""
                                                        }`}
                                                >
                                                    <span>Disponibles</span>
                                                    <strong>
                                                        {disponibles}
                                                    </strong>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={loaderRef} />
                </div>
            )}

            {modal && (
                <div className="admin-modal-overlay">
                    <div className="modal-admin">
                        <p>{modal.message}</p>

                        {modal.type === "confirm" && (
                            <div className="modal-admin-buttons">
                                <button
                                    className="confirm-btn"
                                    onClick={modal.onConfirm}
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
                            <p className="loading">⏳ {modal.message}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

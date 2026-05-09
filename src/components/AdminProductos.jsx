import { useMemo, useState, useRef } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAdminData } from "../context/AdminDataContext";

import "../styles/adminProductos.css";
import "../styles/admin.css";

const COLECCIONES = {
    productos: { label: "🎵 Drops", key: "productos", firebaseCollection: "productos" },
    productosTienda: { label: "🏪 Tienda", key: "productosTienda", firebaseCollection: "productosTienda" },
    equipamiento: { label: "🎛️ Equipamiento", key: "equipamiento", firebaseCollection: "equipamiento" },
};

const EDITABLE_NUMERIC_FIELDS = ["precio", "cantidad", "reservados"];

const DEFAULT_PRODUCT_VALUES = {
    titulo: "",
    precio: 0,
    descripcion: "",
    autor: "",
    genero: "",
    estilo: "",
    categoria: "",
    catalogo: "",
    escucha: "",
    sello: "",
    cantidad: 0,
    reservados: 0,
    imagen: "",
};

const parseNumericValue = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeProductForEdit = (producto = {}) => ({
    ...DEFAULT_PRODUCT_VALUES,
    ...producto,
    precio: parseNumericValue(producto?.precio),
    cantidad: parseNumericValue(producto?.cantidad),
    reservados: parseNumericValue(producto?.reservados),
});

const getTextOrFallback = (value, fallback = "Sin dato") => {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text === "" ? fallback : text;
};

export default function ProductosAdmin() {
    const { productos, productosTienda, equipamiento, loading, refetch } = useAdminData();

    const [busqueda, setBusqueda] = useState("");
    const [error, setError] = useState(null);
    const [editando, setEditando] = useState(null);
    const [formData, setFormData] = useState({});
    const [modal, setModal] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [orden, setOrden] = useState("mayorPrecio");
    const [coleccionSeleccionada, setColeccionSeleccionada] = useState("productos");

    // Infinite scroll (se mantiene aunque ahora cargue todo del contexto)
    const loaderRef = useRef(null);

    /* Mapear datos según colección seleccionada */
    const productosMap = {
        productos,
        productosTienda,
        equipamiento,
    };

    /* USE MEMO: Filtrar y ordenar productos */
    const productosFiltrados = useMemo(() => {
        let lista = [...(productosMap[coleccionSeleccionada] || [])];

        // 🔍 búsqueda
        if (busqueda.trim() !== "") {
            const q = busqueda.toLowerCase();
            lista = lista.filter((p) =>
                [p.titulo, p.autor, p.genero, p.estilo, p.categoria, p.catalogo, p.escucha, p.sello]
                    .some((campo) => campo?.toLowerCase().includes(q))
            );
        }

        // ↕️ orden
        lista.sort((a, b) =>
            orden === "mayorPrecio"
                ? (b.precio || 0) - (a.precio || 0)
                : (a.precio || 0) - (b.precio || 0)
        );

        return lista;
    }, [productosMap[coleccionSeleccionada], busqueda, orden]);
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
        setFormData(normalizeProductForEdit(producto));
    };

    const handleCancel = () => {
        setEditando(null);
        setFormData({});
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: EDITABLE_NUMERIC_FIELDS.includes(name) ? parseNumericValue(value) : value,
        }));
    };

    const handleImageUpload = async (event, productId) => {
        const inputElement = event.target;
        const file = inputElement.files?.[0];

        if (!file) return;

        setProcessing(true);
        setUploadingImage(true);
        setError(null);

        try {
            const extension = file.name.includes(".")
                ? file.name.split(".").pop()?.toLowerCase()
                : "jpg";
            const safeProductId = String(productId || formData.titulo || "producto")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9-_]/g, "-");
            const fileName = `${safeProductId}-${Date.now()}.${extension || "jpg"}`;
            const imageRef = ref(storage, `productos/${fileName}`);

            await uploadBytes(imageRef, file, {
                contentType: file.type || "image/jpeg",
            });

            const downloadURL = await getDownloadURL(imageRef);
            setFormData((prev) => ({ ...prev, imagen: downloadURL }));

            setModal({
                type: "success",
                message: "Imagen subida correctamente.",
                onClose: () => setModal(null),
            });
        } catch (err) {
            console.error(err);
            setModal({
                type: "error",
                message: "No se pudo subir la imagen.",
                onClose: () => setModal(null),
            });
        } finally {
            setProcessing(false);
            setUploadingImage(false);
            inputElement.value = "";
        }
    };

    const handleSave = (id) => {
        const { id: _omitId, ...restFormData } = formData;
        const payload = {
            ...DEFAULT_PRODUCT_VALUES,
            ...restFormData,
            precio: parseNumericValue(restFormData?.precio),
            cantidad: parseNumericValue(restFormData?.cantidad),
            reservados: parseNumericValue(restFormData?.reservados),
        };

        setModal({
            type: "confirm",
            message: "¿Guardar los cambios realizados en este producto?",
            onConfirm: async () => {
                setProcessing(true);
                setModal({ type: "loading", message: "Guardando cambios..." });

                try {
                    const firebaseCollection = COLECCIONES[coleccionSeleccionada].firebaseCollection;
                    await updateDoc(doc(db, firebaseCollection, id), payload);

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

    /* ELIMINAR */
    const handleDelete = (id, titulo) => {
        setModal({
            type: "confirm",
            message: `¿Eliminar el producto "${titulo}"?`,
            onConfirm: async () => {
                setProcessing(true);
                setModal({ type: "loading", message: "Eliminando producto..." });

                try {
                    const firebaseCollection = COLECCIONES[coleccionSeleccionada].firebaseCollection;
                    await deleteDoc(doc(db, firebaseCollection, id));
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

            {/* Selector de Colecciones */}
            <div className="colecciones-selector">
                {Object.entries(COLECCIONES).map(([key, coleccion]) => (
                    <button
                        key={key}
                        className={`coleccion-btn ${coleccionSeleccionada === key ? "activa" : ""}`}
                        onClick={() => {
                            setColeccionSeleccionada(key);
                            setBusqueda("");
                            setOrden("mayorPrecio");
                        }}
                    >
                        {coleccion.label}
                    </button>
                ))}
            </div>

            <div className="orden-selector">
                <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar por título, autor, género..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="search-input"
                    />
                    {busqueda && (
                        <button
                            className="search-clear-btn"
                            onClick={() => setBusqueda("")}
                            title="Limpiar búsqueda"
                        >
                            ✕
                        </button>
                    )}
                </div>

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

                                <div className="producto-top">
                                    {producto.imagen ? (
                                        <img
                                            src={producto.imagen}
                                            alt={producto.titulo}
                                            className="producto-imagen"
                                        />
                                    ) : (
                                        <div className="producto-imagen-placeholder" />
                                    )}

                                    <div className="producto-main">
                                        {isEditing ? (
                                            <>
                                                <label className="edit-field">
                                                    <span>Titulo</span>
                                                    <input
                                                        name="titulo"
                                                        value={formData.titulo ?? ""}
                                                        onChange={handleChange}
                                                        className="input-edit"
                                                        placeholder="Titulo"
                                                    />
                                                </label>
                                                <label className="edit-field">
                                                    <span>Precio</span>
                                                    <input
                                                        name="precio"
                                                        type="number"
                                                        value={formData.precio ?? 0}
                                                        onChange={handleChange}
                                                        className="input-edit"
                                                        placeholder="Precio"
                                                    />
                                                </label>
                                            </>
                                        ) : (
                                            <>
                                                <h3>{getTextOrFallback(producto.titulo, "Sin titulo")}</h3>
                                                <p className="precio">
                                                    <strong>Precio:</strong> $
                                                    {parseNumericValue(producto.precio).toLocaleString("es-AR")}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="producto-info">
                                    {isEditing ? (
                                        <>
                                            <div className="producto-body">
                                                <label className="edit-field">
                                                    <span>Descripcion</span>
                                                    <textarea
                                                        name="descripcion"
                                                        value={formData.descripcion ?? ""}
                                                        onChange={handleChange}
                                                        className="textarea-edit"
                                                        placeholder="Descripcion"
                                                    />
                                                </label>

                                                <label className="edit-field">
                                                    <span>Imagen (URL)</span>
                                                    <input
                                                        name="imagen"
                                                        value={formData.imagen ?? ""}
                                                        onChange={handleChange}
                                                        className="input-edit"
                                                        placeholder="https://..."
                                                    />
                                                </label>

                                                <label className="edit-field">
                                                    <span>Subir imagen</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(event) => handleImageUpload(event, producto.id)}
                                                        className="input-edit"
                                                        disabled={processing}
                                                    />
                                                </label>

                                                {formData.imagen && (
                                                    <p>
                                                        <strong>URL actual:</strong>{" "}
                                                        <a href={formData.imagen} target="_blank" rel="noreferrer">
                                                            Abrir imagen
                                                        </a>
                                                    </p>
                                                )}

                                                <div className="edit-grid">
                                                    {[
                                                        "autor",
                                                        "genero",
                                                        "estilo",
                                                        "categoria",
                                                        "catalogo",
                                                        "escucha",
                                                        "sello",
                                                    ].map((campo) => (
                                                        <label key={campo} className="edit-field">
                                                            <span>{campo.charAt(0).toUpperCase() + campo.slice(1)}</span>
                                                            <input
                                                                name={campo}
                                                                value={formData[campo] ?? ""}
                                                                onChange={handleChange}
                                                                className="input-edit"
                                                                placeholder={campo}
                                                            />
                                                        </label>
                                                    ))}
                                                </div>

                                                <div className="stock-info edit-stock">
                                                    <label className="edit-field compact">
                                                        <span>Cantidad</span>
                                                        <input
                                                            name="cantidad"
                                                            type="number"
                                                            value={formData.cantidad ?? 0}
                                                            onChange={handleChange}
                                                            className="input-edit small"
                                                        />
                                                    </label>
                                                    <label className="edit-field compact">
                                                        <span>Reservados</span>
                                                        <input
                                                            name="reservados"
                                                            type="number"
                                                            value={formData.reservados ?? 0}
                                                            onChange={handleChange}
                                                            className="input-edit small"
                                                        />
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="edit-actions">
                                                <button
                                                    className="btn-save"
                                                    onClick={() =>
                                                        handleSave(producto.id)
                                                    }
                                                    disabled={processing || uploadingImage}
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
                                        <div className="producto-body">
                                            <div className="info-grid">
                                                <p>
                                                    <strong>Autor:</strong>{" "}
                                                    {getTextOrFallback(producto.autor)}
                                                </p>
                                                <p>
                                                    <strong>Género:</strong>{" "}
                                                    {getTextOrFallback(producto.genero)} / {getTextOrFallback(producto.estilo)}
                                                </p>
                                                <p>
                                                    <strong>Categoría:</strong>{" "}
                                                    {getTextOrFallback(producto.categoria)}
                                                </p>
                                                <p>
                                                    <strong>Catálogo:</strong>{" "}
                                                    {getTextOrFallback(producto.catalogo)}
                                                </p>
                                                <p>
                                                    <strong>Escucha:</strong>{" "}
                                                    {getTextOrFallback(producto.escucha)}
                                                </p>
                                                <p>
                                                    <strong>Sello:</strong>{" "}
                                                    {getTextOrFallback(producto.sello)}
                                                </p>
                                                <p>
                                                    <strong>Imagen:</strong>{" "}
                                                    {producto.imagen ? (
                                                        <a href={producto.imagen} target="_blank" rel="noreferrer">
                                                            Ver URL de imagen
                                                        </a>
                                                    ) : (
                                                        "Sin dato"
                                                    )}
                                                </p>
                                            </div>

                                            <p className="descripcion">
                                                {getTextOrFallback(producto.descripcion, "Sin descripcion")}
                                            </p>

                                            <div className="stock-info">
                                                <div className="stock-item total">
                                                    <span>Stock</span>
                                                    <strong>
                                                        {parseNumericValue(producto.cantidad)}
                                                    </strong>
                                                </div>
                                                <div className="stock-item reservados">
                                                    <span>Reservados</span>
                                                    <strong>
                                                        {parseNumericValue(producto.reservados)}
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
                                        </div>
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
                                    X
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

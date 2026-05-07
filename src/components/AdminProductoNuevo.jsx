// AdminProductoNuevo.jsx
import { useState, useCallback } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import "../styles/adminProductoNuevo.css";

const INITIAL_FORM = {
    titulo: "",
    precio: 0,
    descripcion: "",
    autor: "",
    genero: "",
    estilo: "",
    categoria: "",
    sello: "",
    cantidad: 0,
    reservados: 0,
};

const COLECCIONES = {
    productos: { label: "🎵 Drops", key: "productos", firebaseCollection: "productos", catalogKey: "drop" },
    productosTienda: { label: "🏪 Tienda", key: "productosTienda", firebaseCollection: "productosTienda", catalogKey: "tienda" },
    equipamiento: { label: "🎛️ Equipamiento", key: "equipamiento", firebaseCollection: "equipamiento", catalogKey: "equipamiento" },
};

export default function AdminProductoNuevo({ onNuevo }) {
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [imagenFile, setImagenFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState(null);
    const [selectedCollection, setSelectedCollection] = useState("productos");
    const [showConfirm, setShowConfirm] = useState(false);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: ["precio", "cantidad", "reservados"].includes(name)
                ? Number(value)
                : value,
        }));
    }, []);

    const handleImagen = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImagenFile(file);
        setPreview(URL.createObjectURL(file));
    }, []);

    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM);
        setImagenFile(null);
        setPreview(null);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (loading) return;
        setShowConfirm(true);
    };

    const handleConfirmedSubmit = async () => {
        setShowConfirm(false);
        setLoading(true);
        setStatusMsg(null);

        try {
            let imagenUrl = "";

            if (imagenFile) {
                const storageRef = ref(
                    storage,
                    `productos/${Date.now()}-${imagenFile.name}`
                );
                await uploadBytes(storageRef, imagenFile);
                imagenUrl = await getDownloadURL(storageRef);
            }

            const coleccionConfig = COLECCIONES[selectedCollection];
            const nuevoProducto = {
                ...formData,
                imagen: imagenUrl,
                collectionName: coleccionConfig.firebaseCollection,
                catalogKey: coleccionConfig.catalogKey,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, coleccionConfig.firebaseCollection), nuevoProducto);

            if (onNuevo) onNuevo();

            resetForm();
            setSelectedCollection("productos");
            setStatusMsg("✅ Producto creado correctamente en " + coleccionConfig.label);

        } catch (error) {
            console.error("Error creando producto:", error);
            setStatusMsg("❌ Error al crear el producto.");
        } finally {
            setLoading(false);
            setTimeout(() => setStatusMsg(null), 4000);
        }
    };

    const handleCancel = () => {
        resetForm();
        setStatusMsg(null);
    };

    const coleccionActual = COLECCIONES[selectedCollection];

    return (
        <div>
            <h2 className="np-title">Carga de Productos</h2>

            {showConfirm && (
                <div className="np-confirm-overlay">
                    <div className="np-confirm-modal">
                        <div className="np-confirm-icon">{coleccionActual.label.split(" ")[0]}</div>
                        <h3 className="np-confirm-title">Confirmar creación</h3>
                        <p className="np-confirm-desc">
                            Estás por crear{" "}
                            <strong className="np-confirm-producto">"{formData.titulo || "Sin título"}"</strong>
                            {" "}en la colección
                        </p>
                        <span className="np-confirm-badge">{coleccionActual.label}</span>
                        <div className="np-confirm-btns">
                            <button
                                className="np-btn np-btn-guardar"
                                onClick={handleConfirmedSubmit}
                            >
                                Confirmar
                            </button>
                            <button
                                className="np-btn np-btn-cancelar"
                                onClick={() => setShowConfirm(false)}
                            >
                                Volver
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="np-container">
                <form className="np-form" onSubmit={handleSubmit}>

                    {/* Selector de Colección */}
                    <fieldset className="np-fieldset np-coleccion">
                        <legend className="np-legend">Selecciona la Colección</legend>

                        <div className="np-colecciones-selector">
                            {Object.entries(COLECCIONES).map(([key, coleccion]) => (
                                <label key={key} className="np-coleccion-radio">
                                    <input
                                        type="radio"
                                        name="coleccion"
                                        value={key}
                                        checked={selectedCollection === key}
                                        onChange={(e) => setSelectedCollection(e.target.value)}
                                    />
                                    <span>{coleccion.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="np-fieldset np-basic">
                        <legend className="np-legend">Información Básica</legend>

                        <label className="np-label">
                            Título
                            <input
                                className="np-input np-titulo"
                                name="titulo"
                                value={formData.titulo}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label className="np-label">
                            Precio
                            <input
                                className="np-input np-precio"
                                name="precio"
                                type="number"
                                value={formData.precio}
                                onChange={handleChange}
                                required
                            />
                        </label>
                    </fieldset>

                    <fieldset className="np-fieldset np-detalles">
                        <legend className="np-legend">Detalles del Producto</legend>

                        <div className="np-input-grid">
                            {["autor", "genero", "estilo", "categoria", "sello"].map((field) => (
                                <label className="np-label" key={field}>
                                    {field.charAt(0).toUpperCase() + field.slice(1)}
                                    <input
                                        className={`np-input np-${field}`}
                                        name={field}
                                        value={formData[field]}
                                        onChange={handleChange}
                                    />
                                </label>
                            ))}
                        </div>

                        <label className="np-label">
                            Descripción
                            <textarea
                                className="np-textarea np-descripcion"
                                name="descripcion"
                                value={formData.descripcion}
                                onChange={handleChange}
                            />
                        </label>
                    </fieldset>

                    <fieldset className="np-fieldset np-inventario">
                        <legend className="np-legend">Inventario</legend>

                        <div className="np-input-grid">
                            <label className="np-label">
                                Cantidad
                                <input
                                    className="np-input"
                                    name="cantidad"
                                    type="number"
                                    value={formData.cantidad}
                                    onChange={handleChange}
                                />
                            </label>

                            <label className="np-label">
                                Reservados
                                <input
                                    className="np-input"
                                    name="reservados"
                                    type="number"
                                    value={formData.reservados}
                                    onChange={handleChange}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <fieldset className="np-fieldset np-imagen">
                        <legend className="np-legend">Imagen del Producto</legend>

                        <label className="np-label">
                            Subir imagen
                            <input
                                className="np-input"
                                type="file"
                                accept="image/*"
                                onChange={handleImagen}
                            />
                        </label>

                        {preview && (
                            <img
                                className="np-imagen-preview"
                                src={preview}
                                alt="Preview"
                            />
                        )}
                    </fieldset>

                    {statusMsg && <p className="np-status">{statusMsg}</p>}

                    <div className="np-btns">
                        <button
                            className="np-btn np-btn-guardar"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Creando..." : "Crear Producto"}
                        </button>

                        <button
                            className="np-btn np-btn-cancelar"
                            type="button"
                            onClick={handleCancel}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
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

export default function AdminProductoNuevo({ onNuevo }) {
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [imagenFile, setImagenFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState(null);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

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

            const nuevoProducto = {
                ...formData,
                imagen: imagenUrl,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, "productos"), nuevoProducto);

            if (onNuevo) onNuevo(); // idealmente refetch()

            resetForm();
            setStatusMsg("✅ Producto creado correctamente.");

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

    return (
        <div>
            <h2 className="np-title">Carga de Productos</h2>

            <div className="np-container">
                <form className="np-form" onSubmit={handleSubmit}>

                    {/* Información básica */}
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

                    {/* Detalles */}
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

                    {/* Inventario */}
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

                    {/* Imagen */}
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
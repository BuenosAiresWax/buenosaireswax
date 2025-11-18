// NuevoProducto.jsx
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import "../styles/adminProductoNuevo.css";

export default function AdminProductoNuevo({ onNuevo }) {
    const [formData, setFormData] = useState({
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
        imagen: null,
    });

    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState(null);

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === "imagen" && files[0]) {
            setFormData(prev => ({ ...prev, imagen: files[0] }));
            setPreview(URL.createObjectURL(files[0]));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: ["precio", "cantidad", "reservados"].includes(name) ? Number(value) : value,
            }));
        }
    };

    const resetForm = () => {
        setFormData({
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
            imagen: null,
        });
        setPreview(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatusMsg(null);

        try {
            let imagenUrl = "";
            if (formData.imagen) {
                const storageRef = ref(storage, `productos/${Date.now()}-${formData.imagen.name}`);
                await uploadBytes(storageRef, formData.imagen);
                imagenUrl = await getDownloadURL(storageRef);
            }

            const nuevoProducto = { ...formData, imagen: imagenUrl, createdAt: serverTimestamp() };
            const docRef = await addDoc(collection(db, "productos"), nuevoProducto);

            if (onNuevo) onNuevo({ id: docRef.id, ...nuevoProducto });

            resetForm();

            // Mostrar mensaje temporal
            setStatusMsg("✅ Producto creado correctamente.");
            setTimeout(() => setStatusMsg(null), 4000);

        } catch (err) {
            console.error(err);
            setStatusMsg("❌ No se pudo crear el producto. Intenta nuevamente.");
            setTimeout(() => setStatusMsg(null), 4000);
        } finally {
            setLoading(false);
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
                    {/* Información Básica */}
                    <fieldset className="np-fieldset np-basic">
                        <legend className="np-legend">Información Básica</legend>
                        <label className="np-label">
                            Título
                            <input
                                className="np-input np-titulo"
                                name="titulo"
                                placeholder="Ej: A Deeper Life"
                                value={formData.titulo}
                                onChange={handleChange}
                                required
                            />
                        </label>
                        <label className="np-label">
                            Precio (ARS)
                            <input
                                className="np-input np-precio"
                                name="precio"
                                type="number"
                                placeholder="Ej: 108750"
                                value={formData.precio}
                                onChange={handleChange}
                                required
                            />
                        </label>
                    </fieldset>

                    {/* Detalles del Producto */}
                    <fieldset className="np-fieldset np-detalles">
                        <legend className="np-legend">Detalles del Producto</legend>
                        <div className="np-input-grid">
                            <label className="np-label">
                                Autor
                                <input
                                    className="np-input np-autor"
                                    name="autor"
                                    placeholder="Ej: Chaos In The CBD"
                                    value={formData.autor}
                                    onChange={handleChange}
                                />
                            </label>
                            <label className="np-label">
                                Género
                                <input
                                    className="np-input np-genero"
                                    name="genero"
                                    placeholder="Ej: House — Beats"
                                    value={formData.genero}
                                    onChange={handleChange}
                                />
                            </label>
                            <label className="np-label">
                                Estilo
                                <input
                                    className="np-input np-estilo"
                                    name="estilo"
                                    placeholder="Ej: House"
                                    value={formData.estilo}
                                    onChange={handleChange}
                                />
                            </label>
                            <label className="np-label">
                                Categoría
                                <input
                                    className="np-input np-categoria"
                                    name="categoria"
                                    placeholder="Ej: Vinilo"
                                    value={formData.categoria}
                                    onChange={handleChange}
                                />
                            </label>
                            <label className="np-label">
                                Sello
                                <input
                                    className="np-input np-sello"
                                    name="sello"
                                    placeholder="Ej: In Dust We Trus"
                                    value={formData.sello}
                                    onChange={handleChange}
                                />
                            </label>
                        </div>
                        <label className="np-label">
                            Descripción
                            <textarea
                                className="np-textarea np-descripcion"
                                name="descripcion"
                                placeholder="Breve descripción del producto"
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
                                Cantidad Disponible
                                <input
                                    className="np-input np-cantidad"
                                    name="cantidad"
                                    type="number"
                                    placeholder="Ej: 5"
                                    value={formData.cantidad}
                                    onChange={handleChange}
                                />
                            </label>
                            <label className="np-label">
                                Cantidad Reservada
                                <input
                                    className="np-input np-reservados"
                                    name="reservados"
                                    type="number"
                                    placeholder="Ej: 0"
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
                            Subir Imagen
                            <input
                                className="np-input np-imagen-input"
                                name="imagen"
                                type="file"
                                accept="image/*"
                                onChange={handleChange}
                            />
                        </label>
                        {preview && <img className="np-imagen-preview" src={preview} alt="Preview" />}
                    </fieldset>

                    {statusMsg && <p className="np-status">{statusMsg}</p>}

                    <div className="np-btns">
                        <button className="np-btn np-btn-guardar" type="submit" disabled={loading}>
                            {loading ? "Creando..." : "Crear Producto"}
                        </button>
                        <button className="np-btn np-btn-cancelar" type="button" onClick={handleCancel} disabled={loading}>
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

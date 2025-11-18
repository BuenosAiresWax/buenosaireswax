// src/components/AdminDashboard.jsx
import { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import AdminPedidos from "./AdminPedidos";
import AdminProductos from "./AdminProductos";
import AdminProductoNuevo from "./AdminProductoNuevo"; // Importar componente
import "../styles/adminDashboard.css";

export default function AdminDashboard() {
    const auth = getAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("Pedidos");

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/admin");
    };

    const handleNuevoProducto = (nuevoProducto) => {
        // Aquí se puede actualizar la lista de productos si quieres
        console.log("Producto creado:", nuevoProducto);
    };

    return (
        <div className="admin-container">
            <h1 className="admin-title">Panel de Administración</h1>

            {/* Controles superiores: tabs y logout */}
            <div className="admin-controls">
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        className={`tab-btn ${activeTab === "Pedidos" ? "active-tab" : ""}`}
                        onClick={() => setActiveTab("Pedidos")}
                    >
                        <span className="tab-icon">📬</span>
                        <span>Pedidos</span>
                    </button>

                    <button
                        className={`tab-btn ${activeTab === "Productos" ? "active-tab" : ""}`}
                        onClick={() => setActiveTab("Productos")}
                    >
                        <span className="tab-icon">📦</span>
                        <span>Productos</span>
                    </button>

                    <button
                        className={`tab-btn ${activeTab === "CrearProducto" ? "active-tab" : ""}`}
                        onClick={() => setActiveTab("CrearProducto")}
                    >
                        <span className="tab-icon">🆕</span>
                        <span>Crear Producto</span>
                    </button>
                </div>


                <button className="logout-btn" onClick={handleLogout}>
                    <span className="tab-icon">📤</span>
                    <span>Cerrar sesión</span>
                </button>

            </div>

            {/* Contenido según tab activo */}
            <div className="tab-content">
                {activeTab === "Pedidos" && <AdminPedidos />}
                {activeTab === "Productos" && <AdminProductos />}
                {activeTab === "CrearProducto" && (
                    <AdminProductoNuevo onNuevo={handleNuevoProducto} />
                )}
            </div>
        </div>
    );
}

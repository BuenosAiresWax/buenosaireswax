// src/components/AdminDashboard.jsx
import { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import AdminPedidos from "./AdminPedidos";
import AdminProductos from "./AdminProductos";
// import ProductosAdmin from "./ProductosAdmin"; // cuando tengas listo el módulo de productos
import "../styles/adminDashboard.css";

export default function AdminDashboard() {
    const auth = getAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("Pedidos");

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/admin");
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
                        Pedidos
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "Productos" ? "active-tab" : ""}`}
                        onClick={() => setActiveTab("Productos")}
                    >
                        Productos
                    </button>
                </div>

                <button className="logout-btn" onClick={handleLogout}>
                    Cerrar sesión
                </button>
            </div>

            {/* Contenido según tab activo */}
            <div className="tab-content">
                {activeTab === "Pedidos" && <AdminPedidos />}
                {activeTab === "Productos" && <AdminProductos />}
            </div>
        </div>
    );
}

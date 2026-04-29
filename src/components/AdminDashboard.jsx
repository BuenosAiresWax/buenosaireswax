// src/components/AdminDashboard.jsx
import { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { AdminDataProvider, useAdminData } from "../context/AdminDataContext";

import AdminPedidos from "./AdminPedidos";
import AdminProductos from "./AdminProductos";
import AdminProductoNuevo from "./AdminProductoNuevo";
import AdminOverview from "./AdminOverview";

import "../styles/adminDashboard.css";

// Wrapper para poder usar el contexto dentro de AdminProductoNuevo
function AdminDashboardContent() {
    const { refetch } = useAdminData(); // ⬅ obtenemos refetch del contexto
    const auth = getAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("Overview");

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/admin");
    };

    return (
        <div className="admin-container">
            <h1 className="admin-title">Panel de Administración</h1>

            <div className="admin-controls">
                <div style={{ display: "flex", gap: "0.5rem" }}>

                    <button
                        className={`tab-btn ${activeTab === "Overview" ? "active-tab" : ""}`}
                        onClick={() => setActiveTab("Overview")}
                    >
                        <span className="tab-icon">📊</span>
                        <span>Overview</span>
                    </button>

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

                    <button
                        className="tab-btn tab-btn-realtime"
                        onClick={() => navigate("/admin/pedidos-catalogos")}
                    >
                        <span className="tab-icon">🔔</span>
                        <span>Pedidos Tienda + Equipamiento</span>
                    </button>
                </div>

                <button className="logout-btn" onClick={handleLogout}>
                    <span className="tab-icon">📤</span>
                    <span>Cerrar sesión</span>
                </button>
            </div>

            <div className="tab-content">
                {activeTab === "Overview" && <AdminOverview />}
                {activeTab === "Pedidos" && <AdminPedidos />}
                {activeTab === "Productos" && <AdminProductos />}
                {activeTab === "CrearProducto" && <AdminProductoNuevo onNuevo={refetch} />}
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    return (
        <AdminDataProvider>
            <AdminDashboardContent />
        </AdminDataProvider>
    );
}

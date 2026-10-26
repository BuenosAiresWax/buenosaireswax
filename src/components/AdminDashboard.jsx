// src/components/AdminDashboard.jsx
import { useEffect, useRef, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { AdminDataProvider, useAdminData } from "../context/AdminDataContext";

import AdminPedidos from "./AdminPedidos";
import AdminPedidosCatalogos from "./AdminPedidosCatalogos";
import AdminProductos from "./AdminProductos";
import AdminProductoNuevo from "./AdminProductoNuevo";
import AdminOverview from "./AdminOverview";
import AdminVinylClub from "./AdminVinylClub";
import AdminSiteFeatures from "./AdminSiteFeatures";

import "../styles/adminDashboard.css";

const PEDIDOS_ITEMS = [
    {
        tab: "Pedidos",
        icon: "📬",
        label: "Pedidos",
        description: "Bandeja general de pedidos del drop",
    },
    {
        tab: "PedidosTienda",
        icon: "🛍️",
        label: "Pedidos tienda",
        description: "Pedidos de la tienda en tiempo real",
    },
    {
        tab: "Productos",
        icon: "📦",
        label: "Productos",
        description: "Inventario, precios y stock",
    },
    {
        tab: "CrearProducto",
        icon: "🆕",
        label: "Crear producto",
        description: "Cargar un disco nuevo al catálogo",
    },
];

const PEDIDOS_TABS = PEDIDOS_ITEMS.map((item) => item.tab);

// Wrapper para poder usar el contexto dentro de AdminProductoNuevo
function AdminDashboardContent() {
    const { refetch } = useAdminData();
    const auth = getAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("Overview");
    const [pedidosMenuOpen, setPedidosMenuOpen] = useState(false);
    const pedidosGroupRef = useRef(null);

    const pedidosGroupActive = PEDIDOS_TABS.includes(activeTab);
    const activePedidosItem = PEDIDOS_ITEMS.find((item) => item.tab === activeTab);

    useEffect(() => {
        if (!pedidosMenuOpen) return;

        const handleClickOutside = (event) => {
            if (pedidosGroupRef.current && !pedidosGroupRef.current.contains(event.target)) {
                setPedidosMenuOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setPedidosMenuOpen(false);
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [pedidosMenuOpen]);

    const selectTab = (tab) => {
        setActiveTab(tab);
        setPedidosMenuOpen(false);
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/admin");
    };

    return (
        <div className="admin-container">
            <div className="admin-heading">
                <h1 className="admin-title">Panel de Administración</h1>
                <p className="admin-subtitle">
                    Gestioná pedidos, catálogo, Vinyl Club y la configuración del sitio desde un solo lugar.
                </p>
            </div>

            <div className="admin-controls">
                <nav className="admin-nav" aria-label="Navegación del panel">
                    <button
                        type="button"
                        className={`admin-nav-item ${activeTab === "Overview" ? "is-active" : ""}`}
                        onClick={() => selectTab("Overview")}
                        aria-current={activeTab === "Overview" ? "page" : undefined}
                    >
                        <span className="admin-nav-icon" aria-hidden="true">📊</span>
                        <span className="admin-nav-copy">
                            <span className="admin-nav-label">Overview</span>
                            <span className="admin-nav-sub">Métricas generales</span>
                        </span>
                    </button>

                    <div className="admin-nav-group" ref={pedidosGroupRef}>
                        <button
                            type="button"
                            className={`admin-nav-item admin-nav-item-group ${pedidosGroupActive ? "is-active" : ""} ${pedidosMenuOpen ? "is-open" : ""}`}
                            onClick={() => setPedidosMenuOpen((prev) => !prev)}
                            aria-haspopup="menu"
                            aria-expanded={pedidosMenuOpen}
                            aria-current={pedidosGroupActive ? "page" : undefined}
                        >
                            <span className="admin-nav-icon" aria-hidden="true">📬</span>
                            <span className="admin-nav-copy">
                                <span className="admin-nav-label">
                                    Pedidos
                                    <span className="admin-nav-badge">4</span>
                                </span>
                                <span className="admin-nav-sub">
                                    {activePedidosItem ? activePedidosItem.label : "Pedidos y catálogo"}
                                </span>
                            </span>
                            <span className={`admin-nav-chevron ${pedidosMenuOpen ? "is-open" : ""}`} aria-hidden="true">
                                ▾
                            </span>
                        </button>

                        {pedidosMenuOpen && (
                            <div className="admin-nav-dropdown" role="menu" aria-label="Pedidos y catálogo">
                                <p className="admin-nav-dropdown-title">Pedidos y catálogo</p>

                                {PEDIDOS_ITEMS.map((item) => {
                                    const isActive = activeTab === item.tab;

                                    return (
                                        <button
                                            key={item.tab}
                                            type="button"
                                            role="menuitem"
                                            className={`admin-nav-dropdown-item ${isActive ? "is-active" : ""}`}
                                            onClick={() => selectTab(item.tab)}
                                        >
                                            <span className="admin-nav-dropdown-icon" aria-hidden="true">
                                                {item.icon}
                                            </span>
                                            <span className="admin-nav-dropdown-copy">
                                                <span className="admin-nav-dropdown-label">{item.label}</span>
                                                <span className="admin-nav-dropdown-desc">{item.description}</span>
                                            </span>
                                            {isActive && (
                                                <span className="admin-nav-check" aria-hidden="true">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        className={`admin-nav-item ${activeTab === "VinylClub" ? "is-active" : ""}`}
                        onClick={() => selectTab("VinylClub")}
                        aria-current={activeTab === "VinylClub" ? "page" : undefined}
                    >
                        <span className="admin-nav-icon" aria-hidden="true">🎧</span>
                        <span className="admin-nav-copy">
                            <span className="admin-nav-label">Vinyl Club</span>
                            <span className="admin-nav-sub">Suscriptores</span>
                        </span>
                    </button>

                    <button
                        type="button"
                        className={`admin-nav-item ${activeTab === "Sitio" ? "is-active" : ""}`}
                        onClick={() => selectTab("Sitio")}
                        aria-current={activeTab === "Sitio" ? "page" : undefined}
                    >
                        <span className="admin-nav-icon" aria-hidden="true">⚙️</span>
                        <span className="admin-nav-copy">
                            <span className="admin-nav-label">Sitio</span>
                            <span className="admin-nav-sub">Configuración</span>
                        </span>
                    </button>
                </nav>

                <button type="button" className="logout-btn" onClick={handleLogout}>
                    <span className="tab-icon" aria-hidden="true">📤</span>
                    <span>Cerrar sesión</span>
                </button>
            </div>

            <div className="tab-content">
                {activeTab === "Overview" && <AdminOverview />}
                {activeTab === "Pedidos" && <AdminPedidos />}
                {activeTab === "PedidosTienda" && (
                    <AdminPedidosCatalogos onBack={() => selectTab("Pedidos")} />
                )}
                {activeTab === "Productos" && <AdminProductos />}
                {activeTab === "CrearProducto" && <AdminProductoNuevo onNuevo={refetch} />}
                {activeTab === "VinylClub" && <AdminVinylClub />}
                {activeTab === "Sitio" && <AdminSiteFeatures />}
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

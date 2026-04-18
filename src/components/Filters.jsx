import { useState, useEffect } from "react";
import "../styles/styles.css";
import '../styles/Filters.css'
import searchIcon from "../../assets/icons/lupa.png";

const iconProps = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
};

function CheckIcon() {
    return (
        <svg {...iconProps}>
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function GridIcon() {
    return (
        <svg {...iconProps}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}

function ClearIcon() {
    return (
        <svg {...iconProps}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    );
}

function Filters({
    filtroTexto,
    setFiltroTexto,
    generoSeleccionado,
    setGeneroSeleccionado,
    estiloSeleccionado,
    setEstiloSeleccionado,
    selloSeleccionado,
    setSelloSeleccionado,
    autorSeleccionado,
    setAutorSeleccionado,
    verDisponibles,
    setVerDisponibles,
    productos,
    generos,
    estilos,
    sellos,
    autores,
    sidebarVisible,
    setSidebarVisible,
}) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const limpiarFiltros = () => {
        setFiltroTexto("");
        setGeneroSeleccionado("");
        setEstiloSeleccionado("");
        setSelloSeleccionado("");
        setAutorSeleccionado("");
        setVerDisponibles(false);
    };

    return (
        <div className="filters-container">
            <div className="filters-group">
                {/* Botón móvil para filtros */}
                {isMobile && (
                    <button
                        className="mobile-filter-btn filters-item"
                        onClick={() => setSidebarVisible(!sidebarVisible)}
                    >
                        Filtros {sidebarVisible ? '−' : '+'}
                    </button>
                )}

                {/* Campo de búsqueda */}
                <div className="search-input-container filters-item">
                    <img src={searchIcon} alt="Buscar" className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por título..."
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filters-actions">
                    {/* Botón ver disponibles */}
                    <button
                        className={`filters-action-btn availability-btn ${verDisponibles ? "is-active" : ""}`}
                        onClick={() => setVerDisponibles(!verDisponibles)}
                        aria-pressed={verDisponibles}
                    >
                        <span className="btn-icon">
                            {verDisponibles ? <GridIcon /> : <CheckIcon />}
                        </span>
                        <span className="btn-label">{verDisponibles ? "Ver todo" : "Disponibles"}</span>
                    </button>

                    {/* Botón limpiar */}
                    <button className="filters-action-btn clear-btn" onClick={limpiarFiltros}>
                        <span className="btn-icon">
                            <ClearIcon />
                        </span>
                        <span className="btn-label">Limpiar</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Filters;

import { useState, useEffect } from "react";
import "../styles/styles.css";
import '../styles/Filters.css'
import searchIcon from "../../assets/icons/lupa.png";

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

                {/* Botón ver disponibles */}
                <button
                    className={`filters-item ${verDisponibles ? "activo" : ""}`}
                    onClick={() => setVerDisponibles(!verDisponibles)}
                >
                    {verDisponibles ? "Ver Todos" : "Ver Disponibles"}
                </button>

                {/* Botón limpiar */}
                <button className="filters-clear-btn filters-item" onClick={limpiarFiltros}>
                    Limpiar filtros
                </button>
            </div>
        </div>
    );
}

export default Filters;

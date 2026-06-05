import { useState, useEffect, useRef } from "react";
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

function FilterIcon() {
    return (
        <svg {...iconProps}>
            <path d="M4 6h16" />
            <path d="M7 12h10" />
            <path d="M10 18h4" />
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

function SelectFilter({ value, onChange, options, placeholder }) {
    return (
        <div className="filter-select-wrapper">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`filter-select ${value ? "is-active" : ""}`}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <svg className="select-chevron" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 9 6 6 6-6" />
            </svg>
        </div>
    );
}

function Filters({
    filtroTexto,
    setFiltroTexto,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
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
    verSale,
    setVerSale,
    productos,
    generos,
    estilos,
    sellos,
    autores,
    sidebarVisible,
    setSidebarVisible,
}) {
    const [isMobile, setIsMobile] = useState(false);
    const filtersContainerRef = useRef(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const rootStyle = document.documentElement.style;
        const updateMobileStickyOffsets = () => {
            if (!filtersContainerRef.current || window.innerWidth >= 768) {
                rootStyle.removeProperty("--mobile-filters-height");
                rootStyle.removeProperty("--mobile-player-top");
                return;
            }

            const filtersHeight = Math.ceil(filtersContainerRef.current.getBoundingClientRect().height);
            rootStyle.setProperty("--mobile-filters-height", `${filtersHeight}px`);
            rootStyle.setProperty("--mobile-player-top", `${filtersHeight}px`);
        };

        updateMobileStickyOffsets();

        const resizeObserver = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(updateMobileStickyOffsets)
            : null;

        if (resizeObserver && filtersContainerRef.current) {
            resizeObserver.observe(filtersContainerRef.current);
        }

        window.addEventListener("resize", updateMobileStickyOffsets);
        return () => {
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener("resize", updateMobileStickyOffsets);
        };
    }, []);

    const limpiarFiltros = () => {
        setFiltroTexto("");
        setCategoriaSeleccionada("");
        setGeneroSeleccionado("");
        setEstiloSeleccionado("");
        setSelloSeleccionado("");
        setAutorSeleccionado("");
        setVerDisponibles(false);
        setVerSale(false);
    };

    const hayFiltrosActivos =
        filtroTexto ||
        categoriaSeleccionada ||
        generoSeleccionado ||
        estiloSeleccionado ||
        selloSeleccionado ||
        autorSeleccionado ||
        verDisponibles ||
        verSale;

    return (
        <div ref={filtersContainerRef} className="filters-container">
            {/* Fila 1: búsqueda + acciones */}
            <div className="filters-group">
                {/* Campo de búsqueda mejorado */}
                <div className="search-input-container filters-item">
                    <img src={searchIcon} alt="Buscar" className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por título, artista..."
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        className="search-input"
                    />
                    {filtroTexto && (
                        <button className="search-clear-btn" onClick={() => setFiltroTexto("")} aria-label="Limpiar búsqueda">
                            <ClearIcon />
                        </button>
                    )}
                </div>

                <div className="filters-actions">
                    {/* Botón móvil para filtros */}
                    {isMobile && (
                        <button
                            className={`mobile-filter-btn ${sidebarVisible ? "is-active" : ""}`}
                            onClick={() => setSidebarVisible(!sidebarVisible)}
                        >
                            <span className="btn-icon">
                                <FilterIcon />
                            </span>
                            <span className="btn-label">FILTROS</span>
                        </button>
                    )}

                    {/* Botón ver disponibles */}
                    <button
                        className={`filters-action-btn availability-btn ${verDisponibles ? "is-active" : ""}`}
                        onClick={() => setVerDisponibles(!verDisponibles)}
                        aria-pressed={verDisponibles}
                    >
                        <span className="btn-icon">
                            {verDisponibles ? <GridIcon /> : <CheckIcon />}
                        </span>
                        <span className="btn-label">{verDisponibles ? "Todo" : "Disponibles"}</span>
                    </button>

                    {!isMobile && (
                        <button
                            className={`filters-action-btn availability-btn ${verSale ? "is-active" : ""}`}
                            onClick={() => setVerSale(!verSale)}
                            aria-pressed={verSale}
                        >
                            <span className="btn-icon">
                                <GridIcon />
                            </span>
                            <span className="btn-label">Sale</span>
                        </button>
                    )}

                    {/* Botón limpiar */}
                    <button
                        className={`filters-action-btn clear-btn ${hayFiltrosActivos ? "has-filters" : ""}`}
                        onClick={limpiarFiltros}
                    >
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

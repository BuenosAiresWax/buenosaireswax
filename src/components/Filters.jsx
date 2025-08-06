import { useMemo } from "react";
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
    verDisponibles, // nuevo filtro
    setVerDisponibles, // setter
    productos,
}) {
    const generos = useMemo(() => [...new Set(productos.map((p) => p.genero).filter(Boolean))], [productos]);
    const estilos = useMemo(() => [...new Set(productos.map((p) => p.estilo).filter(Boolean))], [productos]);
    const sellos = useMemo(() => [...new Set(productos.map((p) => p.sello).filter(Boolean))], [productos]);
    const autores = useMemo(() => [...new Set(productos.map((p) => p.autor).filter(Boolean))], [productos]);

    const limpiarFiltros = () => {
        setFiltroTexto("");
        setGeneroSeleccionado("");
        setEstiloSeleccionado("");
        setSelloSeleccionado("");
        setAutorSeleccionado("");
        setVerDisponibles(false); // reseteamos el filtro
    };

    return (
        <div className="filters-container">
            <div className="filters-group">
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

                <select value={estiloSeleccionado} onChange={(e) => setEstiloSeleccionado(e.target.value)} className="filters-item">
                    <option value="">Estilos</option>
                    {estilos.map((e) => (
                        <option key={e} value={e}>{e}</option>
                    ))}
                </select>

                <select value={generoSeleccionado} onChange={(e) => setGeneroSeleccionado(e.target.value)} className="filters-item">
                    <option value="">Géneros</option>
                    {generos.map((g) => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>

                <select value={selloSeleccionado} onChange={(e) => setSelloSeleccionado(e.target.value)} className="filters-item">
                    <option value="">Sellos</option>
                    {sellos.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select value={autorSeleccionado} onChange={(e) => setAutorSeleccionado(e.target.value)} className="filters-item">
                    <option value="">Artistas</option>
                    {autores.map((a) => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>

                {/* Botón Ver Disponibles */}
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

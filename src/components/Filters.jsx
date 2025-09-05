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
    verDisponibles,
    setVerDisponibles,
    productos,
}) {
    // 🔹 Función de orden personalizado: alfabético y números al final
    // 🔹 Función de orden personalizado: letras → números → símbolos
    const ordenarOpciones = (arr) =>
        arr.sort((a, b) => {
            const tipo = (str) => {
                if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(str)) return 1; // letras
                if (/^\d/.test(str)) return 2; // números
                return 3; // símbolos u otros
            };

            const tipoA = tipo(a);
            const tipoB = tipo(b);

            if (tipoA !== tipoB) return tipoA - tipoB;
            return a.localeCompare(b, "es", { sensitivity: "base" }); // orden alfabético
        });

    const generos = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.genero).filter(Boolean))]), [productos]);
    const estilos = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.estilo).filter(Boolean))]), [productos]);
    const sellos = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.sello).filter(Boolean))]), [productos]);
    const autores = useMemo(() => ordenarOpciones([...new Set(productos.map((p) => p.autor).filter(Boolean))]), [productos]);

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

                {/* 🔹 Botón siempre antes que "Sellos" */}
                <button
                    className={`filters-item ${verDisponibles ? "activo" : ""}`}
                    onClick={() => setVerDisponibles(!verDisponibles)}
                >
                    {verDisponibles ? "Ver Todos" : "Ver Disponibles"}
                </button>

                <select
                    value={estiloSeleccionado}
                    onChange={(e) => setEstiloSeleccionado(e.target.value)}
                    className="filters-item"
                >
                    <option value="">Estilos</option>
                    {estilos.map((e) => (
                        <option key={e} value={e}>{e}</option>
                    ))}
                </select>

                <select
                    value={generoSeleccionado}
                    onChange={(e) => setGeneroSeleccionado(e.target.value)}
                    className="filters-item"
                >
                    <option value="">Géneros</option>
                    {generos.map((g) => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>

                <select
                    value={selloSeleccionado}
                    onChange={(e) => setSelloSeleccionado(e.target.value)}
                    className="filters-item"
                >
                    <option value="">Sellos</option>
                    {sellos.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select
                    value={autorSeleccionado}
                    onChange={(e) => setAutorSeleccionado(e.target.value)}
                    className="filters-item"
                >
                    <option value="">Artistas</option>
                    {autores.map((a) => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>

                {/* Botón limpiar */}
                <button className="filters-clear-btn filters-item" onClick={limpiarFiltros}>
                    Limpiar filtros
                </button>
            </div>
        </div>
    );
}

export default Filters;

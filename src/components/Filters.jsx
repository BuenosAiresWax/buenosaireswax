function Filters({
    filtroTexto,
    setFiltroTexto,
    filtroSeleccionado,
    setFiltroSeleccionado,
    productos,
}) {
    // Extraer categorías únicas
    const categorias = [
        ...new Set(productos.map((p) => p.categoria).filter(Boolean)),
    ];

    // Extraer autores únicos
    const autores = [
        ...new Set(productos.map((p) => p.autor).filter(Boolean)),
    ];

    // Combinar todos en una lista
    const opciones = [
        { label: "Todos", value: "" },
        ...categorias.map((cat) => ({ label: cat, value: cat })),
        ...autores.map((autor) => ({ label: autor, value: autor })),
    ];

    return (
        <div className="filters">
            <input
                type="text"
                placeholder="Buscar..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
            />

            <select
                value={filtroSeleccionado}
                onChange={(e) => setFiltroSeleccionado(e.target.value)}
            >
                {opciones.map((op) => (
                    <option key={op.value} value={op.value}>
                        {op.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default Filters;

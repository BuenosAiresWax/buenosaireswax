function Filters({
    filtroTexto,
    setFiltroTexto,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    productos,
}) {
    const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))];
    const autores = [...new Set(productos.map((p) => p.autor).filter(Boolean))];

    return (
        <div className="filters">
            <input
                type="text"
                placeholder="Buscar..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
            />

            <select
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
            >
                <option value="">Todos</option>

                <optgroup label="Categorías">
                    {categorias.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                </optgroup>

                <optgroup label="Autores">
                    {autores.map((autor) => (
                        <option key={autor} value={autor}>
                            {autor}
                        </option>
                    ))}
                </optgroup>
            </select>
        </div>
    );
}

export default Filters;

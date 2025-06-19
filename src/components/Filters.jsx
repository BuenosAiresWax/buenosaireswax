function Filters({
    filtroTexto,
    setFiltroTexto,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
}) {
    const categorias = ["house", "techno"]; // 🔹 Podés agregar más acá

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
                <option value="">Todas las categorías</option>
                {categorias.map((cat) => (
                    <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default Filters;

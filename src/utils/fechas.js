/* --------------------------------------------------
   Convierte cualquier formato común de fecha a Date
-------------------------------------------------- */

const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

function parseFechaDesdeString(fechaStr) {
    if (!fechaStr || typeof fechaStr !== "string") return new Date(0);

    try {
        // Soporta ambos formatos:
        // - "12 de marzo de 2025, 3:25 p. m."
        // - "14 de mayo de 2026 a las 11:41 a. m."
        const texto = fechaStr
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

        const match = texto.match(
            /^(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})(?:,|\s+a\s+las\s+)(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\.?)?$/i,
        );

        if (match) {
            const [, diaStr, mesStr, anioStr, horaStr, minStr, meridiem] = match;
            const dia = parseInt(diaStr, 10);
            const mes = meses[mesStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? 0;
            const anio = parseInt(anioStr, 10);
            let hora = parseInt(horaStr, 10);
            const min = parseInt(minStr, 10);

            if (meridiem === "p" && hora < 12) hora += 12;
            if (meridiem === "a" && hora === 12) hora = 0;

            return new Date(anio, mes, dia, hora, min);
        }

        // Compatibilidad con Date.parse para strings ISO u otros formatos válidos
        const parsed = new Date(fechaStr);
        if (!isNaN(parsed)) return parsed;

        return new Date(0);
    } catch (e) {
        const d = new Date(fechaStr);
        return isNaN(d) ? new Date(0) : d;
    }
}

export function normalizarFecha(campoFecha) {
    if (!campoFecha) return new Date(0);

    // Firestore Timestamp
    if (typeof campoFecha === "object" && typeof campoFecha.toDate === "function") {
        return campoFecha.toDate();
    }

    // Ya es Date
    if (campoFecha instanceof Date) return campoFecha;

    // Timestamp numérico
    if (typeof campoFecha === "number") return new Date(campoFecha);

    // String
    if (typeof campoFecha === "string") {
        const parsed = parseFechaDesdeString(campoFecha);
        if (parsed instanceof Date && !isNaN(parsed)) return parsed;
    }

    // Último recurso
    const d = new Date(campoFecha);
    if (!isNaN(d)) return d;

    return new Date(0);
}

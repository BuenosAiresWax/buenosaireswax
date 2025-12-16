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
        // Ej: "12 de marzo de 2025, 3:25 p. m."
        const [diaMes, tiempo] = fechaStr.split(", ");
        const partes = diaMes.split(" ");

        const dia = parseInt(partes[0]);
        const mes = partes[2]?.toLowerCase();
        const año = parseInt(partes[4]);

        let [hora, min] = tiempo.split(":");
        let pm = false;

        if (min.includes("p. m.")) {
            pm = true;
            min = min.replace(" p. m.", "");
        } else {
            min = min.replace(" a. m.", "");
        }

        hora = parseInt(hora);
        min = parseInt(min);

        if (pm && hora < 12) hora += 12;
        if (!pm && hora === 12) hora = 0;

        return new Date(año, meses[mes] ?? 0, dia, hora, min);
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

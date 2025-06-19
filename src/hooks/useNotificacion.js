import { useState, useRef, useEffect, useCallback } from "react";

export function useNotificacion(duracion = 2500) {
    const [mensaje, setMensaje] = useState("");
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef(null);

    const mostrarMensaje = useCallback((texto) => {
        setMensaje(texto);
        setVisible(true);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setVisible(false);
            setMensaje("");
        }, duracion);
    }, [duracion]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return { mensaje, visible, mostrarMensaje };
}

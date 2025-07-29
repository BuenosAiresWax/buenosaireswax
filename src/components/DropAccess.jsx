import { useEffect, useState, useRef } from "react";
import "../styles/DropAccess.css";
import dropTitleImg from "../../assets/img/countdown.png";

function DropAccess({ fechaObjetivo, onAccesoPermitido, ocultarFormulario = false }) {
    const [tiempoRestante, setTiempoRestante] = useState("00:00:00:00");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [animando, setAnimando] = useState(true);

    const animacionRef = useRef(null);
    const countdownRef = useRef(null);

    // Función para formatear milisegundos en "DD:HH:MM:SS"
    const formatearTiempo = (milisegundos) => {
        const totalSegundos = Math.floor(milisegundos / 1000);

        const dias = String(Math.floor(totalSegundos / (3600 * 24))).padStart(2, "0");
        const horas = String(Math.floor((totalSegundos % (3600 * 24)) / 3600)).padStart(2, "0");
        const minutos = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, "0");
        const segundos = String(totalSegundos % 60).padStart(2, "0");

        return `${dias}:${horas}:${minutos}:${segundos}`;
    };

    useEffect(() => {
        const fechaObj = new Date(fechaObjetivo);
        const ahora = new Date();
        const diferenciaTotal = fechaObj - ahora;

        if (diferenciaTotal <= 0) {
            // Fecha pasada: mostrar todo 0 y no animar
            setTiempoRestante("00:00:00:00");
            setAnimando(false);
            return;
        }

        let tiempoAnimado = 0;
        const duracionAnimacion = 1000; // animación de 2 segundos para subir desde 0 a diferenciaTotal
        const pasosAnimacion = 60; // 40 pasos de animación (cada 50ms aprox)
        const incremento = diferenciaTotal / pasosAnimacion;
        let contadorPasos = 0;

        // Animación incrementando desde 0 hasta la diferenciaTotal
        animacionRef.current = setInterval(() => {
            tiempoAnimado += incremento;
            contadorPasos++;
            if (contadorPasos >= pasosAnimacion) {
                clearInterval(animacionRef.current);
                setAnimando(false);
                tiempoAnimado = diferenciaTotal;
                setTiempoRestante(formatearTiempo(tiempoAnimado));

                // Luego empezar el countdown normal decreciendo
                countdownRef.current = setInterval(() => {
                    const ahora2 = new Date();
                    const diff = fechaObj - ahora2;
                    if (diff <= 0) {
                        setTiempoRestante("00:00:00:00");
                        clearInterval(countdownRef.current);
                    } else {
                        setTiempoRestante(formatearTiempo(diff));
                    }
                }, 1000);

            } else {
                setTiempoRestante(formatearTiempo(tiempoAnimado));
            }
        }, duracionAnimacion / pasosAnimacion);

        return () => {
            clearInterval(animacionRef.current);
            clearInterval(countdownRef.current);
        };
    }, [fechaObjetivo]);

    const manejarSubmit = (e) => {
        e.preventDefault();
        const contraseñaCorrecta = import.meta.env.VITE_DROP_CODE;
        if (password === contraseñaCorrecta) {
            onAccesoPermitido();
            setError("");
        } else {
            setError("Contraseña incorrecta");
        }
    };

    return (
        <div className="drop-access">
            <img src={dropTitleImg} alt="Drop #004" className="drop-title-image" />
            <div className="countdown">{tiempoRestante}</div>

            {!ocultarFormulario && (
                <form onSubmit={manejarSubmit} className="formulario-acceso">
                    <label>Ingresa la contraseña para acceder</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="xxxxx"
                    />
                    {error && <p className="error">{error}</p>}

                    <button type="submit" className="btn-enviar-countdown">
                        Acceder
                    </button>
                </form>
            )}
        </div>
    );
}

export default DropAccess;

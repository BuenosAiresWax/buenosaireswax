import React, { useState, useEffect } from "react";
import "../styles/YoutubePopup.css";

const YouTubePopup = () => {
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const isClosed = localStorage.getItem("youtubePopupClosed");
        if (isClosed === "true") return;

        // Detectar primera interacción
        const handleFirstInteraction = () => {
            if (!started) {
                setStarted(true);
                setTimeout(() => {
                    setVisible(true);
                }, 5000); // esperar 3s después de la primera interacción
            }
        };

        window.addEventListener("mousemove", handleFirstInteraction, { once: true });
        window.addEventListener("keydown", handleFirstInteraction, { once: true });
        window.addEventListener("touchstart", handleFirstInteraction, { once: true });

        return () => {
            window.removeEventListener("mousemove", handleFirstInteraction);
            window.removeEventListener("keydown", handleFirstInteraction);
            window.removeEventListener("touchstart", handleFirstInteraction);
        };
    }, [started]);

    const handleClose = () => {
        setClosing(true);
        setTimeout(() => {
            setVisible(false);
            localStorage.setItem("youtubePopupClosed", "true");
        }, 400); // igual al tiempo de animación
    };

    if (!visible) return null;

    return (
        <div className={`popup-container ${closing ? "slide-out" : "slide-in"}`}>
            <button className="popup-close" onClick={handleClose}>
                ✕
            </button>

            <p className="youtubeTitle">Último drop 🎥🔥 Miralo ya!!!</p>

            <div className="popup-video">
                <iframe
                    src="https://www.youtube.com/embed/UZloKbF4mjw"
                    title="YouTube Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            </div>

            <h3 className="popup-title">ABRIMOS CAJAS DE VINILOS DE HOUSE con CHIRI y GONZ | BAWAX DROP 004</h3>

            <a
                href="https://www.youtube.com/watch?v=UZloKbF4mjw"
                target="_blank"
                rel="noopener noreferrer"
                className="popup-button"
            >
                Ver en YouTube
            </a>
        </div>
    );
};

export default YouTubePopup;

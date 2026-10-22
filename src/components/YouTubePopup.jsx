import React, { useState, useEffect } from "react";
import "../styles/YoutubePopup.css";
import { useSiteFeatures } from "../context/SiteFeaturesContext";

const CART_OPEN_EVENT = "bawax:cart-open";

const YouTubePopup = () => {
    const { features } = useSiteFeatures();
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);
    const [started, setStarted] = useState(false);

    const videoId = features.youtubePopupVideoId || "WYleJOwfIVg";
    const title = features.youtubePopupTitle || "Último drop 🎥🔥 Miralo ya!!!";

    useEffect(() => {
        const isClosed = localStorage.getItem("youtubePopupClosed");
        if (isClosed === "true") return;

        // Detectar primera interacción
        const handleFirstInteraction = () => {
            if (!started) {
                setStarted(true);
                setTimeout(() => {
                    setVisible(true);
                }, 5000); // esperar 5s después de la primera interacción
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

    useEffect(() => {
        const handleCartOpen = () => {
            setClosing(false);
            setVisible(false);
        };

        window.addEventListener(CART_OPEN_EVENT, handleCartOpen);

        return () => {
            window.removeEventListener(CART_OPEN_EVENT, handleCartOpen);
        };
    }, []);

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

            <p className="youtubeTitle">{title}</p>

            <div className="popup-video">
                <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube Video"
                    frameBorder="0"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                ></iframe>
            </div>

            <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
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

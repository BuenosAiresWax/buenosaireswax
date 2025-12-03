import React from "react";
import "../styles/HeroYoutube.css";

const HeroYoutube = () => {
    // URL del video de YouTube
    const videoId = "2rODsfdvtb8";
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return (
        <section
            className="hero-youtube"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
        >
            <div className="hero-youtube-overlay">
                <div className="hero-youtube-content">
                    <h4>Drop 007 📦 Disponible en YouTube</h4>
                    <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="hero-youtube-btn"
                    >
                        ▶ Reproducir
                    </a>
                </div>
            </div>
        </section>
    );
};

export default HeroYoutube;

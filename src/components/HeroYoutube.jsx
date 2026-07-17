import React from "react";
import "../styles/HeroYoutube.css";

const heroImageModules = import.meta.glob(
    "../../assets/img/hero-youtube.{avif,webp,png,jpeg,jpg}",
    { eager: true, import: "default" }
);

const preferredFormats = ["avif", "webp", "png", "jpeg", "jpg"];

const heroBackgroundImage =
    preferredFormats
        .map((extension) => `../../assets/img/hero-youtube.${extension}`)
        .map((path) => heroImageModules[path])
        .find(Boolean) || "/assets/img/hero-youtube.jpeg";

const HeroYoutube = () => {
    const videoId = "S3Tj8VsXPAk";
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    return (
        <section className="hero-youtube">
            <div
                className="hero-youtube-media"
                style={{ backgroundImage: `url(${heroBackgroundImage})` }}
                aria-hidden="true"
            />
            <div className="hero-youtube-overlay">
                <div className="hero-youtube-content">
                    <h4>Drop 015 📦 Disponible en YouTube</h4>
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

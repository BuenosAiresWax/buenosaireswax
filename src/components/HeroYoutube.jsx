import React, { useMemo } from "react";
import "../styles/HeroYoutube.css";
import { useSiteFeatures } from "../context/SiteFeaturesContext";

const heroImageModules = import.meta.glob(
    "../../assets/img/hero-youtube.{avif,webp,png,jpeg,jpg}",
    { eager: true, import: "default" }
);

const preferredFormats = ["avif", "webp", "png", "jpeg", "jpg"];

const fallbackHeroImage =
    preferredFormats
        .map((extension) => `../../assets/img/hero-youtube.${extension}`)
        .map((path) => heroImageModules[path])
        .find(Boolean) || "/assets/img/hero-youtube.jpeg";

const HeroYoutube = () => {
    const { features } = useSiteFeatures();
    const videoId = features.youtubeBannerVideoId || "WYleJOwfIVg";
    const title = features.youtubeBannerTitle || "Drop 016 📦 Disponible en YouTube";
    const customImage = (features.youtubeBannerImage || "").trim();
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const backgroundImage = useMemo(() => {
        if (customImage) return customImage;
        return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }, [customImage, videoId]);

    return (
        <section className="hero-youtube">
            <div
                className="hero-youtube-media"
                style={{ backgroundImage: `url(${backgroundImage})` }}
                aria-hidden="true"
                onError={(e) => {
                    if (e.currentTarget.style.backgroundImage.includes(backgroundImage)) {
                        e.currentTarget.style.backgroundImage = `url(${fallbackHeroImage})`;
                    }
                }}
            />
            <div className="hero-youtube-overlay">
                <div className="hero-youtube-content">
                    <h4>{title}</h4>
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

import { useEffect, useState } from "react";

const SRC = "https://w.soundcloud.com/player/api.js";

export default function useSoundCloudScript() {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (window.SC && typeof window.SC.Widget === "function") {
            setLoaded(true);
            return;
        }

        const existing = document.querySelector(`script[src="${SRC}"]`);
        if (existing) {
            const onLoad = () => setLoaded(true);
            const onError = () => setError(new Error("No se pudo cargar SoundCloud Widget API"));

            existing.addEventListener("load", onLoad);
            existing.addEventListener("error", onError);

            return () => {
                existing.removeEventListener("load", onLoad);
                existing.removeEventListener("error", onError);
            };
        }

        const script = document.createElement("script");
        script.src = SRC;
        script.async = true;
        script.onload = () => setLoaded(true);
        script.onerror = () => setError(new Error("No se pudo cargar SoundCloud Widget API"));
        document.body.appendChild(script);
    }, []);

    return { loaded, error };
}
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import useSoundCloudScript from "./useSoundCloudScript";
import { PlayerContext } from "./PlayerContext.jsx";
import "./playerBar.css";

/**
 * iframe base (solo para crear el widget una vez).
 * Lo ocultamos. Después cargamos tracks con widget.load(...)
 */
const DEFAULT_EMBED =
    "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/forss/flickermood";

export default function PlayerBar() {
    const { loaded, error } = useSoundCloudScript();
    const iframeRef = useRef(null);
    const widgetRef = useRef(null);

    const {
        currentTrackUrl,
        currentTrackMetadata,
        trackRequestId,
        isPlaying,
        setIsPlaying,
        autoplayRef,
        registerHandlers,
        toggle,
        stop,
    } = useContext(PlayerContext);

    const [ready, setReady] = useState(false);
    const iframeSrc = useMemo(() => DEFAULT_EMBED, []);

    // Crear widget una vez
    useEffect(() => {
        if (!loaded) return;
        if (!iframeRef.current) return;
        if (!window.SC || typeof window.SC.Widget !== "function") return;
        if (widgetRef.current) return;

        const widget = window.SC.Widget(iframeRef.current);
        widgetRef.current = widget;

        registerHandlers({
            play: () => widget.play(),
            pause: () => widget.pause(),
            load: (url, autoplay) =>
                widget.load(url, {
                    auto_play: !!autoplay,
                    hide_related: true,
                    show_comments: false,
                    show_user: false,
                    show_reposts: false,
                    show_teaser: false,
                    visual: false,
                }),
        });

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onFinish = () => setIsPlaying(false);

        widget.bind(window.SC.Widget.Events.PLAY, onPlay);
        widget.bind(window.SC.Widget.Events.PAUSE, onPause);
        widget.bind(window.SC.Widget.Events.FINISH, onFinish);
        widget.bind(window.SC.Widget.Events.READY, () => setReady(true));
    }, [loaded, registerHandlers, setIsPlaying]);

    // Cargar el track cuando cambia currentTrackUrl
    useEffect(() => {
        const widget = widgetRef.current;
        if (!widget) return;
        if (!currentTrackUrl) return;

        const autoplay = autoplayRef.current;

        // Parar explícitamente el widget anterior antes de cargar uno nuevo
        widget.pause();

        widget.load(currentTrackUrl, {
            auto_play: !!autoplay,
            hide_related: true,
            show_comments: false,
            show_user: false,
            show_reposts: false,
            show_teaser: false,
            visual: false,
        });

        // Si autoplay es true, actualizar estado y forzar play después de que se cargue el track
        if (autoplay) {
            setIsPlaying(true);
            const playTimeout = setTimeout(() => {
                widget.play();
            }, 300);

            return () => clearTimeout(playTimeout);
        } else {
            setIsPlaying(false);
        }
    }, [currentTrackUrl, trackRequestId]);

    const statusText = error
        ? "Error cargando SoundCloud"
        : !loaded
            ? "Cargando player…"
            : !ready
                ? "Inicializando…"
                : !currentTrackUrl
                    ? "Sin reproducción"
                    : isPlaying
                        ? "Reproduciendo"
                        : "Pausado";

    return (
        <>
            <iframe
                ref={iframeRef}
                title="SoundCloud Player"
                className="sc-hidden-iframe"
                allow="autoplay; encrypted-media"
                src={iframeSrc}
            />

            <div className="playerbar">
                {/* Thumbnail del track */}
                <div className="playerbar__thumbnail">
                    {currentTrackUrl && currentTrackMetadata?.imagen ? (
                        <img 
                            src={currentTrackMetadata.imagen} 
                            alt={currentTrackMetadata.titulo || "Track"}
                            className="playerbar__image"
                        />
                    ) : currentTrackUrl ? (
                        <svg className="playerbar__placeholder" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <rect width="100" height="100" fill="currentColor" opacity="0.2"/>
                            <circle cx="50" cy="40" r="15" fill="currentColor" opacity="0.5"/>
                            <path d="M 25 65 Q 50 75 75 65" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.5"/>
                        </svg>
                    ) : (
                        <svg className="playerbar__placeholder playerbar__placeholder--empty" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <rect width="100" height="100" fill="currentColor" opacity="0.1"/>
                            <text x="50" y="50" textAnchor="middle" dy="0.3em" fontSize="14" fill="currentColor" opacity="0.4">
                                sin audio
                            </text>
                        </svg>
                    )}
                </div>

                <div className="playerbar__left">
                    <div className="playerbar__status">{statusText}</div>
                    <div className="playerbar__meta">
                        {currentTrackUrl ? (
                            <>
                                <span className="playerbar__label">♪</span>
                                <span className="playerbar__info">
                                    <div className="playerbar__title">{currentTrackMetadata?.titulo || "Track"}</div>
                                    <div className="playerbar__artist">{currentTrackMetadata?.autor}</div>
                                </span>
                            </>
                        ) : (
                            <span className="playerbar__hint">
                                Elegí un disco y tocá "🔊" para escucharlo.
                            </span>
                        )}
                    </div>
                </div>

                <div className="playerbar__right">
                    <button
                        className="playerbar__btn playerbar__btn--play"
                        onClick={toggle}
                        disabled={!loaded || !!error || !currentTrackUrl}
                        title={isPlaying ? "Pausar" : "Reproducir"}
                    >
                        {isPlaying ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" rx="1"/>
                                <rect x="14" y="4" width="4" height="16" rx="1"/>
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <polygon points="5 3 19 12 5 21"/>
                            </svg>
                        )}
                    </button>

                    <button
                        className="playerbar__btn playerbar__btn--stop"
                        onClick={stop}
                        disabled={!loaded || !!error || !currentTrackUrl}
                        title="Detener"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="1"/>
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
}








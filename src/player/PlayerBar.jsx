import { useContext, useEffect, useMemo, useRef, useState } from "react";
import useSoundCloudScript from "./useSoundCloudScript";
import { PlayerContext } from "./PlayerContext.jsx";
import "./playerBar.css";

/**
 * iframe base (solo para crear el widget una vez).
 * Lo ocultamos. Después cargamos tracks con widget.load(...)
 */
const DEFAULT_EMBED =
    "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/soundcloud";

export default function PlayerBar({ className = "" }) {
    const { loaded, error } = useSoundCloudScript();
    const iframeRef = useRef(null);
    const widgetRef = useRef(null);
    const autoplayTimersRef = useRef([]);
    const loadSequenceRef = useRef(0);

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
    const [isTrackLoading, setIsTrackLoading] = useState(false);
    const iframeSrc = useMemo(() => DEFAULT_EMBED, []);
    const normalizedTrackValue = (currentTrackUrl || "").trim().toLowerCase();
    const hasNoTrackPlaceholder =
        normalizedTrackValue === "sin escucha" ||
        normalizedTrackValue === "sin audio" ||
        normalizedTrackValue === "no disponible" ||
        normalizedTrackValue === "sin track" ||
        normalizedTrackValue === "sin tema";
    const hasPlayableTrack =
        !!currentTrackUrl &&
        !hasNoTrackPlaceholder &&
        /^https?:\/\//i.test((currentTrackUrl || "").trim());

    const clearAutoplayTimers = () => {
        autoplayTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        autoplayTimersRef.current = [];
    };

    useEffect(() => {
        const handleUnhandledRejection = (event) => {
            const reason = event?.reason;
            const isAbortError = reason?.name === "AbortError";
            const message = typeof reason?.message === "string" ? reason.message : "";
            const stack = typeof reason?.stack === "string" ? reason.stack : "";
            const isSoundCloudWidgetError =
                message.includes("signal is aborted") ||
                stack.includes("widget-");

            // El widget de SoundCloud aborta requests internos al cambiar/cancelar cargas.
            // Evitamos ruido en consola solo para ese caso específico.
            if (isAbortError && isSoundCloudWidgetError) {
                event.preventDefault();
            }
        };

        window.addEventListener("unhandledrejection", handleUnhandledRejection);

        return () => {
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
        };
    }, []);

    const canUseWidget = (widget) => {
        if (!widget) return false;
        if (!iframeRef.current) return false;
        return !!iframeRef.current.contentWindow;
    };

    const safeWidgetCall = (widget, callback) => {
        if (!canUseWidget(widget)) return false;

        try {
            callback();
            return true;
        } catch (err) {
            // Evita romper la app cuando el iframe del widget se desmonta entre renders.
            if (
                err instanceof TypeError &&
                typeof err.message === "string" &&
                err.message.includes("postMessage")
            ) {
                return false;
            }

            throw err;
        }
    };

    useEffect(() => () => clearAutoplayTimers(), []);

    // Crear widget una vez
    useEffect(() => {
        if (!loaded) return;
        if (!iframeRef.current) return;
        if (!window.SC || typeof window.SC.Widget !== "function") return;
        if (widgetRef.current) return;

        const widget = window.SC.Widget(iframeRef.current);
        widgetRef.current = widget;

        registerHandlers({
            play: () => {
                safeWidgetCall(widgetRef.current, () => widgetRef.current.play());
            },
            pause: () => {
                safeWidgetCall(widgetRef.current, () => widgetRef.current.pause());
            },
            load: (url, autoplay) =>
                safeWidgetCall(widgetRef.current, () => {
                    widgetRef.current.load(url, {
                        auto_play: !!autoplay,
                        hide_related: true,
                        show_comments: false,
                        show_user: false,
                        show_reposts: false,
                        show_teaser: false,
                        visual: false,
                    });
                }),
        });

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onFinish = () => setIsPlaying(false);
        const onReady = () => setReady(true);

        const handlePlay = () => {
            setIsTrackLoading(false);
            onPlay();
        };

        const handlePause = () => {
            setIsTrackLoading(false);
            onPause();
        };

        const handleFinish = () => {
            setIsTrackLoading(false);
            onFinish();
        };

        widget.bind(window.SC.Widget.Events.PLAY, handlePlay);
        widget.bind(window.SC.Widget.Events.PAUSE, handlePause);
        widget.bind(window.SC.Widget.Events.FINISH, handleFinish);
        widget.bind(window.SC.Widget.Events.READY, onReady);

        return () => {
            clearAutoplayTimers();
            registerHandlers({ play: null, pause: null, load: null });

            if (window.SC?.Widget?.Events) {
                widget.unbind(window.SC.Widget.Events.PLAY, handlePlay);
                widget.unbind(window.SC.Widget.Events.PAUSE, handlePause);
                widget.unbind(window.SC.Widget.Events.FINISH, handleFinish);
                widget.unbind(window.SC.Widget.Events.READY, onReady);
            }

            widgetRef.current = null;
            setReady(false);
        };
    }, [loaded, registerHandlers, setIsPlaying]);

    // Cargar el track cuando cambia currentTrackUrl
    useEffect(() => {
        const widget = widgetRef.current;
        if (!widget) return;
        if (!ready) return;

        clearAutoplayTimers();

        if (!currentTrackUrl || !hasPlayableTrack) {
            safeWidgetCall(widget, () => widget.pause());
            setIsPlaying(false);
            setIsTrackLoading(false);
            return;
        }

        const autoplay = autoplayRef.current;
        const currentLoadSequence = loadSequenceRef.current + 1;
        loadSequenceRef.current = currentLoadSequence;

        // Forzamos pausa antes de cargar el nuevo track para evitar estados inconsistentes
        // cuando se cambia de tema mientras otro está reproduciéndose.
        safeWidgetCall(widget, () => widget.pause());
        setIsPlaying(false);
        setIsTrackLoading(true);

        safeWidgetCall(widget, () =>
            widget.load(currentTrackUrl, {
            auto_play: !!autoplay,
            hide_related: true,
            show_comments: false,
            show_user: false,
            show_reposts: false,
            show_teaser: false,
            visual: false,
            callback: () => {
                if (loadSequenceRef.current !== currentLoadSequence) return;
                setIsTrackLoading(false);

                if (!autoplay) return;

                const attemptDelays = [0, 160, 420, 900, 1600];
                autoplayTimersRef.current = attemptDelays.map((delay) =>
                    setTimeout(() => {
                        if (widgetRef.current !== widget) return;
                        safeWidgetCall(widget, () => widget.play());
                    }, delay),
                );

                const pausedCheckTimer = setTimeout(() => {
                    if (widgetRef.current !== widget) return;
                    safeWidgetCall(widget, () => {
                        widget.isPaused((paused) => {
                            if (paused) {
                                safeWidgetCall(widget, () => widget.play());
                            }
                        });
                    });
                }, 2300);

                autoplayTimersRef.current.push(pausedCheckTimer);
            },
        }),
        );

        // Si autoplay es true, actualizar estado y forzar play después de que se cargue el track
        if (autoplay) {
            return () => clearAutoplayTimers();
        } else {
            setIsPlaying(false);
        }
    }, [currentTrackUrl, hasPlayableTrack, trackRequestId, autoplayRef, ready, setIsPlaying]);

    const statusText = error
        ? "Error cargando SoundCloud"
        : !loaded
            ? "Cargando player…"
            : !ready
                ? "Inicializando…"
                : hasNoTrackPlaceholder
                    ? "Este disco no tiene temas disponibles"
                    : !hasPlayableTrack
                    ? "Sin reproducción"
                    : isTrackLoading
                        ? "Cargando…"
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

            <div className={`playerbar ${className}`.trim()}>
                {/* Thumbnail del track */}
                <div className="playerbar__thumbnail">
                    {hasPlayableTrack && currentTrackMetadata?.imagen ? (
                        <img 
                            src={currentTrackMetadata.imagen} 
                            alt={currentTrackMetadata.titulo || "Track"}
                            className="playerbar__image"
                        />
                    ) : hasPlayableTrack ? (
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
                        {hasPlayableTrack ? (
                            <>
                                <span className="playerbar__label">♪</span>
                                <span className="playerbar__info">
                                    <div className="playerbar__title">{currentTrackMetadata?.titulo || "Track"}</div>
                                    <div className="playerbar__artist">{currentTrackMetadata?.autor}</div>
                                </span>
                            </>
                        ) : hasNoTrackPlaceholder ? (
                            <span className="playerbar__hint">
                                Este disco no tiene track o tema disponible.
                            </span>
                        ) : (
                            <span className="playerbar__hint">
                                Elegí un disco y tocá "🔊 Reproducir".
                            </span>
                        )}
                    </div>
                </div>

                <div className="playerbar__right">
                    <button
                        className="playerbar__btn playerbar__btn--play"
                        onClick={toggle}
                        disabled={!loaded || !!error || !hasPlayableTrack}
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
                        disabled={!loaded || !!error || !hasPlayableTrack}
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








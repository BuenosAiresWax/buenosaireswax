import { useContext, useEffect, useMemo, useRef, useState } from "react";
import useSoundCloudScript from "./useSoundCloudScript";
import { PlayerContext } from "./PlayerContext";
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

        widget.load(currentTrackUrl, {
            auto_play: !!autoplay,
            hide_related: true,
            show_comments: false,
            show_user: false,
            show_reposts: false,
            show_teaser: false,
            visual: false,
        });
    }, [currentTrackUrl, autoplayRef]);

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
                <div className="playerbar__left">
                    <div className="playerbar__status">{statusText}</div>
                    <div className="playerbar__meta">
                        {currentTrackUrl ? (
                            <>
                                <span className="playerbar__label">Track:</span>
                                <span className="playerbar__url" title={currentTrackUrl}>
                                    {currentTrackUrl}
                                </span>
                            </>
                        ) : (
                            <span className="playerbar__hint">
                                Elegí un producto y tocá “ESCUCHAR”.
                            </span>
                        )}
                    </div>
                </div>

                <div className="playerbar__right">
                    <button
                        className="playerbar__btn"
                        onClick={toggle}
                        disabled={!loaded || !!error || !currentTrackUrl}
                    >
                        {isPlaying ? "Pausa" : "Play"}
                    </button>

                    <button
                        className="playerbar__btn"
                        onClick={stop}
                        disabled={!loaded || !!error || !currentTrackUrl}
                    >
                        Stop
                    </button>
                </div>
            </div>
        </>
    );
}
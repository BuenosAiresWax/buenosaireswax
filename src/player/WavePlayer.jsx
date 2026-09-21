import {
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { PlayerContext } from "./PlayerContext.jsx";
import { drawWaveform, formatTime, getPeaksForTrack } from "./waveform.js";
import "./wavePlayer.css";

export default function WavePlayer({ className = "" }) {
    const player = useContext(PlayerContext);
    const {
        currentTrack,
        vinylMeta,
        isPlaying,
        isLoading,
        isBuffering,
        error,
        duration,
        audioEl,
        toggle,
        seek,
        goNext,
        goPrev,
        canGoNext,
        canGoPrev,
    } = player;

    const [peaks, setPeaks] = useState([]);
    const [peaksLoading, setPeaksLoading] = useState(false);
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverRatio, setHoverRatio] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const canvasRef = useRef(null);
    const waveWrapRef = useRef(null);
    const playheadRef = useRef(0);
    const isSeekingRef = useRef(false);
    const lastDrawnProgressRef = useRef(-1);
    const lastHoverRef = useRef(null);

    const audioUrl = currentTrack?.audioUrl || null;
    const bpm = Number(currentTrack?.bpm);
    const hasBpm = Number.isFinite(bpm) && bpm > 0;
    const hasMetric = currentTrack;
    const isActivePlaying = isPlaying && hasMetric;

    useEffect(() => {
        setPeaks([]);

        if (!audioUrl) {
            setPeaksLoading(false);
            return;
        }

        let cancelled = false;

        const storedPeaks = Array.isArray(currentTrack?.peaks)
            ? currentTrack.peaks
            : null;

        if (storedPeaks && storedPeaks.length) {
            setPeaksLoading(false);
            setPeaks(storedPeaks);
            return;
        }

        setPeaksLoading(true);
        getPeaksForTrack(currentTrack).then((computed) => {
            if (cancelled) return;
            setPeaksLoading(false);
            if (computed && computed.length) setPeaks(computed);
        });

        return () => {
            cancelled = true;
        };
    }, [audioUrl, currentTrack]);

    useEffect(() => {
        const wrapper = waveWrapRef.current;
        if (!wrapper || typeof ResizeObserver === "undefined") {
            return undefined;
        }

        const measure = () => {
            const rect = wrapper.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setDimensions({ width: rect.width, height: rect.height });
            }
        };

        const observer = new ResizeObserver(() => measure());
        observer.observe(wrapper);
        measure();

        return () => observer.disconnect();
    }, []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx || !dimensions.width || !dimensions.height) return;

        const progress =
            duration > 0 ? Math.max(0, Math.min(1, playheadRef.current / duration)) : 0;

        if (
            lastDrawnProgressRef.current === progress &&
            lastHoverRef.current === hoverTime &&
            !isPlaying
        ) {
            return;
        }

        lastDrawnProgressRef.current = progress;
        lastHoverRef.current = hoverTime;

        drawWaveform(ctx, peaks, {
            width: dimensions.width,
            height: dimensions.height,
            progress,
        });
    }, [peaks, dimensions, duration, hoverTime, isPlaying]);

    useEffect(() => {
        let rafId = 0;

        const tick = () => {
            const el = audioEl;
            if (!isSeekingRef.current && el && Number.isFinite(el.currentTime)) {
                playheadRef.current = el.currentTime;
            }
            draw();
            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [audioEl, draw]);

    useEffect(() => {
        if (!isLoading && !isSeekingRef.current) {
            lastDrawnProgressRef.current = -1;
        }
    }, [isLoading]);

    const handleSeekPointer = useCallback(
        (event) => {
            const wrapper = waveWrapRef.current;
            if (!wrapper || !duration) return;

            const rect = wrapper.getBoundingClientRect();
            const clientX = event.clientX ?? event.touches?.[0]?.clientX;
            if (clientX === undefined) return;

            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const targetTime = ratio * duration;
            playheadRef.current = targetTime;
            setHoverTime(targetTime);
            setHoverRatio(ratio);
            seek(targetTime);
        },
        [duration, seek],
    );

    const handlePointerDown = useCallback(
        (event) => {
            if (!duration) return;
            isSeekingRef.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            handleSeekPointer(event);
        },
        [duration, handleSeekPointer],
    );

    const handlePointerMove = useCallback(
        (event) => {
            const wrapper = waveWrapRef.current;
            if (!wrapper || !duration) return;

            const rect = wrapper.getBoundingClientRect();
            const clientX = event.clientX ?? event.touches?.[0]?.clientX;
            if (clientX === undefined) return;

            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const targetTime = ratio * duration;
            setHoverTime(targetTime);
            setHoverRatio(ratio);

            if (isSeekingRef.current) {
                playheadRef.current = targetTime;
                seek(targetTime);
            }
        },
        [duration, seek],
    );

    const handlePointerUp = useCallback(() => {
        isSeekingRef.current = false;
    }, []);

    const handlePointerLeave = useCallback(() => {
        setHoverTime(null);
        setHoverRatio(null);
    }, []);

    const statusText = error
        ? "Error de reproducción"
        : !currentTrack
            ? "Sin reproducción"
            : isBuffering
                ? "Cargando…"
                : isLoading
                    ? "Cargando…"
                    : isPlaying
                        ? "Reproduciendo"
                        : "Pausado";

    return (
        <div className={`playerbar waveplayer ${isActivePlaying ? "waveplayer--playing " : ""}${className}`.trim()}>
            <div className="waveplayer__disc" aria-hidden="true">
                {currentTrack?.imagen || vinylMeta?.imagen ? (
                    <img
                        src={currentTrack?.imagen || vinylMeta?.imagen}
                        alt={currentTrack?.titulo || vinylMeta?.titulo || "Track"}
                        className={`waveplayer__disc-img ${isActivePlaying ? "waveplayer__disc-img--spin" : ""}`}
                    />
                ) : (
                    <div
                        className={`waveplayer__disc-placeholder ${isActivePlaying ? "waveplayer__disc-placeholder--spin" : ""}`}
                    >
                        <span />
                    </div>
                )}
            </div>

            <div className="waveplayer__main">
                <div className="waveplayer__top">
                    <div className="waveplayer__meta">
                        <span className="waveplayer__status">{statusText}</span>
                        {currentTrack ? (
                            <div className="waveplayer__names">
                                <span className="waveplayer__title">
                                    {currentTrack.titulo || "Track"}
                                </span>
                                {(currentTrack.autor || vinylMeta?.autor) && (
                                    <span className="waveplayer__artist">
                                        {currentTrack.autor || vinylMeta?.autor}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="waveplayer__names">
                                <span className="waveplayer__artist">
                                    Elegí un disco y tocá Reproducir
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="waveplayer__metrics">
                        {hasBpm && (
                            <div
                                className={`waveplayer__bpm ${isActivePlaying ? "waveplayer__bpm--live" : ""}`}
                            >
                                <span className="waveplayer__bpm-dot" />
                                <span className="waveplayer__bpm-value">
                                    {Math.round(bpm)}
                                </span>
                                <span className="waveplayer__bpm-label">BPM</span>
                            </div>
                        )}
                        {hasMetric && (
                            <div className="waveplayer__time">
                                <span>{formatTime(playheadRef.current)}</span>
                                <span className="waveplayer__time-sep">/</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    ref={waveWrapRef}
                    className={`waveplayer__wave-wrap ${!currentTrack ? "waveplayer__wave-wrap--empty" : ""}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                >
                    <canvas ref={canvasRef} className="waveplayer__wave-canvas" />

                    {hoverTime !== null && (
                        <span
                            className="waveplayer__hover-time"
                            style={{ left: `${Math.max(
                                3,
                                Math.min(97, (hoverRatio ?? 0) * 100),
                            )}%` }}
                        >
                            {formatTime(hoverTime)}
                        </span>
                    )}

                    {!currentTrack && (
                        <span className="waveplayer__wave-empty">
                            ♫  Sin reproducción — elegí un disco
                        </span>
                    )}

                    {currentTrack && peaksLoading && (
                        <span className="waveplayer__wave-loading">
                            Analizando forma de onda…
                        </span>
                    )}
                </div>
            </div>

            <div className="waveplayer__controls">
                <button
                    type="button"
                    className="waveplayer__btn"
                    onClick={() => goPrev()}
                    disabled={!canGoPrev || !!error}
                    title="Track anterior"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M6 6h2v12H6z M20 6l-8 6 8 6z" />
                    </svg>
                </button>

                <button
                    type="button"
                    className="waveplayer__btn waveplayer__btn--play"
                    onClick={toggle}
                    disabled={!currentTrack || !!error || isLoading}
                    title={isPlaying ? "Pausar" : "Reproducir"}
                >
                    {isPlaying ? (
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" rx="1.2" />
                            <rect x="14" y="4" width="4" height="16" rx="1.2" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <polygon points="6 3 20 12 6 21" />
                        </svg>
                    )}
                </button>

                <button
                    type="button"
                    className="waveplayer__btn"
                    onClick={() => goNext()}
                    disabled={!canGoNext || !!error}
                    title="Siguiente track"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M16 6h2v12h-2z M4 6l8 6-8 6z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
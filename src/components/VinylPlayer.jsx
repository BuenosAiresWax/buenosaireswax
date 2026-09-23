import { useContext, useMemo } from "react";
import { PlayerContext } from "../player/PlayerContext.jsx";
import { formatTime } from "../player/waveform.js";
import { fixUrl } from "../utils/imageUrl";
import "./vinylPlayer.css";

const normalizeTracks = (trackList) => {
    if (!Array.isArray(trackList)) return [];
    return trackList
        .map((track, index) => ({
            titulo: track?.titulo || `Track ${index + 1}`,
            autor: track?.autor || "",
            duracion: Number(track?.duracion) || 0,
            bpm: Number(track?.bpm),
            audioUrl: track?.audioUrl || "",
            peaks: track?.peaks || [],
        }))
        .filter((track) => track.titulo);
};

export default function VinylPlayer({ producto }) {
    const player = useContext(PlayerContext);
    const {
        vinylKey,
        currentTrackIndex,
        isPlaying,
        loadVinyl,
        setTrackIndex,
        toggle,
    } = player;

    const tracks = useMemo(() => normalizeTracks(producto?.trackList), [producto]);

    const productKey = useMemo(
        () => `${producto?.collectionName || "productos"}:${producto?.id}`,
        [producto],
    );
    const isThisVinyl = vinylKey === productKey && tracks.length > 0;
    const isCurrentTrack = (index) =>
        isThisVinyl && currentTrackIndex === index;
    const activePlaying = isThisVinyl && isPlaying;

    const vinylMeta = {
        titulo: producto?.titulo || "",
        autor: producto?.autor || "",
        imagen: fixUrl(producto?.imagen || ""),
        sello: producto?.sello || "",
    };

    if (!tracks.length) return null;

    const handleTrackClick = (index) => {
        if (isThisVinyl) {
            if (isCurrentTrack(index)) {
                toggle();
                return;
            }
            setTrackIndex(index, true);
            return;
        }
        loadVinyl({
            key: productKey,
            meta: vinylMeta,
            tracks,
            startIndex: index,
            autoplay: true,
        });
    };

    return (
        <div
            className={`tracklist vinyl-player__tracklist ${activePlaying ? "vinyl-player__tracklist--active" : ""}`}
        >
            <h4>TRACKLIST</h4>

            <div className="vinyl-player__rows">
                {tracks.map((track, index) => {
                    const current = isCurrentTrack(index);
                    return (
                        <button
                            type="button"
                            key={`${index}-${track.titulo}`}
                            className={`vinyl-player__track ${current ? "vinyl-player__track--current" : ""}`}
                            onClick={() => handleTrackClick(index)}
                        >
                            <span className="vinyl-player__idx">
                                {String(index + 1).padStart(2, "0")}
                            </span>

                            <span className="vinyl-player__track-main">
                                <span className="vinyl-player__track-title">
                                    {track.titulo}
                                </span>
                            </span>

                            <span className="vinyl-player__track-badges">
                                {track.bpm > 0 && (
                                    <span className="vinyl-player__bpm">
                                        {Math.round(track.bpm)} BPM
                                    </span>
                                )}
                                {track.duracion > 0 && (
                                    <span className="vinyl-player__dur">
                                        {formatTime(track.duracion)}
                                    </span>
                                )}
                            </span>

                            <span className="vinyl-player__track-status">
                                {current && isPlaying ? (
                                    <span
                                        className="vinyl-player__eq"
                                        aria-label="Reproduciendo"
                                    >
                                        <i />
                                        <i />
                                        <i />
                                        <i />
                                    </span>
                                ) : current ? (
                                    <svg
                                        viewBox="0 0 24 24"
                                        width="15"
                                        height="15"
                                        fill="currentColor"
                                        aria-label="Pausado - Track actual"
                                    >
                                        <rect x="6" y="4" width="4" height="16" rx="1.2" />
                                        <rect x="14" y="4" width="4" height="16" rx="1.2" />
                                    </svg>
                                ) : (
                                    <svg
                                        viewBox="0 0 24 24"
                                        width="15"
                                        height="15"
                                        fill="currentColor"
                                        aria-hidden="true"
                                    >
                                        <polygon points="6 3 20 12 6 21" />
                                    </svg>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
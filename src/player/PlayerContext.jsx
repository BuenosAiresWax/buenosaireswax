import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

const hasHttpUrl = (value) =>
    typeof value === "string" && /^https?:\/\//i.test(value.trim());

const clampTime = (value, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    if (max > 0 && Number.isFinite(max)) return Math.min(max, Math.max(0, parsed));
    return Math.max(0, parsed);
};

const defaultPlayerContextValue = {
    tracks: [],
    vinylKey: null,
    vinylMeta: null,
    currentTrackIndex: -1,
    currentTrack: null,
    isPlaying: false,
    isLoading: false,
    isBuffering: false,
    duration: 0,
    error: null,
    audioEl: null,
    loadVinyl: () => {},
    setTrackIndex: () => {},
    play: () => {},
    pause: () => {},
    toggle: () => {},
    seek: () => {},
    goNext: () => {},
    goPrev: () => {},
    stop: () => {},
    hasAudio: false,
    canGoNext: false,
    canGoPrev: false,
};

export const PlayerContext = createContext(defaultPlayerContextValue);

export function PlayerProvider({ children }) {
    const audioRef = useRef(null);
    const [tracks, setTracks] = useState([]);
    const [vinylKey, setVinylKey] = useState(null);
    const [vinylMeta, setVinylMeta] = useState(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);

    const latestStateRef = useRef({ tracks: [], currentTrackIndex: -1 });
    latestStateRef.current = { tracks, currentTrackIndex };

    const ensureAudio = useCallback(() => {
        if (!audioRef.current) {
            const audio = new Audio();
            audio.preload = "metadata";
            audioRef.current = audio;
        }
        return audioRef.current;
    }, []);

    const currentTrack =
        currentTrackIndex >= 0 && currentTrackIndex < tracks.length
            ? tracks[currentTrackIndex]
            : null;

    const hasAudio = tracks.some((track) => hasHttpUrl(track?.audioUrl));

    const playableIndexes = useMemo(
        () =>
            tracks
                .map((track, index) => ({ track, index }))
                .filter(({ track }) => hasHttpUrl(track?.audioUrl))
                .map(({ index }) => index),
        [tracks],
    );

    const canGoNext = playableIndexes.some(
        (index) => index > currentTrackIndex,
    );
    const canGoPrev = playableIndexes.some(
        (index) => index < currentTrackIndex,
    );

    const play = useCallback(() => {
        const audio = ensureAudio();
        const promise = audio.play();
        if (promise && typeof promise.catch === "function") {
            promise.catch(() => {
                setError(new Error("No se pudo reproducir el audio"));
                setIsPlaying(false);
                setIsLoading(false);
            });
        }
    }, [ensureAudio]);

    const pause = useCallback(() => {
        audioRef.current?.pause();
    }, []);

    const toggle = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, pause, play]);

    const seek = useCallback(
        (time) => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.currentTime = clampTime(time, audio.duration);
        },
        [],
    );

    const changeTrack = useCallback(
        (index, autoplay = true) => {
            const track = tracks[index];
            if (!track || !hasHttpUrl(track?.audioUrl)) return;

            const audio = ensureAudio();

            setCurrentTrackIndex(index);
            setError(null);
            setIsLoading(true);

            if (autoplay) setIsBuffering(false);

            const isSameSource =
                audio.src &&
                audio.src.split("#")[0] === track.audioUrl.split("#")[0];

            if (isSameSource) {
                setIsLoading(false);
                if (autoplay) play();
                return;
            }

            audio.src = track.audioUrl;
            if (autoplay) play();
        },
        [tracks, ensureAudio, play],
    );

    const setTrackIndex = useCallback(
        (index, autoplay = true) => changeTrack(index, autoplay),
        [changeTrack],
    );

    const loadVinyl = useCallback(
        ({ key = null, meta = null, tracks: vinylTracks = [], startIndex = 0, autoplay = true }) => {
            const audio = ensureAudio();
            const normalizedTracks = Array.isArray(vinylTracks) ? vinylTracks : [];

            setTracks(normalizedTracks);
            setVinylKey(key);
            setVinylMeta(meta || null);
            setError(null);
            setDuration(0);
            setIsLoading(false);
            setIsBuffering(false);

            const target = startIndex >= 0 && startIndex < normalizedTracks.length
                ? startIndex
                : normalizedTracks.findIndex((track) => hasHttpUrl(track?.audioUrl));

            if (target < 0) {
                audio.pause();
                setCurrentTrackIndex(-1);
                setIsPlaying(false);
                return;
            }

            const track = normalizedTracks[target];

            setCurrentTrackIndex(target);

            if (hasHttpUrl(track?.audioUrl)) {
                setIsLoading(true);
                audio.src = track.audioUrl;
                if (autoplay) play();
            }
        },
        [ensureAudio, play],
    );

    const goNext = useCallback(
        (autoplay = true) => {
            const { tracks: latestTracks, currentTrackIndex: latestIndex } =
                latestStateRef.current;

            if (!latestTracks.length) return;

            for (let i = latestIndex + 1; i < latestTracks.length; i += 1) {
                if (hasHttpUrl(latestTracks[i]?.audioUrl)) {
                    changeTrack(i, autoplay);
                    return;
                }
            }
        },
        [changeTrack],
    );

    const goPrev = useCallback(
        (autoplay = true) => {
            const { tracks: latestTracks, currentTrackIndex: latestIndex } =
                latestStateRef.current;

            if (!latestTracks.length) return;

            for (let i = latestIndex - 1; i >= 0; i -= 1) {
                if (hasHttpUrl(latestTracks[i]?.audioUrl)) {
                    changeTrack(i, autoplay);
                    return;
                }
            }
        },
        [changeTrack],
    );

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        }
        setTracks([]);
        setCurrentTrackIndex(-1);
        setIsPlaying(false);
        setIsLoading(false);
        setIsBuffering(false);
        setDuration(0);
        setVinylKey(null);
        setVinylMeta(null);
        setError(null);
        audioRef.current = null;
    }, []);

    useEffect(() => {
        const audio = ensureAudio();

        const handlePlay = () => {
            setIsPlaying(true);
            setIsLoading(false);
            setIsBuffering(false);
            setError(null);
        };
        const handlePause = () => setIsPlaying(false);
        const handlePlaying = () => {
            setIsPlaying(true);
            setIsLoading(false);
            setIsBuffering(false);
        };
        const handleWaiting = () => setIsBuffering(true);
        const handleLoadedMetadata = () => {
            if (audio.duration && Number.isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
            setIsLoading(false);
        };
        const handleEnded = () => {
            setIsPlaying(false);
            setIsBuffering(false);
            goNext(true);
        };
        const handleError = () => {
            setIsLoading(false);
            setIsBuffering(false);
            setIsPlaying(false);
            setError(new Error("No se puede reproducir este tema"));
        };

        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("playing", handlePlaying);
        audio.addEventListener("waiting", handleWaiting);
        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);

        return () => {
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("playing", handlePlaying);
            audio.removeEventListener("waiting", handleWaiting);
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
        };
    }, [ensureAudio, goNext]);

    const value = useMemo(
        () => ({
            tracks,
            vinylKey,
            vinylMeta,
            currentTrackIndex,
            currentTrack,
            isPlaying,
            isLoading,
            isBuffering,
            duration,
            error,
            audioEl: audioRef.current,
            loadVinyl,
            setTrackIndex,
            play,
            pause,
            toggle,
            seek,
            goNext,
            goPrev,
            stop,
            hasAudio,
            canGoNext,
            canGoPrev,
        }),
        [
            tracks,
            vinylKey,
            vinylMeta,
            currentTrackIndex,
            currentTrack,
            isPlaying,
            isLoading,
            isBuffering,
            duration,
            error,
            loadVinyl,
            setTrackIndex,
            play,
            pause,
            toggle,
            seek,
            goNext,
            goPrev,
            stop,
            hasAudio,
            canGoNext,
            canGoPrev,
        ],
    );

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
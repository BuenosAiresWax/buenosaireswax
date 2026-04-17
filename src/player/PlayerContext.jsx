import { createContext, useCallback, useMemo, useRef, useState } from "react";

const defaultPlayerContextValue = {
    currentTrackUrl: null,
    currentTrackMetadata: null,
    trackRequestId: 0,
    isPlaying: false,
    setIsPlaying: () => {},
    autoplayRef: { current: true },
    registerHandlers: () => {},
    setTrack: () => {},
    play: () => {},
    pause: () => {},
    toggle: () => {},
    stop: () => {},
};

export const PlayerContext = createContext(defaultPlayerContextValue);

export function PlayerProvider({ children }) {
    const [currentTrackUrl, setCurrentTrackUrl] = useState(null);
    const [currentTrackMetadata, setCurrentTrackMetadata] = useState(null);
    const [trackRequestId, setTrackRequestId] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const autoplayRef = useRef(true);

    // handlers reales del widget (los registra PlayerBar cuando está listo)
    const handlersRef = useRef({
        play: null,
        pause: null,
        load: null,
    });

    const registerHandlers = useCallback((handlers) => {
        handlersRef.current = { ...handlersRef.current, ...handlers };
    }, []);

    const setTrack = useCallback((url, autoplay = true, metadata = null) => {
        autoplayRef.current = !!autoplay;
        setCurrentTrackUrl(url);
        setCurrentTrackMetadata(metadata);
        setTrackRequestId((prev) => prev + 1);
        // NO cambiar isPlaying aquí - dejar que los callbacks del widget lo manejen
    }, []);

    const play = useCallback(() => handlersRef.current.play?.(), []);
    const pause = useCallback(() => handlersRef.current.pause?.(), []);

    const toggle = useCallback(() => {
        if (isPlaying) handlersRef.current.pause?.();
        else handlersRef.current.play?.();
    }, [isPlaying]);

    const stop = useCallback(() => {
        handlersRef.current.pause?.();
        setCurrentTrackUrl(null);
        setIsPlaying(false);
    }, []);

    const value = useMemo(
        () => ({
            currentTrackUrl,
            currentTrackMetadata,
            trackRequestId,
            isPlaying,
            setIsPlaying,
            autoplayRef,
            registerHandlers,
            setTrack,
            play,
            pause,
            toggle,
            stop,
        }),
        [currentTrackUrl, currentTrackMetadata, trackRequestId, isPlaying, registerHandlers, setTrack, play, pause, toggle, stop],
    );

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
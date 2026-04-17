import { createContext, useCallback, useMemo, useRef, useState } from "react";

export const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
    const [currentTrackUrl, setCurrentTrackUrl] = useState(null);
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

    const setTrack = useCallback((url, autoplay = true) => {
        autoplayRef.current = !!autoplay;
        setCurrentTrackUrl(url);
        setIsPlaying(!!autoplay);
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
        [currentTrackUrl, isPlaying, registerHandlers, setTrack, play, pause, toggle, stop],
    );

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
import React, { useState, useEffect, useRef } from "react";
import Hero from "./Hero";
import HeroYoutube from "./HeroYoutube";
import "../styles/HeroSlider.css";

const slides = [<Hero key="1" />, <HeroYoutube key="2" />];

const SWIPE_THRESHOLD = 50; // px mínimo para considerar swipe
const SLIDE_DURATION = 8000; // duración slide en ms

const HeroSlider = () => {
    const [current, setCurrent] = useState(0);
    const [progress, setProgress] = useState(0);
    const timeoutRef = useRef(null);
    const progressRef = useRef(null);

    const startX = useRef(null);
    const isDragging = useRef(false);
    const startTime = useRef(null);

    useEffect(() => {
        startAutoPlay();
        return () => {
            clearTimeout(timeoutRef.current);
            cancelAnimationFrame(progressRef.current);
        };
    }, [current]);

    const startAutoPlay = () => {
        clearTimeout(timeoutRef.current);
        startTime.current = performance.now();
        setProgress(0);
        animateProgress();

        timeoutRef.current = setTimeout(() => {
            setCurrent((prev) => (prev + 1) % slides.length);
        }, SLIDE_DURATION);
    };

    const animateProgress = () => {
        const step = (timestamp) => {
            if (!startTime.current) startTime.current = timestamp;
            const elapsed = timestamp - startTime.current;
            setProgress(Math.min(elapsed / SLIDE_DURATION, 1));
            if (elapsed < SLIDE_DURATION) {
                progressRef.current = requestAnimationFrame(step);
            }
        };
        progressRef.current = requestAnimationFrame(step);
    };

    // Touch/mouse handlers
    const onTouchStart = (e) => {
        isDragging.current = true;
        startX.current = e.touches ? e.touches[0].clientX : e.clientX;
    };

    const onTouchMove = (e) => {
        if (!isDragging.current) return;
    };

    const onTouchEnd = (e) => {
        if (!isDragging.current) return;
        const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const diffX = endX - startX.current;

        if (diffX > SWIPE_THRESHOLD) {
            setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
        } else if (diffX < -SWIPE_THRESHOLD) {
            setCurrent((prev) => (prev + 1) % slides.length);
        }
        isDragging.current = false;
    };

    return (
        <div
            className="hero-slider-manual"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onTouchStart}
            onMouseMove={onTouchMove}
            onMouseUp={onTouchEnd}
            onMouseLeave={() => {
                isDragging.current = false;
            }}
        >
            {slides.map((slide, i) => (
                <div key={i} className={`slide ${i === current ? "active" : ""}`}>
                    {slide}
                </div>
            ))}

            <div className="progress-bar-container-position">
                <div className="progress-bar-container">
                    <div
                        className="progress-bar"
                        style={{ transform: `scaleX(${progress})` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default HeroSlider;

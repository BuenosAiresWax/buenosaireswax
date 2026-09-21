import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/config";
import { computePeaksFromFile, formatTime } from "../player/waveform.js";
import "./trackUploader.css";

const stripExtension = (name = "") => {
    const base = name.replace(/\.[a-z0-9]+$/i, "");
    return base.trim().replace(/\s+/g, " ");
};

const sanitizeFileName = (name = "") =>
    name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/\.{2,}/g, ".");

const normalizeTrackList = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map((track) => ({
        titulo: track?.titulo || "",
        bpm: Number(track?.bpm) || null,
        duracion: Number(track?.duracion) || 0,
        audioUrl: track?.audioUrl || "",
        peaks: Array.isArray(track?.peaks) ? track.peaks : [],
        autor: track?.autor || "",
    }));
};

export default function TrackUploader({ value, onChange, disabled = false }) {
    const [uploadingIndex, setUploadingIndex] = useState(null);
    const [message, setMessage] = useState(null);
    const fileInputs = useRef([]);

    const items = normalizeTrackList(value);

    const setItems = (next) => {
        if (typeof onChange === "function") onChange(next);
    };

    const flushMessage = (text) => {
        setMessage(text);
        if (text) setTimeout(() => setMessage(null), 3500);
    };

    const handleFile = async (index, file) => {
        if (!file) return;
        if (uploadingIndex !== null) return;

        setUploadingIndex(index);
        setMessage(null);

        try {
            const { peaks, duration } = await computePeaksFromFile(file);
            const storagePath = `productos/audio-${Date.now()}-${sanitizeFileName(file.name)}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file, {
                contentType: file.type || "audio/mpeg",
            });
            const audioUrl = await getDownloadURL(storageRef);

            const next = items.map((track, i) =>
                i === index
                    ? {
                          ...track,
                          audioUrl,
                          peaks,
                          duracion: duration,
                          titulo: track.titulo || stripExtension(file.name),
                      }
                    : track,
            );

            setItems(next);
            flushMessage(`✓ Audio "${stripExtension(file.name)}" subido correctamente.`);
        } catch (err) {
            console.error("Error subiendo audio:", err);
            flushMessage("✗ No se pudo procesar el audio.");
        } finally {
            setUploadingIndex(null);
            if (fileInputs.current[index]) {
                fileInputs.current[index].value = "";
            }
        }
    };

    const updateTrack = (index, patch) => {
        const next = items.map((track, i) => (i === index ? { ...track, ...patch } : track));
        setItems(next);
    };

    const removeTrack = (index) => {
        const next = items.filter((_, i) => i !== index);
        setItems(next);
        if (fileInputs.current[index]) fileInputs.current[index].value = "";
    };

    const addTrack = () => {
        setItems([
            ...items,
            { titulo: "", bpm: null, duracion: 0, audioUrl: "", peaks: [], autor: "" },
        ]);
    };

    return (
        <div className={`track-uploader ${disabled ? "track-uploader--disabled" : ""}`}>
            <div className="track-uploader__header">
                <span className="track-uploader__title">Tracks / Audio preview</span>
                <span className="track-uploader__hint">
                    Audio propio en Firebase Storage · se calcula la forma de onda al subir
                </span>
            </div>

            {items.length === 0 && (
                <p className="track-uploader__empty">
                    Aún no hay tracks cargados. Subí el audio de cada tema para habilitar el
                    reproductor con waveform y BPM.
                </p>
            )}

            {items.map((track, index) => (
                <div
                    key={index}
                    className={`track-item ${track.audioUrl ? "track-item--ready" : ""}`}
                >
                    <span className="track-item__idx">{String(index + 1).padStart(2, "0")}</span>

                    <div className="track-item__fields">
                        <label className="track-item__field">
                            <span>Título</span>
                            <input
                                type="text"
                                value={track.titulo}
                                onChange={(e) => updateTrack(index, { titulo: e.target.value })}
                                placeholder={`Track ${index + 1}`}
                                disabled={disabled}
                            />
                        </label>

                        <label className="track-item__field track-item__field--bpm">
                            <span>BPM</span>
                            <input
                                type="number"
                                min="0"
                                value={track.bpm ?? ""}
                                onChange={(e) =>
                                    updateTrack(index, {
                                        bpm: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                }
                                placeholder="128"
                                disabled={disabled}
                            />
                        </label>

                        <label className="track-item__field track-item__field--file">
                            <span>Audio</span>
                            {track.audioUrl ? (
                                <div className="track-item__file-ready">
                                    <span className="track-item__file-name">
                                        {stripExtension(track.audioUrl.split("/").pop()) || "audio"}
                                    </span>
                                    {track.duracion > 0 && (
                                        <span className="track-item__dur">
                                            {formatTime(track.duracion)}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="track-item__file-input"
                                    ref={(node) => {
                                        fileInputs.current[index] = node;
                                    }}
                                    onChange={(e) => handleFile(index, e.target.files?.[0])}
                                    disabled={disabled || uploadingIndex !== null}
                                />
                            )}
                        </label>
                    </div>

                    {uploadingIndex === index && (
                        <div className="track-item__status">
                            <span className="track-item__spinner" />
                            Subiendo audio y calculando waveform…
                        </div>
                    )}

                    <button
                        type="button"
                        className="track-item__remove"
                        onClick={() => removeTrack(index)}
                        disabled={disabled || uploadingIndex !== null}
                        title="Quitar track"
                    >
                        ✕
                    </button>
                </div>
            ))}

            <div className="track-uploader__footer">
                <button
                    type="button"
                    className="track-uploader__add"
                    onClick={addTrack}
                    disabled={disabled || uploadingIndex !== null}
                >
                    + Agregar track
                </button>

                {message && (
                    <span
                        className={`track-uploader__msg ${message.startsWith("✓")
                            ? "track-uploader__msg--ok"
                            : message.startsWith("✗")
                                ? "track-uploader__msg--err"
                                : ""}`}
                    >
                        {message}
                    </span>
                )}
            </div>
        </div>
    );
}
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { computePeaksFromFile } from "../player/waveform.js";
import {
    AUDIO_EXTENSIONS,
    IMAGE_EXTENSIONS,
    buildBulkPlan,
    buildFileIndex,
    buildProductDocument,
    getContentType,
    getExtension,
    parseBulkWorkbook,
    sanitizeFileName,
    stripExtension,
} from "../utils/bulkProducts";
import "../styles/adminCargaMasiva.css";

const STAGE = {
    SELECT: "select",
    REVIEW: "review",
    ANALYZING: "analyzing",
    READY: "ready",
    PUBLISHING: "publishing",
    DONE: "done",
};

const STEPS = [
    { id: STAGE.SELECT, label: "Seleccionar" },
    { id: STAGE.REVIEW, label: "Validar" },
    { id: STAGE.ANALYZING, label: "Analizar audio" },
    { id: STAGE.READY, label: "Listo para publicar" },
    { id: STAGE.DONE, label: "Publicado" },
];

const INITIAL_OPTIONS = {
    allowMissingImages: false,
    allowMissingAudio: false,
    skipExisting: false,
    updateOnly: false,
    clearTracks: false,
};

function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function stepIndex(stage) {
    if (stage === STAGE.SELECT) return 0;
    if (stage === STAGE.REVIEW) return 1;
    if (stage === STAGE.ANALYZING) return 2;
    if (stage === STAGE.READY || stage === STAGE.PUBLISHING) return 3;
    return 4;
}

function ProgressBar({ current, total, label }) {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

    return (
        <div className="bulk-progress">
            <div className="bulk-progress__head">
                <span>{label || "Procesando..."}</span>
                <span>
                    {current}/{total} ({percent}%)
                </span>
            </div>
            <div className="bulk-progress__track">
                <div className="bulk-progress__fill" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

function Messages({ items, kind }) {
    if (!items.length) return null;
    const visible = items.slice(0, 30);

    return (
        <div className={`bulk-messages bulk-messages--${kind}`}>
            <strong>
                {kind === "error" ? "Errores" : "Advertencias"} ({items.length})
            </strong>
            <ul>
                {visible.map((item, index) => (
                    <li key={`${kind}-${index}`}>{item}</li>
                ))}
            </ul>
            {items.length > visible.length && (
                <p>... y {items.length - visible.length} más.</p>
            )}
        </div>
    );
}

function PlanPreview({ plan }) {
    const visible = plan.slice(0, 100);

    return (
        <div className="bulk-table-wrap">
            <table className="bulk-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>ID</th>
                        <th>Colección</th>
                        <th>Imagen</th>
                        <th>Tracks</th>
                    </tr>
                </thead>
                <tbody>
                    {visible.map((item) => {
                        const totalTracks = item.product.tracks.length;
                        const readyTracks = item.tracks.length;
                        const imageLabel = item.imageIsUrl
                            ? "URL"
                            : item.imageFile
                              ? item.imageFile.name
                              : "Falta";
                        const imageOk = item.imageIsUrl || Boolean(item.imageFile);

                        return (
                            <tr key={`${item.product.coleccion.collectionName}-${item.product.id}`}>
                                <td>{item.product.titulo}</td>
                                <td className="bulk-table__mono">{item.product.id}</td>
                                <td>{item.product.coleccion.label}</td>
                                <td className={imageOk ? "" : "bulk-table__bad"}>{imageLabel}</td>
                                <td className={readyTracks === totalTracks ? "" : "bulk-table__bad"}>
                                    {readyTracks}/{totalTracks}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {plan.length > visible.length && (
                <p className="bulk-table__more">
                    Mostrando {visible.length} de {plan.length} productos.
                </p>
            )}
        </div>
    );
}

export default function AdminCargaMasiva({ onDone }) {
    const [excelFile, setExcelFile] = useState(null);
    const [imageFiles, setImageFiles] = useState([]);
    const [audioFiles, setAudioFiles] = useState([]);
    const [options, setOptions] = useState(INITIAL_OPTIONS);
    const [optionsDirty, setOptionsDirty] = useState(false);
    const [parsed, setParsed] = useState(null);
    const [planData, setPlanData] = useState(null);
    const [stage, setStage] = useState(STAGE.SELECT);
    const [validating, setValidating] = useState(false);
    const [analysisState, setAnalysisState] = useState({ done: 0, total: 0, errors: [] });
    const [publishSummary, setPublishSummary] = useState(null);
    const [confirmPublish, setConfirmPublish] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
    const [log, setLog] = useState([]);

    const excelInputRef = useRef(null);
    const imagesInputRef = useRef(null);
    const audioInputRef = useRef(null);
    const analysisRef = useRef(new Map());
    const cancelRef = useRef(false);

    const busy = stage === STAGE.ANALYZING || stage === STAGE.PUBLISHING;

    useEffect(() => {
        const inputs = [imagesInputRef.current, audioInputRef.current];
        for (const input of inputs) {
            if (!input) continue;
            input.webkitdirectory = true;
            input.setAttribute("webkitdirectory", "");
            input.setAttribute("directory", "");
        }
    }, []);

    const addLog = useCallback((message) => {
        const stamp = new Date().toLocaleTimeString("es-AR");
        setLog((prev) => [...prev.slice(-499), `${stamp} | ${message}`]);
    }, []);

    const resetWorkflow = useCallback(() => {
        setParsed(null);
        setPlanData(null);
        setStage(STAGE.SELECT);
        setProgress({ current: 0, total: 0, label: "" });
        setLog([]);
        setAnalysisState({ done: 0, total: 0, errors: [] });
        setPublishSummary(null);
        setConfirmPublish(false);
        setOptionsDirty(false);
        cancelRef.current = false;
        analysisRef.current = new Map();
    }, []);

    const resetAll = useCallback(() => {
        resetWorkflow();
        setExcelFile(null);
        setImageFiles([]);
        setAudioFiles([]);
        if (excelInputRef.current) excelInputRef.current.value = "";
        if (imagesInputRef.current) imagesInputRef.current.value = "";
        if (audioInputRef.current) audioInputRef.current.value = "";
    }, [resetWorkflow]);

    const handleExcelChange = (event) => {
        const file = event.target.files?.[0] || null;
        event.target.value = "";
        setExcelFile(file);
        resetWorkflow();
    };

    const handleImagesChange = (event) => {
        const files = Array.from(event.target.files || []).filter((file) =>
            IMAGE_EXTENSIONS.has(getExtension(file.name)),
        );
        event.target.value = "";
        setImageFiles(files);
        resetWorkflow();
    };

    const handleAudioChange = (event) => {
        const files = Array.from(event.target.files || []).filter((file) =>
            AUDIO_EXTENSIONS.has(getExtension(file.name)),
        );
        event.target.value = "";
        setAudioFiles(files);
        resetWorkflow();
    };

    const handleOptionChange = (name, value) => {
        setOptions((prev) => {
            const next = { ...prev, [name]: value };
            if (name === "skipExisting" && value) next.updateOnly = false;
            if (name === "updateOnly" && value) next.skipExisting = false;
            return next;
        });
        setOptionsDirty(true);
    };

    const handleValidate = async () => {
        if (!excelFile || validating || busy) return;

        setValidating(true);
        setParsed(null);
        setPlanData(null);
        setStage(STAGE.SELECT);
        setProgress({ current: 0, total: 0, label: "" });
        setLog([]);
        setAnalysisState({ done: 0, total: 0, errors: [] });
        setPublishSummary(null);
        setConfirmPublish(false);
        analysisRef.current = new Map();
        addLog(`Leyendo Excel: ${excelFile.name}`);

        try {
            const buffer = await excelFile.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const parsedResult = parseBulkWorkbook(workbook);

            addLog(
                `Hoja productos: ${parsedResult.meta.hojaProductos} | Hoja tracks: ${parsedResult.meta.hojaTracks}`,
            );
            addLog(
                `Productos encontrados: ${parsedResult.products.length} | Filas de tracks: ${parsedResult.meta.filasTracks}`,
            );

            parsedResult.errors.forEach((message) => addLog(`ERROR | ${message}`));
            parsedResult.warnings.forEach((message) => addLog(`AVISO | ${message}`));

            const imageIndex = buildFileIndex(imageFiles);
            const audioIndex = buildFileIndex(audioFiles);
            const planResult = buildBulkPlan(
                parsedResult.products,
                imageIndex,
                audioIndex,
                options,
            );

            addLog(
                `Archivos seleccionados: ${imageFiles.length} imágenes | ${audioFiles.length} audios`,
            );
            addLog(
                `Plan: ${planResult.stats.productos} productos | ${planResult.stats.tracks} tracks | ${planResult.errors.length} errores`,
            );

            setParsed(parsedResult);
            setPlanData(planResult);
            setOptionsDirty(false);
            setStage(STAGE.REVIEW);
        } catch (error) {
            addLog(`ERROR | ${error.message}`);
            setParsed({
                products: [],
                errors: [error.message],
                warnings: [],
                meta: { hojaProductos: "", hojaTracks: "", filasProductos: 0, filasTracks: 0 },
            });
            setPlanData(null);
            setStage(STAGE.REVIEW);
        } finally {
            setValidating(false);
        }
    };

    const handleAnalyze = async () => {
        if (!planData || planData.errors.length > 0 || optionsDirty || busy) return;

        setStage(STAGE.ANALYZING);
        setConfirmPublish(false);
        cancelRef.current = false;
        analysisRef.current = new Map();

        const total = planData.plan.reduce((count, item) => count + item.tracks.length, 0);
        const errors = [];
        let done = 0;
        let cancelled = false;

        setAnalysisState({ done: 0, total, errors: [] });
        setProgress({ current: 0, total, label: "Preparando análisis..." });
        addLog(`Iniciando análisis de audio: ${total} tracks.`);

        for (let planIndex = 0; planIndex < planData.plan.length; planIndex += 1) {
            const item = planData.plan[planIndex];

            for (let trackIndex = 0; trackIndex < item.tracks.length; trackIndex += 1) {
                if (cancelRef.current) {
                    cancelled = true;
                    break;
                }

                const track = item.tracks[trackIndex];
                const key = `${planIndex}:${trackIndex}`;
                const label = `${item.product.titulo} · ${track.titulo}`;

                setProgress({ current: done, total, label: `Analizando ${label}` });

                try {
                    const result = await computePeaksFromFile(track.audioFile);
                    analysisRef.current.set(key, result);
                    addLog(
                        `OK audio | ${label} | ${result.duration.toFixed(1)}s | ${result.peaks.length} peaks`,
                    );
                } catch (error) {
                    analysisRef.current.set(key, { error: error.message });
                    errors.push(`${label}: ${error.message}`);
                    addLog(`ERROR audio | ${label} | ${error.message}`);
                }

                done += 1;
                setProgress({ current: done, total, label: `Analizando ${label}` });
                setAnalysisState({ done, total, errors: [...errors] });
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            if (cancelled) break;
        }

        if (cancelled) {
            addLog("Análisis cancelado por el usuario.");
            analysisRef.current = new Map();
            setAnalysisState({ done: 0, total: 0, errors: [] });
            setStage(STAGE.REVIEW);
            return;
        }

        setAnalysisState({ done, total, errors });
        setStage(STAGE.READY);
        addLog(
            errors.length
                ? `Análisis finalizado con ${errors.length} errores.`
                : "Análisis finalizado correctamente.",
        );
    };

    const handlePublish = async () => {
        if (!planData || !planData.plan.length || busy) return;
        if (analysisState.errors.length > 0 || analysisState.done !== analysisState.total) return;

        setConfirmPublish(false);
        setStage(STAGE.PUBLISHING);
        cancelRef.current = false;

        const summary = {
            creados: 0,
            actualizados: 0,
            omitidos: 0,
            errores: 0,
            imagenes: 0,
            audios: 0,
            peaks: 0,
        };

        const totalOps = planData.plan.reduce(
            (count, item) =>
                count + (item.imageFile ? 1 : 0) + 1 + item.tracks.length * 2,
            0,
        );
        let opDone = 0;

        setPublishSummary(null);
        setProgress({ current: 0, total: totalOps, label: "Iniciando publicación..." });
        addLog("Iniciando publicación en Firebase...");

        for (let planIndex = 0; planIndex < planData.plan.length; planIndex += 1) {
            if (cancelRef.current) break;

            const item = planData.plan[planIndex];
            const { product } = item;
            const label = `${product.titulo} (${product.id})`;

            try {
                const docRef = doc(db, product.coleccion.collectionName, product.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && options.skipExisting) {
                    summary.omitidos += 1;
                    addLog(`OMITIDO | ${label} | ya existe`);
                    continue;
                }

                if (!docSnap.exists() && options.updateOnly) {
                    summary.omitidos += 1;
                    addLog(`OMITIDO | ${label} | no existe`);
                    continue;
                }

                let imageUrl = item.imageIsUrl ? String(product.row.imagen || "").trim() : "";

                if (item.imageFile) {
                    const ext = getExtension(item.imageFile.name);
                    const imageRef = ref(storage, `productos/imagenes/${product.id}${ext}`);
                    setProgress({
                        current: opDone,
                        total: totalOps,
                        label: `Subiendo imagen · ${label}`,
                    });
                    await uploadBytes(imageRef, item.imageFile, {
                        contentType: getContentType(item.imageFile.name, "image"),
                    });
                    imageUrl = await getDownloadURL(imageRef);
                    summary.imagenes += 1;
                    opDone += 1;
                    setProgress({
                        current: opDone,
                        total: totalOps,
                        label: `Imagen lista · ${label}`,
                    });
                } else if (!imageUrl && options.allowMissingImages) {
                    imageUrl = "";
                }

                const trackList = [];

                for (let trackIndex = 0; trackIndex < item.tracks.length; trackIndex += 1) {
                    if (cancelRef.current) break;

                    const track = item.tracks[trackIndex];
                    const key = `${planIndex}:${trackIndex}`;
                    const analysis = analysisRef.current.get(key);

                    if (!analysis || analysis.error) {
                        addLog(`SIN ANÁLISIS | ${label} · ${track.titulo}`);
                        continue;
                    }

                    const ext = getExtension(track.audioFile.name);
                    const base = sanitizeFileName(stripExtension(track.audioFile.name)) || "audio";
                    const order = String(trackIndex + 1).padStart(2, "0");
                    const audioRef = ref(
                        storage,
                        `productos/audio/${product.id}/${order}-${base}${ext}`,
                    );

                    setProgress({
                        current: opDone,
                        total: totalOps,
                        label: `Subiendo audio · ${track.titulo}`,
                    });
                    await uploadBytes(audioRef, track.audioFile, {
                        contentType: getContentType(track.audioFile.name, "audio"),
                    });
                    const audioUrl = await getDownloadURL(audioRef);
                    summary.audios += 1;
                    opDone += 1;
                    setProgress({
                        current: opDone,
                        total: totalOps,
                        label: `Audio subido · ${track.titulo}`,
                    });

                    const peaksPayload = {
                        version: 1,
                        duration: analysis.duration,
                        sampleRate: analysis.sampleRate || 0,
                        buckets: analysis.peaks.length,
                        peaks: analysis.peaks,
                    };
                    const peaksRef = ref(
                        storage,
                        `productos/peaks/${product.id}/${order}.json`,
                    );
                    const peaksBlob = new Blob([JSON.stringify(peaksPayload)], {
                        type: "application/json",
                    });

                    setProgress({
                        current: opDone,
                        total: totalOps,
                        label: `Guardando peaks · ${track.titulo}`,
                    });
                    await uploadBytes(peaksRef, peaksBlob, {
                        contentType: "application/json",
                    });
                    const peaksUrl = await getDownloadURL(peaksRef);
                    summary.peaks += 1;
                    opDone += 1;
                    setProgress({
                        current: opDone,
                        total: totalOps,
                        label: `Peaks listos · ${track.titulo}`,
                    });

                    trackList.push({
                        titulo: track.titulo,
                        autor: track.autor || String(product.row.autor || ""),
                        bpm: track.bpm,
                        duracion: track.duracion || Math.round(analysis.duration * 1000) / 1000,
                        audioUrl,
                        peaks: analysis.peaks,
                        peaksUrl,
                    });
                }

                if (trackList.length > 0) {
                    const totalPeaks = trackList.reduce(
                        (count, track) =>
                            count + (Array.isArray(track.peaks) ? track.peaks.length : 0),
                        0,
                    );

                    if (totalPeaks > 20000) {
                        trackList.forEach((track) => {
                            delete track.peaks;
                        });
                    }
                }

                const data = buildProductDocument(item, imageUrl, trackList);

                if (trackList.length === 0 && docSnap.exists() && !options.clearTracks) {
                    delete data.trackList;
                }

                const stamp = serverTimestamp();
                const payload = docSnap.exists()
                    ? { ...data, updatedAt: stamp }
                    : { ...data, createdAt: stamp };

                setProgress({
                    current: opDone,
                    total: totalOps,
                    label: `Guardando producto · ${label}`,
                });
                await setDoc(docRef, payload, { merge: true });
                opDone += 1;

                if (docSnap.exists()) {
                    summary.actualizados += 1;
                    addLog(`OK ACTUALIZADO | ${label} | tracks=${trackList.length}`);
                } else {
                    summary.creados += 1;
                    addLog(`OK CREADO | ${label} | tracks=${trackList.length}`);
                }

                setProgress({
                    current: opDone,
                    total: totalOps,
                    label: `Producto guardado · ${label}`,
                });
            } catch (error) {
                summary.errores += 1;
                addLog(`ERROR | ${label} | ${error.message}`);
            }
        }

        if (cancelRef.current) {
            addLog("Publicación cancelada por el usuario.");
        }

        setPublishSummary(summary);
        setStage(STAGE.DONE);
        addLog(
            `Publicación finalizada. Creados=${summary.creados} Actualizados=${summary.actualizados} Omitidos=${summary.omitidos} Errores=${summary.errores}`,
        );

        if (onDone && summary.creados + summary.actualizados > 0) {
            onDone();
        }
    };

    const handleBackToReview = () => {
        setStage(STAGE.REVIEW);
        setAnalysisState({ done: 0, total: 0, errors: [] });
        setConfirmPublish(false);
        analysisRef.current = new Map();
    };

    const allErrors = [...(parsed?.errors || []), ...(planData?.errors || [])];
    const allWarnings = [...(parsed?.warnings || []), ...(planData?.warnings || [])];
    const currentStep = stepIndex(stage);
    const canValidate = Boolean(excelFile) && !validating && !busy;
    const canAnalyze =
        stage === STAGE.REVIEW &&
        Boolean(planData) &&
        planData.plan.length > 0 &&
        allErrors.length === 0 &&
        !optionsDirty &&
        !busy;
    const canPublish =
        stage === STAGE.READY &&
        !optionsDirty &&
        analysisState.errors.length === 0 &&
        analysisState.done === analysisState.total;

    return (
        <div className="bulk">
            <div className="bulk-head">
                <div>
                    <h2 className="bulk-title">Carga masiva de productos</h2>
                    <p className="bulk-subtitle">
                        Seleccioná el Excel y las carpetas de imágenes y audios. Después
                        validá, analizá los audios y publicá por etapas.
                    </p>
                </div>
                <button
                    type="button"
                    className="bulk-btn bulk-btn--ghost"
                    onClick={resetAll}
                    disabled={busy}
                >
                    Limpiar todo
                </button>
            </div>

            <div className="bulk-steps">
                {STEPS.map((step, index) => {
                    const state =
                        index < currentStep
                            ? "done"
                            : index === currentStep
                              ? "active"
                              : "pending";

                    return (
                        <div key={step.id} className={`bulk-step bulk-step--${state}`}>
                            <span className="bulk-step__number">{index + 1}</span>
                            <span className="bulk-step__label">{step.label}</span>
                        </div>
                    );
                })}
            </div>

            <section className="bulk-card">
                <h3 className="bulk-card__title">1. Archivos</h3>
                <p className="bulk-card__hint">
                    El Excel debe tener una hoja de productos y, opcionalmente, una hoja
                    <code> tracks</code>. Las carpetas se pueden seleccionar completas o
                    elegir varios archivos a la vez.
                </p>

                <div className="bulk-pickers">
                    <div className="bulk-picker">
                        <span className="bulk-picker__icon">📄</span>
                        <div className="bulk-picker__body">
                            <strong>Excel de productos</strong>
                            <span>
                                {excelFile
                                    ? `${excelFile.name} (${formatBytes(excelFile.size)})`
                                    : "Ningún archivo seleccionado"}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="bulk-btn"
                            onClick={() => excelInputRef.current?.click()}
                            disabled={busy}
                        >
                            Seleccionar Excel
                        </button>
                        <input
                            ref={excelInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleExcelChange}
                            hidden
                        />
                    </div>

                    <div className="bulk-picker">
                        <span className="bulk-picker__icon">🖼️</span>
                        <div className="bulk-picker__body">
                            <strong>Carpeta de imágenes</strong>
                            <span>
                                {imageFiles.length
                                    ? `${imageFiles.length} archivos`
                                    : "Ninguna carpeta seleccionada"}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="bulk-btn"
                            onClick={() => imagesInputRef.current?.click()}
                            disabled={busy}
                        >
                            Seleccionar carpeta
                        </button>
                        <input
                            ref={imagesInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.webp,.avif,image/*"
                            multiple
                            onChange={handleImagesChange}
                            hidden
                        />
                    </div>

                    <div className="bulk-picker">
                        <span className="bulk-picker__icon">🎧</span>
                        <div className="bulk-picker__body">
                            <strong>Carpeta de audios</strong>
                            <span>
                                {audioFiles.length
                                    ? `${audioFiles.length} archivos`
                                    : "Ninguna carpeta seleccionada"}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="bulk-btn"
                            onClick={() => audioInputRef.current?.click()}
                            disabled={busy}
                        >
                            Seleccionar carpeta
                        </button>
                        <input
                            ref={audioInputRef}
                            type="file"
                            accept=".mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.aif,.aiff,.opus,audio/*"
                            multiple
                            onChange={handleAudioChange}
                            hidden
                        />
                    </div>
                </div>

                <div className="bulk-options">
                    <label className="bulk-check">
                        <input
                            type="checkbox"
                            checked={options.allowMissingImages}
                            onChange={(event) =>
                                handleOptionChange("allowMissingImages", event.target.checked)
                            }
                            disabled={busy}
                        />
                        <span>Permitir productos sin imagen</span>
                    </label>
                    <label className="bulk-check">
                        <input
                            type="checkbox"
                            checked={options.allowMissingAudio}
                            onChange={(event) =>
                                handleOptionChange("allowMissingAudio", event.target.checked)
                            }
                            disabled={busy}
                        />
                        <span>Permitir tracks sin audio</span>
                    </label>
                    <label className="bulk-check">
                        <input
                            type="checkbox"
                            checked={options.skipExisting}
                            onChange={(event) =>
                                handleOptionChange("skipExisting", event.target.checked)
                            }
                            disabled={busy}
                        />
                        <span>Omitir productos existentes</span>
                    </label>
                    <label className="bulk-check">
                        <input
                            type="checkbox"
                            checked={options.updateOnly}
                            onChange={(event) =>
                                handleOptionChange("updateOnly", event.target.checked)
                            }
                            disabled={busy}
                        />
                        <span>Actualizar solo existentes</span>
                    </label>
                    <label className="bulk-check">
                        <input
                            type="checkbox"
                            checked={options.clearTracks}
                            onChange={(event) =>
                                handleOptionChange("clearTracks", event.target.checked)
                            }
                            disabled={busy}
                        />
                        <span>Borrar tracks si el Excel no trae ninguno</span>
                    </label>
                </div>

                <div className="bulk-actions">
                    <button
                        type="button"
                        className="bulk-btn bulk-btn--primary"
                        onClick={handleValidate}
                        disabled={!canValidate}
                    >
                        {validating ? "Validando..." : "Validar planilla"}
                    </button>
                    {optionsDirty && parsed && (
                        <span className="bulk-note">
                            Cambiaste las opciones: volvé a validar antes de analizar.
                        </span>
                    )}
                </div>
            </section>

            {(stage === STAGE.REVIEW || stage === STAGE.ANALYZING || stage === STAGE.READY) &&
                planData && (
                    <section className="bulk-card">
                        <div className="bulk-card__head">
                            <h3 className="bulk-card__title">2. Validación</h3>
                            <button
                                type="button"
                                className="bulk-btn bulk-btn--ghost"
                                onClick={handleValidate}
                                disabled={validating || busy}
                            >
                                Revalidar
                            </button>
                        </div>

                        <div className="bulk-stats">
                            <div className="bulk-stat">
                                <span>{planData.stats.productos}</span>
                                <small>Productos</small>
                            </div>
                            <div className="bulk-stat">
                                <span>{planData.stats.tracks}</span>
                                <small>Tracks</small>
                            </div>
                            <div className="bulk-stat">
                                <span>
                                    {planData.stats.imagenes + planData.stats.imagenesUrl}
                                </span>
                                <small>Imágenes</small>
                            </div>
                            <div className="bulk-stat">
                                <span>{planData.stats.audios}</span>
                                <small>Audios</small>
                            </div>
                            <div
                                className={`bulk-stat ${
                                    allErrors.length ? "bulk-stat--bad" : "bulk-stat--ok"
                                }`}
                            >
                                <span>{allErrors.length}</span>
                                <small>Errores</small>
                            </div>
                            <div className="bulk-stat">
                                <span>{allWarnings.length}</span>
                                <small>Advertencias</small>
                            </div>
                        </div>

                        <Messages items={allErrors} kind="error" />
                        <Messages items={allWarnings} kind="warning" />

                        <PlanPreview plan={planData.plan} />

                        {stage === STAGE.REVIEW && (
                            <div className="bulk-actions">
                                <button
                                    type="button"
                                    className="bulk-btn bulk-btn--primary"
                                    onClick={handleAnalyze}
                                    disabled={!canAnalyze}
                                >
                                    Analizar audio y generar ondas
                                </button>
                                {allErrors.length > 0 && (
                                    <span className="bulk-note">
                                        Corregí los errores para poder analizar y publicar.
                                    </span>
                                )}
                            </div>
                        )}

                        {stage === STAGE.ANALYZING && (
                            <div className="bulk-progress-wrap">
                                <ProgressBar
                                    current={progress.current}
                                    total={progress.total}
                                    label={progress.label}
                                />
                                <button
                                    type="button"
                                    className="bulk-btn bulk-btn--danger"
                                    onClick={() => {
                                        cancelRef.current = true;
                                        addLog("Cancelando análisis...");
                                    }}
                                >
                                    Cancelar análisis
                                </button>
                            </div>
                        )}

                        {stage === STAGE.READY && (
                            <div className="bulk-ready">
                                <p className="bulk-ready__text">
                                    Análisis completo: {analysisState.done}/
                                    {analysisState.total} tracks
                                    {analysisState.errors.length
                                        ? ` · ${analysisState.errors.length} errores`
                                        : " · sin errores"}
                                </p>

                                <Messages items={analysisState.errors} kind="error" />

                                <div className="bulk-actions">
                                    <button
                                        type="button"
                                        className="bulk-btn bulk-btn--ghost"
                                        onClick={handleBackToReview}
                                        disabled={busy}
                                    >
                                        Volver a validación
                                    </button>
                                    <button
                                        type="button"
                                        className="bulk-btn bulk-btn--primary"
                                        onClick={() => setConfirmPublish(true)}
                                        disabled={!canPublish || confirmPublish}
                                    >
                                        Publicar en Firebase
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}

            {(stage === STAGE.PUBLISHING || stage === STAGE.DONE || confirmPublish) && (
                <section className="bulk-card">
                    <h3 className="bulk-card__title">3. Publicación</h3>

                    {confirmPublish && stage === STAGE.READY && (
                        <div className="bulk-confirm">
                            <p>
                                Vas a publicar <strong>{planData?.stats.productos}</strong>{" "}
                                productos y <strong>{planData?.stats.tracks}</strong> tracks.
                                Se van a subir imágenes, audios y peaks a Firebase Storage.
                            </p>
                            <div className="bulk-actions">
                                <button
                                    type="button"
                                    className="bulk-btn bulk-btn--primary"
                                    onClick={handlePublish}
                                >
                                    Confirmar publicación
                                </button>
                                <button
                                    type="button"
                                    className="bulk-btn bulk-btn--ghost"
                                    onClick={() => setConfirmPublish(false)}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {stage === STAGE.PUBLISHING && (
                        <div className="bulk-progress-wrap">
                            <ProgressBar
                                current={progress.current}
                                total={progress.total}
                                label={progress.label}
                            />
                            <button
                                type="button"
                                className="bulk-btn bulk-btn--danger"
                                onClick={() => {
                                    cancelRef.current = true;
                                    addLog("Cancelando publicación...");
                                }}
                            >
                                Cancelar publicación
                            </button>
                        </div>
                    )}

                    {stage === STAGE.DONE && publishSummary && (
                        <div className="bulk-done">
                            <div className="bulk-stats">
                                <div className="bulk-stat bulk-stat--ok">
                                    <span>{publishSummary.creados}</span>
                                    <small>Creados</small>
                                </div>
                                <div className="bulk-stat">
                                    <span>{publishSummary.actualizados}</span>
                                    <small>Actualizados</small>
                                </div>
                                <div className="bulk-stat">
                                    <span>{publishSummary.omitidos}</span>
                                    <small>Omitidos</small>
                                </div>
                                <div
                                    className={`bulk-stat ${
                                        publishSummary.errores
                                            ? "bulk-stat--bad"
                                            : "bulk-stat--ok"
                                    }`}
                                >
                                    <span>{publishSummary.errores}</span>
                                    <small>Errores</small>
                                </div>
                                <div className="bulk-stat">
                                    <span>{publishSummary.imagenes}</span>
                                    <small>Imágenes</small>
                                </div>
                                <div className="bulk-stat">
                                    <span>{publishSummary.audios}</span>
                                    <small>Audios</small>
                                </div>
                                <div className="bulk-stat">
                                    <span>{publishSummary.peaks}</span>
                                    <small>Peaks</small>
                                </div>
                            </div>

                            <div className="bulk-actions">
                                <button
                                    type="button"
                                    className="bulk-btn bulk-btn--primary"
                                    onClick={resetAll}
                                >
                                    Nueva carga
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {log.length > 0 && (
                <section className="bulk-card">
                    <div className="bulk-card__head">
                        <h3 className="bulk-card__title">Registro</h3>
                        <button
                            type="button"
                            className="bulk-btn bulk-btn--ghost"
                            onClick={() => setLog([])}
                            disabled={busy}
                        >
                            Limpiar registro
                        </button>
                    </div>
                    <div className="bulk-log">
                        {log.map((line, index) => (
                            <div
                                key={`log-${index}`}
                                className={
                                    line.includes("ERROR")
                                        ? "bulk-log__line bulk-log__line--error"
                                        : line.includes("AVISO") || line.includes("SIN ANÁLISIS")
                                          ? "bulk-log__line bulk-log__line--warning"
                                          : "bulk-log__line"
                                }
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

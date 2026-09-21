const DEFAULT_BUCKETS_PER_SECOND = 2.2;
const MIN_BUCKETS = 240;
const MAX_BUCKETS = 1600;

let sharedAudioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new Ctx();
  }
  return sharedAudioContext;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveBuckets(audioBuffer, buckets) {
  if (buckets && Number.isFinite(buckets) && buckets > 0) {
    return buckets;
  }
  const duration = audioBuffer ? audioBuffer.duration : 218;
  return clamp(
    Math.round(duration * DEFAULT_BUCKETS_PER_SECOND),
    MIN_BUCKETS,
    MAX_BUCKETS,
  );
}

/**
 * Genera un array de amplitudes (0..1) a partir de un AudioBuffer.
 * Usa una mezcla RMS + pico por barra para conservar la dinámica real
 * del track (intros, breaks, construcciones y drops se distinguen bien),
 * y adapta la cantidad de barras a la duración del audio.
 */
export function createPeaksFromBuffer(audioBuffer, buckets) {
  if (!audioBuffer) return [];

  const count = resolveBuckets(audioBuffer, buckets);
  const channelCount = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;

  const sumSquares = new Array(count).fill(0);
  const peaks = new Array(count).fill(0);
  const counts = new Array(count).fill(0);

  for (let s = 0; s < totalSamples; s += 1) {
    let sq = 0;
    let bucketPeak = 0;
    for (let c = 0; c < channelCount; c += 1) {
      const value = audioBuffer.getChannelData(c)[s];
      sq += value * value;
      const abs = Math.abs(value);
      if (abs > bucketPeak) bucketPeak = abs;
    }

    const i = Math.min(count - 1, Math.floor((s / totalSamples) * count));
    sumSquares[i] += sq / channelCount;
    if (bucketPeak > peaks[i]) peaks[i] = bucketPeak;
    counts[i] += 1;
  }

  const raw = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const samples = Math.max(1, counts[i]);
    const rms = Math.sqrt(sumSquares[i] / samples);
    // RMS amplificado para que se vea el "cuerpo" del tema, combinandolo
    // con el pico para que los beats/drops mantengan definición.
    const rmsVisible = Math.min(1, rms * 1.8);
    raw[i] = Math.min(1, 0.55 * rmsVisible + 0.45 * peaks[i]);
  }

  let globalMax = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] > globalMax) globalMax = raw[i];
  }

  const normalized = raw.map((value) => {
    const v = globalMax > 0 ? value / globalMax : 0;
    const floored = Math.max(0.015, v);
    return Math.round(floored * 1000) / 1000;
  });

  // Suavizado pequeño para evitar cortes bruscos entre buckets
  const smoothed = normalized.map((value, i) => {
    if (i === 0 || i === normalized.length - 1) return value;
    return Math.round(
      ((normalized[i - 1] + value + normalized[i + 1]) / 3) * 1000,
    ) / 1000;
  });

  return smoothed;
}

/**
 * Calcula peaks + duración a partir de un File (usado en el admin al subir audio).
 */
export async function computePeaksFromFile(file) {
  const context = getAudioContext();
  if (!context) {
    throw new Error("Web Audio API no disponible en este navegador");
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);

  return {
    peaks: createPeaksFromBuffer(audioBuffer),
    duration: audioBuffer.duration,
  };
}

const peaksUrlCache = new Map();
const peaksUrlPending = new Map();

/**
 * Obtiene (y cachea) los peaks de una URL de audio. Útil cuando un track
 * se cargó sin peaks (ej: subido por script) - se calculan bajo demanda.
 */
export function getPeaksForUrl(url, buckets) {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return Promise.resolve(null);
  }

  const key = url;

  if (peaksUrlCache.has(key)) {
    return Promise.resolve(peaksUrlCache.get(key));
  }

  if (peaksUrlPending.has(key)) {
    return peaksUrlPending.get(key);
  }

  const promise = (async () => {
    try {
      const context = getAudioContext();
      if (!context) return null;

      const response = await fetch(url);
      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      const peaks = createPeaksFromBuffer(audioBuffer, buckets);
      peaksUrlCache.set(key, peaks);
      return peaks;
    } catch {
      return null;
    } finally {
      peaksUrlPending.delete(key);
    }
  })();

  peaksUrlPending.set(key, promise);
  return promise;
}

/**
 * Dibuja la forma de onda en un canvas con la parte reproducida resaltada.
 */
export function drawWaveform(
  ctx,
  peaks,
  {
    width,
    height,
    progress = 0,
    baseColor = "rgba(228,228,228,0.22)",
    playedColor = "rgba(0,255,136,0.9)",
    accentColor = "#fac775",
    barGap = 2,
    minBarHeight = 1,
  } = {},
) {
  if (!ctx) return;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const canvasWidth = Math.round(width * dpr);
  const canvasHeight = Math.round(height * dpr);

  if (ctx.canvas.width !== canvasWidth) ctx.canvas.width = canvasWidth;
  if (ctx.canvas.height !== canvasHeight) ctx.canvas.height = canvasHeight;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.save();
  ctx.scale(dpr, dpr);

  const n = peaks.length;
  if (!n) {
    ctx.restore();
    return;
  }

  const slot = width / n;
  const barWidth = Math.max(1, slot - barGap);
  const clampedProgress = clamp(progress, 0, 1);
  const playedUntil = clampedProgress * width;

  for (let i = 0; i < n; i += 1) {
    const value = peaks[i] ?? 0;
    const barHeight = Math.max(minBarHeight, value * height);
    const x = i * slot + (slot - barWidth) / 2;
    const y = (height - barHeight) / 2;

    const barX = x + barWidth;
    const isPlayed = barX <= playedUntil;

    ctx.fillStyle = isPlayed ? playedColor : baseColor;

    if (barWidth <= 3) {
      ctx.fillRect(x, y, barWidth, barHeight);
    } else {
      const radius = Math.min(barWidth / 2, barHeight / 2);
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, radius);
      ctx.fill();
    }
  }

  if (clampedProgress > 0 && clampedProgress < 1) {
    ctx.fillStyle = accentColor;
    ctx.fillRect(playedUntil - 1, 0, 2, height);
  }

  ctx.restore();
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
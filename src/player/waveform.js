const DEFAULT_BUCKETS = 360;

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

/**
 * Genera un array de picos de amplitud (0..1) a partir de un AudioBuffer.
 * Es la forma de onda "estática" que se usa para reconocer el track.
 */
export function createPeaksFromBuffer(audioBuffer, buckets = DEFAULT_BUCKETS) {
  if (!audioBuffer) return [];

  const channelDataArray = [];
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch += 1) {
    channelDataArray.push(audioBuffer.getChannelData(ch));
  }

  const totalSamples = audioBuffer.length;
  const samplesPerBucket = Math.max(1, Math.floor(totalSamples / buckets));

  const peaks = new Array(buckets).fill(0);

  for (let i = 0; i < buckets; i += 1) {
    const start = i * samplesPerBucket;
    const end = Math.min(totalSamples, start + samplesPerBucket);

    let bucketMax = 0;
    for (let s = start; s < end; s += 1) {
      let sampleAbs = 0;
      for (let c = 0; c < channelDataArray.length; c += 1) {
        const value = Math.abs(channelDataArray[c][s]);
        if (value > sampleAbs) sampleAbs = value;
      }
      if (sampleAbs > bucketMax) bucketMax = sampleAbs;
    }

    peaks[i] = Math.sqrt(bucketMax);
  }

  let globalMax = 0;
  for (let i = 0; i < peaks.length; i += 1) {
    if (peaks[i] > globalMax) globalMax = peaks[i];
  }

  const normalized = peaks.map((value) => {
    const v = globalMax > 0 ? value / globalMax : 0;
    const boosted = Math.min(1, Math.max(0.04, Math.pow(v, 0.8)));
    return Math.round(boosted * 1000) / 1000;
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
export async function computePeaksFromFile(file, buckets = DEFAULT_BUCKETS) {
  const context = getAudioContext();
  if (!context) {
    throw new Error("Web Audio API no disponible en este navegador");
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);

  return {
    peaks: createPeaksFromBuffer(audioBuffer, buckets),
    duration: audioBuffer.duration,
  };
}

const peaksUrlCache = new Map();
const peaksUrlPending = new Map();

/**
 * Obtiene (y cachea) los peaks de una URL de audio. Útil cuando un track
 * se cargó sin peaks (ej: subido por script) - se calculan bajo demanda.
 */
export function getPeaksForUrl(url, buckets = DEFAULT_BUCKETS) {
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
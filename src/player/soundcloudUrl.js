const ALLOWED_HOSTS = new Set([
  "soundcloud.com",
  "www.soundcloud.com",
  "m.soundcloud.com",
  "on.soundcloud.com",
  "api.soundcloud.com",
]);

const PLACEHOLDER_VALUES = new Set([
  "sin escucha",
  "sin audio",
  "no disponible",
  "sin track",
  "sin tema",
  "https://ejemplo.com/escucha",
]);

const tryParseUrl = (value, base) => {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
};

const decodeSafely = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function normalizeSoundCloudUrl(rawValue) {
  if (typeof rawValue !== "string") return null;

  let candidate = rawValue.trim();
  if (!candidate) return null;
  if (PLACEHOLDER_VALUES.has(candidate.toLowerCase())) return null;

  // Desanida URLs de embed (w.soundcloud.com/player?url=...)
  for (let i = 0; i < 4; i += 1) {
    const parsed = tryParseUrl(candidate, "https://soundcloud.com/");
    if (!parsed) return null;

    const host = parsed.hostname.toLowerCase();
    const isWidgetHost = host === "w.soundcloud.com";
    const nestedUrl = parsed.searchParams.get("url");

    if (isWidgetHost && nestedUrl) {
      candidate = decodeSafely(nestedUrl).trim();
      continue;
    }

    if ((candidate.startsWith("?url=") || candidate.startsWith("/?url=")) && nestedUrl) {
      candidate = decodeSafely(nestedUrl).trim();
      continue;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (!ALLOWED_HOSTS.has(host)) return null;

    return parsed.toString();
  }

  return null;
}

export function isPlayableSoundCloudUrl(value) {
  return Boolean(normalizeSoundCloudUrl(value));
}

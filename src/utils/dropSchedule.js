const DEFAULT_DROP_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

export const DROP_DATE = import.meta.env.VITE_DROP_DATE || DEFAULT_DROP_DATE;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export function parseDropDate(value = DROP_DATE) {
  if (!value) return null;

  const parsedDate = value instanceof Date ? value : new Date(value);
  const timestamp = parsedDate.getTime();

  return Number.isNaN(timestamp) ? null : parsedDate;
}

export function getDropTime(value = DROP_DATE) {
  const parsedDate = parseDropDate(value);

  if (!parsedDate) return null;

  return parsedDate.getTime();
}

export function isDropAccessWindowActive() {
  const dropTime = getDropTime();

  if (dropTime === null) return false;

  const diferenciaMs = dropTime - Date.now();

  return diferenciaMs > 0 && diferenciaMs < THREE_DAYS_MS;
}

export function isCatalogUnlockedByDropTime() {
  const dropTime = getDropTime();

  if (dropTime === null) return false;

  const diferenciaMs = dropTime - Date.now();

  return diferenciaMs <= ONE_HOUR_MS;
}

export const DROP_DATE = import.meta.env.VITE_DROP_DATE || "2026-07-15T20:00:00-03:00";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function getDropTime() {
  const parsedDate = new Date(DROP_DATE);
  const dropTime = parsedDate.getTime();

  if (Number.isNaN(dropTime)) return null;

  return dropTime;
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

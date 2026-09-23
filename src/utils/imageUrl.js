export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#141414"/><rect x="8" y="8" width="384" height="384" rx="12" fill="none" stroke="#333" stroke-width="2"/><text x="50%" y="50%" fill="#666" font-family="Arial, sans-serif" font-size="28" text-anchor="middle" dominant-baseline="middle">Sin imagen</text></svg>`,
  );

export function fixUrl(url) {
  if (!url) return url;
  if (/^https?:\/\/firebasestorage\.googleapis\.com\//i.test(url)) return url;
  if (/\?.*token=/i.test(url)) return url;
  const m = url.match(/storage\.googleapis\.com\/([^/]+)\/(.+?)(\?.*)?$/);
  if (!m) return url;
  const [, bucket, path] = m;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

export function resolveProductImage(imageUrl) {
  if (!imageUrl) return PLACEHOLDER_IMAGE;
  return fixUrl(imageUrl);
}
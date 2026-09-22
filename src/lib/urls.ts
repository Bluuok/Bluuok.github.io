/**
 * BASE_URL aware link helper for Astro.
 */
export function url(pathStr: string = ''): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  if (!pathStr) return normalizedBase;
  if (pathStr.startsWith('#')) {
    return `${normalizedBase}${pathStr}`;
  }
  const clean = pathStr.startsWith('/') ? pathStr.slice(1) : pathStr;
  return `${normalizedBase}${clean}`;
}

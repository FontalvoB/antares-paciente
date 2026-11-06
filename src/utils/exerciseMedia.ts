/** Solo recursos HTTP(S) del contenido asignado; nunca esquemas ejecutables. */
export function exerciseMediaUrl(value?: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Referencias embebidas solo de proveedores conocidos. Nunca HTML del ERP. */
export function exerciseReferenceUrl(value?: string | null): string | null {
  const source = exerciseMediaUrl(value)
  if (!source) return null
  const url = new URL(source)
  if (url.protocol !== 'https:' || url.port) return null
  if (['www.youtube-nocookie.com', 'www.youtube.com'].includes(url.hostname)
      && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) {
    url.hostname = 'www.youtube-nocookie.com'
    url.search = 'playsinline=1&autoplay=0'
    return url.href
  }
  if (url.hostname === 'player.vimeo.com' && /^\/video\/\d+$/.test(url.pathname)) return url.href
  return null
}

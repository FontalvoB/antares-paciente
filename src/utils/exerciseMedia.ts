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

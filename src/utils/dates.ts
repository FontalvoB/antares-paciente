export function formatDateForDisplay(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function toISODate(display: string): string {
  const [d, m, y] = display.split('/')
  if (!d || !m || !y) return display
  return `${y}-${m}-${d}`
}

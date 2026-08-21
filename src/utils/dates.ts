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

/** 0 = lunes … 6 = domingo */
export function weekdayMondayIndex(d = new Date()): number {
  return (d.getDay() + 6) % 7
}

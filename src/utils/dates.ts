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

export function toLocalISODate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysToISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + days)
  return toLocalISODate(dt)
}

const WEEKDAY_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const

export function weekdayShortEs(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAY_SHORT[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()] ?? ''
}

export function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(y, (m ?? 1) - 1, d ?? 1).getDay()
  return day === 0 || day === 6
}

export function isTodayISO(iso: string): boolean {
  return iso === toLocalISODate()
}

export function dayOfMonth(iso: string): string {
  return String(Number(iso.split('-')[2] ?? ''))
}

export function formatLongDateEs(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  const text = dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function monthTitleEs(year: number, month: number): string {
  const text = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const dt = new Date(year, month - 1 + delta, 1)
  return { year: dt.getFullYear(), month: dt.getMonth() + 1 }
}

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1)
  const pad = (first.getDay() + 6) % 7
  const days = new Date(year, month, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: pad }, () => null)
  for (let d = 1; d <= days; d++) cells.push(toLocalISODate(new Date(year, month - 1, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function isoYearMonth(iso: string): { year: number; month: number } {
  const [y, m] = iso.split('-').map(Number)
  return { year: y ?? 2026, month: m ?? 1 }
}

/** 0 = lunes … 6 = domingo */
export function weekdayMondayIndex(d = new Date()): number {
  return (d.getDay() + 6) % 7
}

import { addDaysToISO, formatDateForDisplay, isWeekendISO, toLocalISODate, weekdayShortEs } from '../utils/dates'

export type ConsultTypeId = 'medica' | 'psicologia' | 'nutricion' | 'urgencia'
export type AppointmentMode = 'Videollamada' | 'Presencial'

export interface ConsultType {
  id: ConsultTypeId
  label: string
  short: string
  emoji: string
  tone: 'teal' | 'pur' | 'blue' | 'org'
}

export interface TeamProfessional {
  id: string
  typeId: ConsultTypeId
  name: string
  role: string
  emoji: string
  accent: string
  color: string
  colorSoft: string
}

export interface ListedAppointment {
  id: string
  when: string
  mode: string
  accent: string
  emoji: string
  name: string
  role: string
  time: string
  day: string
  motivo: string
  color: string
  featured?: boolean
  pending?: boolean
}

export const CONSULT_TYPES: ConsultType[] = [
  { id: 'medica', label: 'Médica', short: 'Control y prevención', emoji: '🩺', tone: 'teal' },
  { id: 'psicologia', label: 'Psicología', short: 'Bienestar emocional', emoji: '🧠', tone: 'pur' },
  { id: 'nutricion', label: 'Nutrición', short: 'Plan alimentario', emoji: '🥗', tone: 'blue' },
  { id: 'urgencia', label: 'Urgencia', short: 'Atención prioritaria', emoji: '🚨', tone: 'org' },
]

export const TEAM_PROFESSIONALS: TeamProfessional[] = [
  {
    id: 'ramirez',
    typeId: 'medica',
    name: 'Dr. Carlos Ramírez, MD',
    role: 'Médico COPP-ADRESD',
    emoji: '🩺',
    accent: 'linear-gradient(90deg,#0C3D2C,var(--teal))',
    color: 'var(--teal)',
    colorSoft: 'var(--teal-l)',
  },
  {
    id: 'mora',
    typeId: 'psicologia',
    name: 'Psic. Luis Mora',
    role: 'Psicólogo clínico · CBT',
    emoji: '🧠',
    accent: 'linear-gradient(90deg,#2D1B69,#4C1D95)',
    color: 'var(--pur)',
    colorSoft: 'var(--pur-l)',
  },
  {
    id: 'torres',
    typeId: 'nutricion',
    name: 'Nut. Ana Torres, RDN',
    role: 'Nutricionista · CDR',
    emoji: '🥗',
    accent: 'linear-gradient(90deg,#102a50,#2f78df)',
    color: 'var(--blue)',
    colorSoft: 'var(--blue-l)',
  },
  {
    id: 'cruz',
    typeId: 'urgencia',
    name: 'Dra. Elena Cruz, MD',
    role: 'Médica de guardia',
    emoji: '🚨',
    accent: 'linear-gradient(90deg,#7a3b12,var(--org))',
    color: 'var(--org)',
    colorSoft: 'var(--org-l)',
  },
]

export const INITIAL_UPCOMING: ListedAppointment[] = [
  {
    id: 'apt-ramirez-hoy',
    when: 'HOY · CONFIRMADA',
    mode: 'Telemedicina',
    accent: 'linear-gradient(90deg,#0C3D2C,var(--teal))',
    emoji: '🩺',
    name: 'Dr. Carlos Ramírez, MD',
    role: 'Médico COPP-ADRESD',
    time: '15:00',
    day: 'Hoy',
    motivo: 'Control preventivo · Semana 12',
    color: 'var(--teal)',
    featured: true,
  },
  {
    id: 'apt-torres',
    when: 'JUE 08/08 · CONFIRMADA',
    mode: 'Presencial',
    accent: 'linear-gradient(90deg,#102a50,#2f78df)',
    emoji: '🥗',
    name: 'Nut. Ana Torres, RDN',
    role: 'Nutricionista · CDR',
    time: '10:00',
    day: '08/08',
    motivo: 'Seguimiento plan nutricional MNT #4',
    color: 'var(--blue)',
  },
  {
    id: 'apt-reyes',
    when: 'VIE 09/08 · CONFIRMADA',
    mode: 'Telemedicina',
    accent: 'linear-gradient(90deg,#2D1B69,#4C1D95)',
    emoji: '💪',
    name: 'Coach Marco Reyes, NBHWC',
    role: 'Health Coach',
    time: '11:00',
    day: '09/08',
    motivo: 'Revisión de metas SMART · Semana 12',
    color: 'var(--pur)',
  },
]

const WEEKDAY_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30',
] as const

const URGENCY_WEEKEND_SLOTS = ['09:00', '11:00', '14:00', '16:00'] as const

/** Huecos ocupados por profesional y día de la semana (0 = domingo). */
const BUSY: Record<string, Partial<Record<number, readonly string[]>>> = {
  ramirez: { 2: ['15:00'], 4: ['09:00', '09:30'] },
  mora: { 3: ['10:00'], 5: ['11:00', '14:00'] },
  torres: { 2: ['08:30'], 4: ['10:00', '10:30'] },
  cruz: { 1: ['12:00'], 6: ['11:00'] },
}

export function consultTypeById(id: ConsultTypeId): ConsultType {
  return CONSULT_TYPES.find((t) => t.id === id) ?? CONSULT_TYPES[0]
}

export function professionalByType(typeId: ConsultTypeId): TeamProfessional {
  return TEAM_PROFESSIONALS.find((p) => p.typeId === typeId) ?? TEAM_PROFESSIONALS[0]
}

function slotMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function nowMinutes(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

export function bookingWindow() {
  const min = toLocalISODate()
  return { min, max: addDaysToISO(min, 30) }
}

export function isSelectableBookingDate(iso: string, typeId: ConsultTypeId | ''): boolean {
  const { min, max } = bookingWindow()
  if (iso < min || iso > max) return false
  if (typeId !== 'urgencia' && isWeekendISO(iso)) return false
  return true
}

export function listSelectableDates(typeId: ConsultTypeId, limit = 12): string[] {
  const { min, max } = bookingWindow()
  const out: string[] = []
  let iso = min
  while (iso <= max && out.length < limit) {
    if (isSelectableBookingDate(iso, typeId)) out.push(iso)
    iso = addDaysToISO(iso, 1)
  }
  return out
}

export function splitSlots(slots: string[]): { morning: string[]; afternoon: string[] } {
  const morning: string[] = []
  const afternoon: string[] = []
  for (const slot of slots) {
    if (slotMinutes(slot) < 12 * 60) morning.push(slot)
    else afternoon.push(slot)
  }
  return { morning, afternoon }
}

export function getAvailableSlots(typeId: ConsultTypeId, isoDate: string): string[] {
  const pro = professionalByType(typeId)
  const [y, m, d] = isoDate.split('-').map(Number)
  const weekday = new Date(y, (m ?? 1) - 1, d ?? 1).getDay()
  const weekend = weekday === 0 || weekday === 6
  const pool = weekend
    ? typeId === 'urgencia'
      ? [...URGENCY_WEEKEND_SLOTS]
      : []
    : [...WEEKDAY_SLOTS]
  const busy = new Set(BUSY[pro.id]?.[weekday] ?? [])
  const today = toLocalISODate()
  const cutoff = isoDate === today ? nowMinutes() : -1
  return pool.filter((slot) => !busy.has(slot) && slotMinutes(slot) > cutoff)
}

export function firstOpenSlot(typeId: ConsultTypeId): { date: string; time: string } | null {
  for (const iso of listSelectableDates(typeId, 31)) {
    const open = getAvailableSlots(typeId, iso)
    if (open[0]) return { date: iso, time: open[0] }
  }
  return null
}

export function buildRequestedAppointment(input: {
  typeId: ConsultTypeId
  date: string
  time: string
  reason: string
  mode: AppointmentMode
}): ListedAppointment {
  const pro = professionalByType(input.typeId)
  const type = consultTypeById(input.typeId)
  const today = toLocalISODate()
  const dayLabel = input.date === today ? 'Hoy' : formatDateForDisplay(input.date).slice(0, 5)
  return {
    id: `req-${Date.now()}`,
    when: `${weekdayShortEs(input.date)} ${formatDateForDisplay(input.date)} · PENDIENTE`,
    mode: input.mode,
    accent: pro.accent,
    emoji: pro.emoji,
    name: pro.name,
    role: pro.role,
    time: input.time,
    day: dayLabel,
    motivo: `${type.label} · ${input.reason.trim()}`,
    color: pro.color,
    pending: true,
  }
}

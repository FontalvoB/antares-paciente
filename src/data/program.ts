import type { ProgramTaskId } from '../types'

export const PROGRAM_WEEKS = 83

export const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
export const CAL_DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'] as const

export const PROGRAM_TASKS: {
  id: ProgramTaskId
  title: string
  short: string
  pts: number
  tone: 'pur' | 'red' | 'teal' | 'blue' | 'org' | 'indigo'
  hint: string
  emoji: string
}[] = [
  {
    id: 'podcast',
    title: 'Escuchar podcast',
    short: 'Biohacking y metabolismo · 8 min',
    pts: 80,
    tone: 'pur',
    hint: 'Episodio del día · Dr. Ramírez',
    emoji: '🎙️',
  },
  {
    id: 'vitals',
    title: 'Medir signos vitales',
    short: 'FC · SpO2 · Glucosa · Peso',
    pts: 120,
    tone: 'red',
    hint: 'Registra o sincroniza tu reloj',
    emoji: '❤️',
  },
  {
    id: 'nut',
    title: 'Cumplir plan nutricional',
    short: 'Mediterráneo · 1,800 kcal',
    pts: 150,
    tone: 'teal',
    hint: 'Adherencia del menú de hoy',
    emoji: '🥗',
  },
  {
    id: 'ejercicio',
    title: 'Hacer ejercicio del día',
    short: 'Circuito 12 min · Semana 12',
    pts: 150,
    tone: 'blue',
    hint: '6 estaciones guiadas',
    emoji: '🏃',
  },
  {
    id: 'nutraceutico',
    title: 'Tomar nutracéutico',
    short: 'Dosis diaria matutina',
    pts: 80,
    tone: 'org',
    hint: 'Producto ADRED · 1 cápsula',
    emoji: '💊',
  },
  {
    id: 'emocional',
    title: 'Evaluación emocional',
    short: 'Estado psicológico · Semana 12',
    pts: 120,
    tone: 'indigo',
    hint: 'Check-in de bienestar',
    emoji: '🧠',
  },
]

export const PROGRAM_POINTS_MAX = PROGRAM_TASKS.reduce((sum, t) => sum + t.pts, 0)
export const DAY_BONUS_PTS = 50

export const PROGRAM_LEVELS = [
  { name: 'Explorador', min: 0, max: 499 },
  { name: 'Iniciado', min: 500, max: 1499 },
  { name: 'Constante', min: 1500, max: 2999 },
  { name: 'Disciplinado', min: 3000, max: 4999 },
  { name: 'Transformación', min: 5000, max: 7999 },
  { name: 'Bienestar', min: 8000, max: 11999 },
  { name: 'Maestro', min: 12000, max: 99999 },
] as const

export function levelForXp(xp: number) {
  let idx = 0
  for (let i = PROGRAM_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= PROGRAM_LEVELS[i].min) {
      idx = i
      break
    }
  }
  const lv = PROGRAM_LEVELS[idx]
  const span = lv.max - lv.min || 1
  const pct = Math.min(1, Math.max(0, (xp - lv.min) / span))
  return { idx, level: idx + 1, name: lv.name, min: lv.min, max: lv.max, pct }
}

export const VITAL_FIELDS = [
  { id: 'fc', emoji: '❤️', label: 'Frecuencia cardíaca', unit: 'lpm', demo: '72', watch: '71', hint: '50–100 en reposo', lo: 50, hi: 100 },
  { id: 'pa', emoji: '🩺', label: 'Presión arterial', unit: 'mmHg', demo: '118/76', watch: '116/74', hint: 'Ideal < 130/80', lo: 90, hi: 130 },
  { id: 'spo2', emoji: '💨', label: 'SpO2', unit: '%', demo: '98', watch: '98', hint: 'Meta ≥ 95%', lo: 95, hi: 100 },
  { id: 'glu', emoji: '🩸', label: 'Glucosa', unit: 'mg/dL', demo: '97', watch: '95', hint: 'Ayunas 70–99', lo: 70, hi: 99 },
  { id: 'peso', emoji: '⚖️', label: 'Peso', unit: 'kg', demo: '87.8', watch: '87.8', hint: 'Tendencia > cifra', lo: 50, hi: 140 },
  { id: 'temp', emoji: '🌡️', label: 'Temperatura', unit: '°C', demo: '36.6', watch: '36.5', hint: '36.1–37.2', lo: 36, hi: 37.2 },
] as const

export const EMOTION_FACES = [
  { v: '1', face: '😔', label: 'Bajo' },
  { v: '2', face: '😕', label: 'Regular' },
  { v: '3', face: '😐', label: 'Neutro' },
  { v: '4', face: '🙂', label: 'Bien' },
  { v: '5', face: '😄', label: 'Alto' },
]

export const WEEK_BARRIERS = [
  { id: 'antojos', label: '🍔 Antojos' },
  { id: 'tiempo', label: '⏰ Falta de tiempo' },
  { id: 'menu', label: '🍽️ No me gustó el menú' },
  { id: 'emocional', label: '😔 Estado emocional' },
  { id: 'comprension', label: '❓ No entendí el plan' },
  { id: 'ninguno', label: '✅ Nada, fue bien' },
]


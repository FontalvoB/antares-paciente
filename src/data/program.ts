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
    id: 'nutribiotico',
    title: 'Tomar nutribiótico',
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

export const PODCAST_EPISODE = {
  title: 'Biohacking y metabolismo',
  host: 'Dr. Carlos Ramírez',
  durationSec: 492,
  blurb: 'Cómo la consistencia diaria baja la glucosa más que cualquier atajo de una semana.',
  chapters: [
    { at: 0, label: 'Por qué la racha importa' },
    { at: 95, label: 'Insulina y horarios' },
    { at: 260, label: 'El circuito de 12 minutos' },
    { at: 400, label: 'Reto de hoy' },
  ],
  takeaways: ['Misma hora · mismo ritual', 'Proteína en cada comida', '12 min bastan si son diarios'],
}

export const CIRCUIT_STEPS = [
  { name: 'Calentamiento', sec: 120, cue: 'Cuello, hombros y cadera · respiración nasal' },
  { name: 'Sentadillas', sec: 120, cue: 'Ritmo controlado · rodillas alineadas' },
  { name: 'Plancha', sec: 60, cue: 'Core activo · no hundir la lumbar' },
  { name: 'Caminata', sec: 180, cue: 'Paso amplio · brazos sueltos' },
  { name: 'Estiramiento', sec: 120, cue: 'Isquiotibiales, pecho y psoas' },
  { name: 'Respiración 4-7-8', sec: 120, cue: 'Inhala 4 · retén 7 · exhala 8' },
]

export const VITAL_FIELDS = [
  { id: 'fc', emoji: '❤️', label: 'Frecuencia cardíaca', unit: 'lpm', demo: '72', watch: '71', hint: '50–100 en reposo', lo: 50, hi: 100 },
  { id: 'pa', emoji: '🩺', label: 'Presión arterial', unit: 'mmHg', demo: '118/76', watch: '116/74', hint: 'Ideal < 130/80', lo: 90, hi: 130 },
  { id: 'spo2', emoji: '💨', label: 'SpO2', unit: '%', demo: '98', watch: '98', hint: 'Meta ≥ 95%', lo: 95, hi: 100 },
  { id: 'glu', emoji: '🩸', label: 'Glucosa', unit: 'mg/dL', demo: '97', watch: '95', hint: 'Ayunas 70–99', lo: 70, hi: 99 },
  { id: 'peso', emoji: '⚖️', label: 'Peso', unit: 'kg', demo: '87.8', watch: '87.8', hint: 'Tendencia > cifra', lo: 50, hi: 140 },
  { id: 'temp', emoji: '🌡️', label: 'Temperatura', unit: '°C', demo: '36.6', watch: '36.5', hint: '36.1–37.2', lo: 36, hi: 37.2 },
] as const

export const TODAY_PLAN = [
  { id: 'des', emoji: '🌅', title: 'Desayuno', kcal: 380, items: 'Avena · frutos rojos · claras' },
  { id: 'alm', emoji: '☀️', title: 'Almuerzo', kcal: 620, items: 'Pollo · arroz integral · ensalada' },
  { id: 'mer', emoji: '🍎', title: 'Merienda', kcal: 200, items: 'Manzana · almendras' },
  { id: 'cen', emoji: '🌙', title: 'Cena', kcal: 450, items: 'Lentejas · pan integral' },
]

export const HEALTH_PILLARS = [
  { label: 'Adherencia', pct: 88, color: 'var(--teal)' },
  { label: 'Evolución clínica', pct: 82, color: 'var(--blue)' },
  { label: 'Nutrición', pct: 84, color: 'var(--org)' },
  { label: 'Bienestar psi.', pct: 79, color: 'var(--pur)' },
  { label: 'Actividad física', pct: 91, color: 'var(--ice-d)' },
]

export const HEALTH_TREND = [
  { w: 6, v: 72 },
  { w: 7, v: 74 },
  { w: 8, v: 77 },
  { w: 9, v: 79 },
  { w: 10, v: 81 },
  { w: 11, v: 83 },
  { w: 12, v: 86 },
]

export const TRANSFORM_ROWS = [
  { label: '⚖️ Peso', base: '92 kg', cur: '87.8', delta: '↓ 4.2 kg' },
  { label: '📊 IMC', base: '31.2', cur: '29.8', delta: '↓ 1.4' },
  { label: '📉 % Grasa', base: '34%', cur: '31.8%', delta: '↓ 2.2%' },
  { label: '📏 Cintura', base: '104 cm', cur: '98 cm', delta: '↓ 6 cm' },
  { label: '🩸 Glucosa', base: '112 mg', cur: '97 mg', delta: '↓ 15 mg' },
  { label: '🥗 Adherencia', base: '52%', cur: '84%', delta: '↑ 32%' },
]

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

export const BARRIER_REPLY: Record<string, string> = {
  antojos: 'Vamos a agregar snacks estratégicos para manejar los antojos.',
  tiempo: 'Ajustaré opciones de 15 min para los días apurados.',
  menu: 'Tu nutricionista recibirá el feedback y ajustará el menú.',
  emocional: 'Voy a notificar a tu psicóloga para acompañarte esta semana.',
  comprension: 'Simplificaré el plan y dejaré guías visuales en Academia.',
  ninguno: 'Excelente. Sigamos construyendo sobre lo que ya estás logrando.',
}

export const NB_WEEK_SEED = [true, true, true, true, false, true, false]

export const LONGEST_STREAK = 27
export const HEALTH_SCORE = 86
export const TRANSFORM_SCORE = 87
export const NEXT_CHEST_DAYS = 50

import type { ProgramTaskId } from '../types'

export const PROGRAM_WEEKS = 83

export const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

export const PROGRAM_TASKS: {
  id: ProgramTaskId
  title: string
  short: string
  pts: number
  tone: 'pur' | 'red' | 'teal' | 'blue' | 'org' | 'indigo'
  hint: string
}[] = [
  {
    id: 'podcast',
    title: 'Escuchar podcast',
    short: 'Episodio del día · 8 min',
    pts: 80,
    tone: 'pur',
    hint: 'Audio educativo del protocolo',
  },
  {
    id: 'vitals',
    title: 'Medir signos vitales',
    short: 'FC · Presión · SpO2 · Glucosa',
    pts: 120,
    tone: 'red',
    hint: 'Registra tus métricas de hoy',
  },
  {
    id: 'nut',
    title: 'Cumplir plan nutricional',
    short: 'Adherencia del día',
    pts: 150,
    tone: 'teal',
    hint: 'Sigue el menú y registra comidas',
  },
  {
    id: 'ejercicio',
    title: 'Hacer ejercicio del día',
    short: 'Circuito de 12 minutos',
    pts: 150,
    tone: 'blue',
    hint: 'Movimiento guiado de la semana',
  },
  {
    id: 'nutribiotico',
    title: 'Tomar nutribiótico',
    short: 'Dosis diaria',
    pts: 80,
    tone: 'org',
    hint: 'Confirma tu toma de hoy',
  },
  {
    id: 'emocional',
    title: 'Evaluación emocional',
    short: 'Ánimo · energía · estrés',
    pts: 120,
    tone: 'indigo',
    hint: 'Check-in de 30 segundos',
  },
]

export const PROGRAM_POINTS_MAX = PROGRAM_TASKS.reduce((sum, t) => sum + t.pts, 0)

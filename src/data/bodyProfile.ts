/**
 * Visualización del perfil — datos demo del cuerpo del paciente.
 *
 * Sin backend: las cifras son coherentes entre sí y con el resto de la demo
 * (peso 74.5 kg y talla 1.68 m dan el IMC 26.4 que muestra `metrics.ts`; la
 * glucosa 95 mg/dL es la del último laboratorio de la historia clínica).
 *
 * Las cadenas visibles son claves i18n: deben existir en es.json (identidad)
 * y en.json (traducción). Se traducen al renderizar, nunca aquí.
 */

/** Tramo de la escala de referencia de un índice (barra bajo el valor). */
export interface BodyBand {
  /** Límite superior del tramo, en la unidad del índice. */
  to: number
  label: string
  tone: BodyTone
}

export type BodyTone = 'ok' | 'warn' | 'risk'

export interface BodyIndex {
  id: 'imc' | 'fat' | 'glucose'
  label: string
  /** Valor formateado tal cual se muestra. */
  value: string
  /** Valor numérico, para posicionar el marcador en la escala. */
  raw: number
  unit: string
  qualifier: string
  tone: BodyTone
  color: string
  /** Qué significa el número, en una frase. */
  detail: string
  /** Meta clínica del programa. */
  target: string
  scale: { min: number; max: number; bands: BodyBand[] }
  /** Punto del cuerpo al que apunta, en % del alto y ancho de la figura. */
  spot: { x: number; y: number }
  /** Lado hacia el que sale la línea guía del marcador. */
  side: 'left' | 'right'
}

export interface BodyMeasure {
  id: string
  label: string
  value: string
  unit: string
  /** Cambio contra la medición anterior; vacío si no aplica. */
  delta: string
  /** Sube o baja respecto a la medición anterior (tono del cambio). */
  trend: 'down' | 'up' | 'flat'
  /** Si el cambio va en la dirección deseada por el plan. */
  good: boolean
  note: string
}

/** Índices que se leen sobre la figura. */
export const BODY_INDICES: BodyIndex[] = [
  {
    id: 'imc',
    label: 'IMC',
    value: '26.4',
    raw: 26.4,
    unit: 'kg/m²',
    qualifier: 'Sobrepeso',
    tone: 'warn',
    color: 'var(--org)',
    detail: 'Relación entre tu peso y tu talla. Bajó 1.2 puntos desde el inicio del protocolo.',
    target: 'Meta ≤ 25.0',
    scale: {
      min: 15,
      max: 40,
      bands: [
        { to: 18.5, label: 'Bajo', tone: 'warn' },
        { to: 25, label: 'Normal', tone: 'ok' },
        { to: 30, label: 'Sobrepeso', tone: 'warn' },
        { to: 40, label: 'Obesidad', tone: 'risk' },
      ],
    },
    spot: { x: 50, y: 41 },
    side: 'right',
  },
  {
    id: 'fat',
    label: '% de grasa',
    value: '26.4',
    raw: 26.4,
    unit: '%',
    qualifier: 'Sobre el rango',
    tone: 'warn',
    color: 'var(--brand-green)',
    detail: 'Grasa corporal estimada por el método Deurenberg con tu índice cintura-cadera.',
    target: 'Meta ≤ 24%',
    scale: {
      min: 10,
      max: 45,
      bands: [
        { to: 21, label: 'Atlética', tone: 'ok' },
        { to: 24, label: 'Saludable', tone: 'ok' },
        { to: 32, label: 'Elevada', tone: 'warn' },
        { to: 45, label: 'Muy alta', tone: 'risk' },
      ],
    },
    spot: { x: 50, y: 52 },
    side: 'left',
  },
  {
    id: 'glucose',
    label: 'Glucosa',
    value: '95',
    raw: 95,
    unit: 'mg/dL',
    qualifier: 'En rango',
    tone: 'ok',
    color: 'var(--red)',
    detail: 'Glucosa en ayunas del último laboratorio. Está en rango, cerca del umbral de prediabetes.',
    target: 'Meta < 100 mg/dL',
    scale: {
      min: 60,
      max: 160,
      bands: [
        { to: 70, label: 'Baja', tone: 'warn' },
        { to: 100, label: 'Normal', tone: 'ok' },
        { to: 126, label: 'Prediabetes', tone: 'warn' },
        { to: 160, label: 'Diabetes', tone: 'risk' },
      ],
    },
    spot: { x: 26, y: 34 },
    side: 'left',
  },
]

/** Mediciones antropométricas de la última consulta. */
export const BODY_MEASURES: BodyMeasure[] = [
  {
    id: 'weight',
    label: 'Peso',
    value: '74.5',
    unit: 'kg',
    delta: '3.2 kg',
    trend: 'down',
    good: true,
    note: 'Meta del ciclo: 70.0 kg',
  },
  {
    id: 'height',
    label: 'Talla',
    value: '1.68',
    unit: 'm',
    delta: '',
    trend: 'flat',
    good: true,
    note: 'Medida sin calzado',
  },
  {
    id: 'waist',
    label: 'Cintura',
    value: '88',
    unit: 'cm',
    delta: '4 cm',
    trend: 'down',
    good: true,
    note: 'Riesgo cardiometabólico desde 88 cm',
  },
  {
    id: 'hip',
    label: 'Cadera',
    value: '104',
    unit: 'cm',
    delta: '2 cm',
    trend: 'down',
    good: true,
    note: 'Base del índice cintura-cadera',
  },
  {
    id: 'wrist',
    label: 'Muñeca',
    value: '16.5',
    unit: 'cm',
    delta: '',
    trend: 'flat',
    good: true,
    note: 'Define tu complexión ósea',
  },
]

/** Lecturas derivadas de las mediciones, para el pie de la lista. */
export const BODY_DERIVED = [
  { id: 'icc', label: 'Índice cintura-cadera', value: '0.85', note: 'Riesgo moderado' },
  { id: 'frame', label: 'Complexión ósea', value: 'Mediana', note: 'Talla ÷ muñeca = 10.2' },
]

export const BODY_FOOTNOTE =
  'Mediciones tomadas en consulta el 05/08/2026. El % de grasa es un estimado calculado con fórmulas validadas y no reemplaza una bioimpedancia clínica.'

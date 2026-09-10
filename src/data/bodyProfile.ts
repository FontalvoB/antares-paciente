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

/** Vista de la figura anatómica. */
export type BodyView = 'front' | 'back'

/**
 * Identificadores de región de `react-muscle-highlighter`. Se tipan aquí
 * para no arrastrar esa dependencia al resto de la app.
 */
export type BodyRegion =
  | 'abs'
  | 'adductors'
  | 'ankles'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'deltoids'
  | 'feet'
  | 'forearm'
  | 'gluteal'
  | 'hamstring'
  | 'hands'
  | 'hair'
  | 'head'
  | 'knees'
  | 'lower-back'
  | 'neck'
  | 'obliques'
  | 'quadriceps'
  | 'tibialis'
  | 'trapezius'
  | 'triceps'
  | 'upper-back'

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
  /** Hex para pintar el SVG (las CSS vars no atraviesan el fill del path). */
  color: string
  /** Tinte suave del mismo color, para el mapa cuando el índice no está activo. */
  colorSoft: string
  /** Qué significa el número, en una frase. */
  detail: string
  /** Meta clínica del programa. */
  target: string
  scale: { min: number; max: number; bands: BodyBand[] }
  /** Zonas anatómicas que representan este índice, por vista. */
  regions: Record<BodyView, BodyRegion[]>
  /** Nombre de la zona, para la leyenda bajo la figura. */
  zone: string
  /** Vista en la que la zona se lee mejor. */
  preferredView: BodyView
  /** Altura de la etiqueta, en % de la figura, por vista. */
  tag: Record<BodyView, { y: number; side: 'left' | 'right' }>
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
  color: string
  colorSoft: string
  regions: Record<BodyView, BodyRegion[]>
  zone: string
  preferredView: BodyView
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
    color: '#d97824',
    colorSoft: '#f4d7b5',
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
    regions: {
      front: ['abs', 'obliques'],
      back: ['lower-back'],
    },
    zone: 'Abdomen y cintura',
    preferredView: 'front',
    tag: {
      front: { y: 42, side: 'right' },
      back: { y: 44, side: 'right' },
    },
  },
  {
    id: 'fat',
    label: '% de grasa',
    value: '26.4',
    raw: 26.4,
    unit: '%',
    qualifier: 'Sobre el rango',
    tone: 'warn',
    color: '#035d4d',
    colorSoft: '#b9d4ce',
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
    regions: {
      front: ['chest', 'adductors'],
      back: ['gluteal'],
    },
    zone: 'Tronco y caderas',
    preferredView: 'front',
    tag: {
      front: { y: 54, side: 'left' },
      back: { y: 56, side: 'left' },
    },
  },
  {
    id: 'glucose',
    label: 'Glucosa',
    value: '95',
    raw: 95,
    unit: 'mg/dL',
    qualifier: 'En rango',
    tone: 'ok',
    color: '#d9534f',
    colorSoft: '#f3c5c3',
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
    regions: {
      front: ['forearm', 'hands'],
      back: ['forearm', 'hands'],
    },
    zone: 'Antebrazo · sitio de medición',
    preferredView: 'front',
    tag: {
      front: { y: 34, side: 'left' },
      back: { y: 34, side: 'left' },
    },
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
    color: '#142855',
    colorSoft: '#c5cde0',
    regions: {
      front: ['abs', 'chest', 'quadriceps'],
      back: ['gluteal', 'upper-back', 'hamstring'],
    },
    zone: 'Masa corporal',
    preferredView: 'front',
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
    color: '#5581a2',
    colorSoft: '#c5d5e2',
    regions: {
      front: ['head', 'neck', 'quadriceps', 'calves', 'feet'],
      back: ['head', 'neck', 'hamstring', 'calves', 'feet'],
    },
    zone: 'Estatura completa',
    preferredView: 'front',
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
    color: '#0c4c6b',
    colorSoft: '#b7cddd',
    regions: {
      front: ['abs', 'obliques'],
      back: ['lower-back'],
    },
    zone: 'Cintura',
    preferredView: 'front',
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
    color: '#6d4fa8',
    colorSoft: '#d9ccec',
    regions: {
      front: ['adductors'],
      back: ['gluteal'],
    },
    zone: 'Cadera',
    preferredView: 'back',
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
    color: '#3d7b72',
    colorSoft: '#c5ddd9',
    regions: {
      front: ['hands', 'forearm'],
      back: ['hands', 'forearm'],
    },
    zone: 'Muñeca y antebrazo',
    preferredView: 'front',
  },
]

/** Tocar una región de la figura selecciona el índice clínico asociado. */
export const REGION_SELECT: Partial<Record<BodyRegion, string>> = {
  abs: 'imc',
  obliques: 'imc',
  'lower-back': 'imc',
  chest: 'fat',
  adductors: 'fat',
  gluteal: 'fat',
  forearm: 'glucose',
  hands: 'glucose',
}

export function bodySelection(id: string) {
  const index = BODY_INDICES.find((i) => i.id === id)
  if (index) return { kind: 'index' as const, item: index }
  const measure = BODY_MEASURES.find((m) => m.id === id)
  if (measure) return { kind: 'measure' as const, item: measure }
  return { kind: 'index' as const, item: BODY_INDICES[0] }
}

/** Lecturas derivadas de las mediciones, para el pie de la lista. */
export const BODY_DERIVED = [
  { id: 'icc', label: 'Índice cintura-cadera', value: '0.85', note: 'Riesgo moderado' },
  { id: 'frame', label: 'Complexión ósea', value: 'Mediana', note: 'Talla ÷ muñeca = 10.2' },
]

export const BODY_FOOTNOTE =
  'Mediciones tomadas en consulta el 05/08/2026. El % de grasa es un estimado calculado con fórmulas validadas y no reemplaza una bioimpedancia clínica.'

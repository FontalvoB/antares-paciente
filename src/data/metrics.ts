export type MetricId = 'imc' | 'hba1c' | 'fat' | 'adh' | 'pts'

export interface MetricSample {
  iso: string
  value: number
  note: string
}

export interface MetricDef {
  id: MetricId
  label: string
  unit: string
  color: string
  current: string
  sub: string
  target: string
  direction: 'down' | 'up'
  decimals: number
  history: MetricSample[]
}

export const HEALTH_METRICS: MetricDef[] = [
  {
    id: 'imc',
    label: 'IMC',
    unit: '',
    color: 'var(--teal)',
    current: '26.4',
    sub: '−1.2 este mes',
    target: '≤ 25.0',
    direction: 'down',
    decimals: 1,
    history: [
      { iso: '2026-03-12', value: 27.8, note: 'Línea base del protocolo' },
      { iso: '2026-04-09', value: 27.6, note: 'Primer control mensual' },
      { iso: '2026-05-01', value: 27.6, note: 'Estabilización inicial' },
      { iso: '2026-05-22', value: 27.2, note: 'Tras ajuste de proteínas' },
      { iso: '2026-06-01', value: 27.0, note: 'Control de nutrición' },
      { iso: '2026-06-19', value: 26.8, note: 'Semana 8' },
      { iso: '2026-07-10', value: 26.6, note: 'Tendencia sostenida' },
      { iso: '2026-08-05', value: 26.4, note: 'Control semana 12' },
    ],
  },
  {
    id: 'hba1c',
    label: 'HbA1c',
    unit: '%',
    color: 'var(--blue)',
    current: '5.9%',
    sub: 'Mejorando',
    target: '< 5.7%',
    direction: 'down',
    decimals: 1,
    history: [
      { iso: '2026-02-18', value: 6.4, note: 'Diagnóstico de prediabetes' },
      { iso: '2026-03-12', value: 6.3, note: 'Inicio COPP-ADRESD' },
      { iso: '2026-04-16', value: 6.2, note: 'Lab trimestral' },
      { iso: '2026-05-21', value: 6.1, note: 'Mejora con plan mediterráneo' },
      { iso: '2026-06-25', value: 6.0, note: 'Quest Diagnostics' },
      { iso: '2026-08-05', value: 5.9, note: 'Control semana 12' },
    ],
  },
  {
    id: 'fat',
    label: '% de grasa',
    unit: '%',
    color: 'var(--teal)',
    current: '26.4',
    sub: '−1.2 este mes',
    target: '≤ 24%',
    direction: 'down',
    decimals: 1,
    history: [
      { iso: '2026-03-12', value: 28.4, note: 'Bioimpedancia inicial' },
      { iso: '2026-04-09', value: 28.1, note: 'Primera reevaluación' },
      { iso: '2026-05-07', value: 27.6, note: 'Circuito de 12 min diario' },
      { iso: '2026-06-04', value: 27.1, note: 'Composición corporal' },
      { iso: '2026-07-02', value: 26.8, note: 'Mes 4' },
      { iso: '2026-07-24', value: 26.8, note: 'Meseta breve' },
      { iso: '2026-08-05', value: 26.4, note: 'Retoma de tendencia' },
    ],
  },
  {
    id: 'adh',
    label: 'Adherencia',
    unit: '%',
    color: 'var(--cyan)',
    current: '88%',
    sub: 'Esta semana',
    target: '≥ 85%',
    direction: 'up',
    decimals: 0,
    history: [
      { iso: '2026-05-11', value: 52, note: 'Semana 1 · arranque' },
      { iso: '2026-05-25', value: 61, note: 'Semana 3' },
      { iso: '2026-06-08', value: 67, note: 'Semana 5' },
      { iso: '2026-06-22', value: 74, note: 'Semana 7' },
      { iso: '2026-07-06', value: 81, note: 'Semana 9' },
      { iso: '2026-07-20', value: 84, note: 'Semana 11' },
      { iso: '2026-08-03', value: 88, note: 'Semana 12 · actual' },
    ],
  },
  {
    id: 'pts',
    label: 'Puntos',
    unit: 'XP',
    color: 'var(--org)',
    current: '',
    sub: 'Hoy',
    target: 'Nivel 6 · 8,000 XP',
    direction: 'up',
    decimals: 0,
    history: [
      { iso: '2026-05-11', value: 420, note: 'Semana 1' },
      { iso: '2026-05-25', value: 980, note: 'Semana 3' },
      { iso: '2026-06-08', value: 1640, note: 'Semana 5' },
      { iso: '2026-06-22', value: 2410, note: 'Semana 7' },
      { iso: '2026-07-06', value: 3180, note: 'Semana 9' },
      { iso: '2026-07-20', value: 4010, note: 'Semana 11' },
      { iso: '2026-08-03', value: 4820, note: 'Semana 12 · acumulado' },
    ],
  },
]

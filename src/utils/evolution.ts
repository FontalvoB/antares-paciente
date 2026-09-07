/**
 * Resolvers puros de estado de la vista Evo (rework anti-datos fabricados).
 *
 * - resolveEvolutionViewState: estado global de la pestaña (loading / error /
 *   empty / data) + los números REALES de salud. Sin cache + error →
 *   'error' (la UI muestra retry, patrón RankingView). Los datos en cache
 *   viejos GANAN sobre un refetch fallido (TanStack los conserva y son más
 *   verdaderos que una pantalla de error). `previousHealthScore: null`
 *   significa "sin fila previa" → la UI OCULTA los KPIs Anterior/Cambio
 *   (nunca se inyecta un 81 fijo).
 *
 * - resolveHistoryViewState: estado de la trend card sobre el historico real
 *   (GET /api/v1/program/me/scores-history). <2 puntos O error (incl. 404 de
 *   backend sin desplegar) → 'empty' honesto, nunca error wall. Cache previo
 *   con ≥2 puntos gana sobre el error.
 *
 * - resolveTransformRows: filas de transformación REALES del detail (las
 *   entradas del backend NO traen nombre — la key del mapa ES el código de
 *   métrica). Labels desde METRIC_LABELS; código desconocido → render raw.
 *
 * - resolveWatchCard: card "Índice de grasa" SOLO con indicador real de %
 *   grasa + `delta_pct` computado por el backend (wire snake_case, ver
 *   TransformationDetailDto). Sin esos datos → null (card oculta).
 *
 * Sin dependencias de UI para poder testearlos sin montar componentes.
 */

import type {
  ScoresHistoryPointDto,
  ScoresResponseDto,
  TransformationDetailDto,
} from '../services/program/types'
import { formatTransformDelta, type TransformDeltaView } from './formatTransformDelta'

export type EvolutionViewState = 'loading' | 'error' | 'empty' | 'data'

export interface EvolutionViewData {
  state: 'data'
  /** Health Score real (null sin payload → el hero no fabrica número). */
  healthScore: number | null
  /** Score previo real; null → ocultar KPIs Anterior/Cambio (nunca 81 fijo). */
  previousHealthScore: number | null
}

export type EvolutionViewResolution =
  | EvolutionViewData
  | { state: 'loading' | 'error' | 'empty' }

export function resolveEvolutionViewState({
  isLoading,
  isError,
  scores,
}: {
  isLoading: boolean
  isError: boolean
  scores: ScoresResponseDto | undefined
}): EvolutionViewResolution {
  if (scores) {
    const health = scores.health_score ?? scores.healthScore
    return {
      state: 'data',
      healthScore: health?.current ?? health?.score ?? null,
      previousHealthScore: health?.previous ?? null,
    }
  }
  if (isLoading) return { state: 'loading' }
  if (isError) return { state: 'error' }
  return { state: 'empty' }
}

export type HistoryViewState = 'loading' | 'empty' | 'data'

export function resolveHistoryViewState({
  isLoading,
  isError,
  points,
}: {
  isLoading: boolean
  isError: boolean
  points: ScoresHistoryPointDto[] | undefined
}): HistoryViewState {
  if (points && points.length >= 2) return 'data'
  if (points && points.length < 2) return 'empty'
  if (isLoading) return 'loading'
  // 404 (backend sin desplegar) / network / 5xx sin cache → empty honesto.
  if (isError) return 'empty'
  return 'loading'
}

// ---------------------------------------------------------------------------
// Métricas clínicas del detail de transformation_score (Evo tab rework)
// ---------------------------------------------------------------------------

/**
 * Códigos REALES del catálogo `measurement_metrics` del backend
 * (ClinicalMeasurementsSeeder) — la VERDAD: cualquier línea base clínica usa
 * uno de estos códigos como key del detail. Los valores son identity keys de
 * i18n (se pasan a `t()`); el display final lo resuelve el diccionario.
 * Códigos desconocidos/futuros → render raw (nunca un nombre inventado).
 */
export const METRIC_LABELS: Record<string, string> = {
  weight: 'Peso',
  glucose_fasting: 'Glucosa',
  hba1c: 'HbA1c',
  body_fat: 'Índice de grasa',
  systolic_bp: 'Presión sistólica',
  diastolic_bp: 'Presión diastólica',
  bmi: 'IMC',
  height: 'Talla',
  heart_rate: 'Frecuencia cardíaca',
  waist: 'Cintura',
  hip: 'Cadera',
  wrist: 'Muñeca',
  o2_saturation: 'Saturación de oxígeno',
  temperature_c: 'Temperatura corporal',
}

/** Label i18n de un código de métrica; códigos desconocidos → raw code. */
export function metricLabel(metricCode: string): string {
  return METRIC_LABELS[metricCode] ?? metricCode
}

/** Códigos canónicos de % grasa corporal; `grasa` queda como alias defensivo
 *  por si algún payload histórico la emite localizada. */
const BODY_FAT_KEYS = ['body_fat', 'grasa'] as const

export interface WatchCardView {
  /** Delta firmado de % grasa esta semana, ej. "−1.2" / "+1.2". */
  delta: string
}

/**
 * Card "Índice de grasa": SOLO con un indicador real de % grasa en el detail
 * actual + `delta_pct` computado por el backend. Sin esos datos → null y la
 * UI NO renderiza la card (nunca texto fabricado).
 */
export function resolveWatchCard(
  detail: Record<string, TransformationDetailDto> | null | undefined,
): WatchCardView | null {
  if (!detail) return null
  const bodyFat = BODY_FAT_KEYS.map((k) => detail[k]).find((e) => e != null)
  if (!bodyFat || bodyFat.delta_pct == null) return null
  const pct = bodyFat.delta_pct
  const delta =
    bodyFat.favorable === true
      ? `−${Math.abs(pct)}`
      : bodyFat.favorable === false
        ? `+${Math.abs(pct)}`
        : `${pct > 0 ? '+' : ''}${pct}`
  return { delta }
}

export interface TransformRowView {
  metricCode: string
  label: string
  base: string
  cur: string
  delta: TransformDeltaView
}

/**
 * Filas de transformación REALES desde el detail (entradas SIN nombre: la key
 * ES el código de métrica). Sin detail (o vacío) → null → la UI degrada a
 * requires-data, jamás filas fabricadas.
 */
export function resolveTransformRows(
  detail: Record<string, TransformationDetailDto> | null | undefined,
): TransformRowView[] | null {
  if (!detail || Object.keys(detail).length === 0) return null
  return Object.entries(detail).map(([metricCode, d]) => ({
    metricCode,
    label: metricLabel(metricCode),
    base: `${d.baseline} ${d.unit}`.trim(),
    cur: `${d.current} ${d.unit}`.trim(),
    delta: formatTransformDelta({ delta: d.delta, unit: d.unit, favorable: d.favorable }),
  }))
}
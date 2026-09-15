/**
 * Metrics-history service — GET /api/v1/program/me/metrics-history
 *
 * Historial de métricas clínicas del paciente (tarjetas del Home). Contrato
 * FROZEN (MetricsHistoryDtos.cs): `{ heightCm, metrics: [{ code, unit,
 * target: {lo,hi}|null, favorableDirection: 'down'|'up'|null, points:
 * [{date,value}] }] }` — SOLO códigos CON filas aparecen; fechas ASC. Puede
 * 404 NO_ACTIVE_ENROLLMENT en backends sin desplegar.
 *
 * Códigos solicitados: los defaults del backend (bmi,hba1c,body_fat) MÁS
 * `weight`, un código válido del catálogo sembrado (ClinicalMeasurementsSeeder)
 * que la whitelist acepta — habilita el fallback cliente de IMC
 * (peso/(talla/100)²) cuando el backend no devuelve la serie `bmi`.
 *
 * Defensivo, igual que scores-history: el 404 viaja como ApiError — el
 * consumidor (HomePage) degrada a requires-data honesto, nunca a una pared de
 * error. No toasts, no mock fallback (R5.2).
 */

import type { MetricsHistoryDto } from './types'
import { apiFetch } from '../../utils/apiClient'
import type { ApiFetchOptions } from '../../utils/apiClient'

export function recordWeight(weightKg: number, date: string): Promise<{ id: string; weightKg: number; date: string; observedAt: string }> {
  return apiFetch('/api/v1/program/me/weight', { method: 'POST', body: { weightKg, date } })
}

const METRICS_HISTORY_PATH = '/api/v1/program/me/metrics-history'
export const METRICS_HISTORY_DAYS = 180
/** bmi,hba1c,body_fat (defaults del backend) + weight para el fallback cliente de IMC. */
export const METRICS_HISTORY_CODES = ['bmi', 'hba1c', 'body_fat', 'weight'] as const

/**
 * Fetch the persisted clinical metric series for the authenticated patient.
 *
 * @param codes — códigos de métrica pedidos (default: bmi,hba1c,body_fat,weight).
 * @param days — ventana pedida al backend (default 180, contrato).
 * @returns The typed metrics-history DTO (heightCm + métricas con filas, ASC).
 * @throws ApiError — propagado, nunca tragado (R1.4, R7.4). 404
 *          NO_ACTIVE_ENROLLMENT viaja como ApiError con `code`.
 */
export function getMetricsHistory(
  codes: readonly string[] = METRICS_HISTORY_CODES,
  days = METRICS_HISTORY_DAYS,
  options: Pick<ApiFetchOptions, 'cache'> = {},
): Promise<MetricsHistoryDto> {
  return apiFetch<MetricsHistoryDto>(
    `${METRICS_HISTORY_PATH}?codes=${encodeURIComponent(codes.join(','))}&days=${days}`,
    { ...options, method: 'GET' },
  )
}

/**
 * Scores-history service — GET /api/v1/program/me/scores-history?weeks=12
 *
 * Historico de puntajes semanales del paciente (tab Evo). Contrato FROZEN:
 * `{ points: [{ weekNumber, periodStart, periodEnd, healthScore,
 * healthPrevious, transformationScore }] }` — ASC por weekNumber, SOLO
 * semanas persistidas (puede ser sparse/corta). 404 `NO_ACTIVE_ENROLLMENT`
 * sin inscripcion activa.
 *
 * Defensivo: el endpoint puede 404 en backends aun sin desplegar. El 404
 * (con o sin code) propaga como ApiError — el consumidor (trend card) lo
 * degrada a estado vacio honesto, nunca a una pared de error.
 *
 * Routes through apiFetch (Bearer, refresh single-flight, RFC 7807 →
 * ApiError). No toasts, no mock fallback (R5.2).
 */

import type { ScoresHistoryDto } from './types'
import { apiFetch } from '../../utils/apiClient'

const SCORES_HISTORY_PATH = '/api/v1/program/me/scores-history'
export const SCORES_HISTORY_WEEKS = 12

/**
 * Fetch the persisted weekly scores for the authenticated patient.
 *
 * @param weeks — ventana de semanas pedida al backend (default 12, contrato).
 * @returns The typed scores-history DTO (points ASC by weekNumber).
 * @throws ApiError — propagado, nunca tragado (R1.4, R7.4). 404
 *          NO_ACTIVE_ENROLLMENT viaja como ApiError con `code`.
 */
export function getScoresHistory(weeks = SCORES_HISTORY_WEEKS): Promise<ScoresHistoryDto> {
  return apiFetch<ScoresHistoryDto>(
    `${SCORES_HISTORY_PATH}?weeks=${weeks}`,
    { method: 'GET' },
  )
}
/**
 * League service — GET /api/v1/program/me/league + PUT /api/v1/program/me/league-preferences
 *
 * LEAGUE v1 (contrato camelCase, ver LeagueDtos.cs). Privacidad por diseño:
 * la respuesta nunca contiene id/nombre/ciudad de otros participantes, solo
 * nicknames o códigos anónimos; `isMe` lo resuelve el backend contra el JWT.
 *
 * Routes through apiFetch (Bearer, refresh single-flight, RFC 7807 → ApiError).
 * 404 NO_ACTIVE_ENROLLMENT (sin inscripción activa) y 400 (validación del
 * nickname, p.ej. "Ese apodo no está disponible.") propagan como ApiError —
 * nunca se tragan.
 */

import type {
  LeaguePreferencesDto,
  LeaguePreferencesInput,
  LeagueResponseDto,
} from './types'
import { apiFetch } from '../../utils/apiClient'

/**
 * GET /api/v1/program/me/league — cohorte + bloque propio + 4 categorías.
 * @throws ApiError (404 NO_ACTIVE_ENROLLMENT, network/5xx).
 */
export function getLeague(): Promise<LeagueResponseDto> {
  return apiFetch<LeagueResponseDto>('/api/v1/program/me/league', {
    method: 'GET',
  })
}

/**
 * PUT /api/v1/program/me/league-preferences — guarda opt-in + nickname.
 * `nickname: null` SIEMPRE limpia el almacenado (sin semántica de preserve).
 * @throws ApiError (400 con el mensaje de validación del backend).
 */
export function updateLeaguePreferences(
  input: LeaguePreferencesInput,
): Promise<LeaguePreferencesDto> {
  return apiFetch<LeaguePreferencesDto>('/api/v1/program/me/league-preferences', {
    method: 'PUT',
    body: input,
  })
}
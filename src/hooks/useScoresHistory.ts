/**
 * useScoresHistory — trend card data hook (Evo tab rework).
 *
 * Wraps TanStack Query around `getScoresHistory()` (GET
 * /api/v1/program/me/scores-history?weeks=12, contrato FROZEN). staleTime
 * 5 min: la serie semanal no cambia en segundos.
 *
 * Error contract (R5.2, patrón de useProgramScores): NUNCA toast en un
 * query; TanStack conserva el cache previo en un refetch fallido; sin cache
 * el query queda en isError y la UI muestra estados honestos. NO hay mock
 * fallback: el endpoint puede 404 en backends sin desplegar — el consumidor
 * degrada cualquier error a un estado vacío honesto ("Aún no hay suficientes
 * semanas…"), nunca a una pared de error.
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getScoresHistory } from '../services/program/scores-history-service'
import { programKeys } from './queryKeys'
import { ApiError } from '../utils/apiClient'
import type { ScoresHistoryDto } from '../services/program/types'

export type UseScoresHistoryResult = UseQueryResult<ScoresHistoryDto, ApiError> & {
  /** Historico de semanas persistidas; undefined mientras carga o en error sin cache. */
  history: ScoresHistoryDto | undefined
}

export function useScoresHistory(): UseScoresHistoryResult {
  const query = useQuery<ScoresHistoryDto, ApiError>({
    queryKey: programKeys.scoresHistory,
    queryFn: () => getScoresHistory(),
    staleTime: 5 * 60 * 1000,
  })

  return {
    ...query,
    history: query.data,
  }
}
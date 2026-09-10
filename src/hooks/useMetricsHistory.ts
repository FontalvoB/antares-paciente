/**
 * useMetricsHistory — Home metric cards data hook.
 *
 * Wraps TanStack Query around `getMetricsHistory()` (GET
 * /api/v1/program/me/metrics-history?codes=bmi,hba1c,body_fat,weight&days=180,
 * contrato FROZEN). staleTime 5 min: el historial clínico cambia en días, no
 * en segundos.
 *
 * Error contract (R5.2, patrón de useScoresHistory): NUNCA toast en un query;
 * TanStack conserva el cache previo en un refetch fallido; sin cache el query
 * queda en isError y la UI muestra estados honestos (requires-data). NO hay
 * mock fallback: el endpoint puede 404 en backends sin desplegar — el
 * consumidor degrada cualquier error a requires-data honesto, nunca a una
 * pared de error.
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getMetricsHistory } from '../services/program/metrics-history-service'
import { programKeys } from './queryKeys'
import { ApiError } from '../utils/apiClient'
import type { MetricsHistoryDto } from '../services/program/types'

export type UseMetricsHistoryResult = UseQueryResult<MetricsHistoryDto, ApiError> & {
  /** DTO del historial; undefined mientras carga o en error sin cache. */
  history: MetricsHistoryDto | undefined
}

export function useMetricsHistory(): UseMetricsHistoryResult {
  const query = useQuery<MetricsHistoryDto, ApiError>({
    queryKey: programKeys.metricsHistory,
    queryFn: () => getMetricsHistory(),
    staleTime: 5 * 60 * 1000,
  })

  return {
    ...query,
    history: query.data,
  }
}

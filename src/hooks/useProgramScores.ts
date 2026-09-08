/**
 * useProgramScores — EvolutionView data hook (SPEC R2.5 / R5.2, task 3.5).
 *
 * Wraps TanStack Query around `getScores()`. The query function resolves to a
 * `ScoresResult` that already carries the two header-derived freshness flags
 * (`stale`, `recalculated`) from the backend (SPEC §R2.5, Gate G3).
 *
 * Freshness contract (G3):
 *  - `stale` / `recalculated` come ONLY from response headers
 *    (`X-Score-Stale` / `X-Score-Recalculated`) via the service layer.
 *  - NO `calculatedAt` field is invented here or anywhere in the mobile client.
 *
 * Error contract (R5.2):
 *  - Eligible errors (network / 5xx) never surface a toast in a query.
 *  - TanStack Query retains the previous successful payload as `data` on a
 *    failed refetch, so a stale cache is automatically reused.
 *  - When there is NO prior cache and the request fails, `scores` is
 *    `undefined` and `isError` is `true` — the view renders honest states
 *    (loading skeleton / error with retry / empty). The old mock fallback
 *    (which fabricated a zeroed payload) was REMOVED in the Evo tab rework;
 *    no mock ever substitutes real data again.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getScores, type ScoresResult } from '../services/program/scores-service'
import { programKeys } from './queryKeys'
import type { ScoresResponseDto } from '../services/program/types'

export type UseProgramScoresResult = UseQueryResult<ScoresResult> & {
  /** The scores payload; undefined while loading or on error without cache. */
  scores: ScoresResponseDto | undefined
  /** Server freshness: scores are stale (header `X-Score-Stale`). Header-derived only (G3). */
  stale: boolean
  /** Server freshness: scores were recalculated (header `X-Score-Recalculated`). Header-derived only (G3). */
  recalculated: boolean
}

/**
 * Query hook feeding `EvolutionView` with the program scores plus freshness.
 *
 * @returns Query state extended with `scores`, `stale`, `recalculated`.
 *          `isLoading` / `isError` / `refetch` come from the QueryResult
 *          spread. On error with no cache, `scores` is `undefined` — the UI
 *          shows honest states. No toast is emitted (R5.2).
 */
export function useProgramScores(): UseProgramScoresResult {
  const query = useQuery<ScoresResult>({
    queryKey: programKeys.scores,
    queryFn: getScores,
  })

  return {
    ...query,
    scores: query.data?.data,
    stale: query.data?.stale ?? false,
    recalculated: query.data?.recalculated ?? false,
  }
}
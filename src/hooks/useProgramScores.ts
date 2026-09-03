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
 *  - When there is NO prior cache and the request fails, we fall back to the
 *    mock below so the view never breaks.
 *  - The mock is temporary integration scaffolding and MUST be removed.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getScores, type ScoresResult } from '../services/program/scores-service'
import { programKeys } from './queryKeys'
import type { ScoresResponseDto } from '../services/program/types'

const MOCK_SCORES: ScoresResult = {
  data: {
    healthScore: { current: 0, score: 0, trend: 'flat', indicators: [] },
    transformationScore: { current: 0, score: 0, trend: 'flat', indicators: [] },
  },
  stale: false,
  recalculated: false,
}

export type UseProgramScoresResult = UseQueryResult<ScoresResult> & {
  /** The scores payload, or the mock fallback when there is no cache and the request failed. */
  scores: ScoresResponseDto | undefined
  /** Server freshness: scores are stale (header `X-Score-Stale`). Header-derived only (G3). */
  stale: boolean
  /** Server freshness: scores were recalculated (header `X-Score-Recalculated`). Header-derived only (G3). */
  recalculated: boolean
  /** True when the mock fallback is active (no cache + eligible error). */
  isFallback: boolean
}

/**
 * Query hook feeding `EvolutionView` with the program scores plus freshness.
 *
 * @returns Query state extended with `scores`, `stale`, `recalculated` and
 *          `isFallback`. On error with no cache, `scores` is the mock fallback
 *          and `isFallback` is `true`. No toast is emitted (R5.2).
 */
export function useProgramScores(): UseProgramScoresResult {
  const query = useQuery<ScoresResult>({
    queryKey: programKeys.scores,
    queryFn: getScores,
  })

  // No cached payload AND the latest fetch errored → mock fallback (R5.2).
  const isFallback = !query.data && query.isError

  const scores = query.data?.data ?? (isFallback ? MOCK_SCORES.data : undefined)
  const stale = query.data?.stale ?? false
  const recalculated = query.data?.recalculated ?? false

  return {
    ...query,
    scores,
    stale,
    recalculated,
    isFallback,
  }
}

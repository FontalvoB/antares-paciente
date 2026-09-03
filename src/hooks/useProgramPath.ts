/**
 * useProgramPath — program journey query (SPEC R2.4, R5.2; task 3.2).
 *
 * Reads the week-path for the active program via `getPath()` and exposes it
 * through TanStack Query. Each week node carries `status: Locked | Active |
 * Completed` and `isPerfectWeek` (R2.4).
 *
 * Fallback policy (R5.2 — queries, NOT mutations):
 *   - Server data when available (backend is source of truth, R7.4).
 *   - On an *eligible* error (network / 5xx / timeout) → keep STALE cache if
 *     present; if no cache exists, serve the mock fallback below.
 *   - Business (4xx) errors are surfaced as `error` and NOT swallowed, because
 *     they represent real states (e.g. no active enrollment) the UI must handle.
 *   - Queries NEVER show an error toast (R5.2). Mutations handle their own UX.
 *
 * verbatimModuleSyntax: all type imports use `import type`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { getPath } from '../services/program/program-service'
import { ApiError } from '../utils/apiClient'
import { programKeys } from './queryKeys'

import type { ProgramPathDto } from '../services/program/types'

// TODO: Remove mock fallback — static path used ONLY when the server is
// unreachable (network/5xx/timeout) AND no stale cache exists (R5.2). The
// backend remains the source of truth (R7.4); this keeps the UX from crashing
// on first load with no connectivity. Empty `weeks` is intentional: we never
// invent journey data that could be mistaken for real progress.
const MOCK_PROGRAM_PATH: ProgramPathDto = {
  weeks: [],
}

/**
 * An error is eligible for silent fallback (R5.2) only when it is a transport
 * failure — not a business (4xx) decision from the server.
 */
function isEligibleFallbackError(err: unknown): err is ApiError {
  return (
    err instanceof ApiError &&
    (err.errorType === 'network' ||
      err.errorType === 'server' ||
      err.errorType === 'TIMEOUT')
  )
}

export type UseProgramPathResult = Omit<
  UseQueryResult<ProgramPathDto, ApiError>,
  'data'
> & {
  /** Path data, or `undefined` when no server data/cache/mock is available. */
  data: ProgramPathDto | undefined
  /** True when the served data is the mock fallback (no server data, no cache). */
  isUsingMockFallback: boolean
}

/**
 * Program journey query.
 *
 * @returns TanStack Query result for `ProgramPathDto`. On eligible transport
 *   errors with no cached data, `data` is the mock fallback and
 *   `isUsingMockFallback` is `true`. No toast is ever shown (R5.2).
 */
export function useProgramPath(): UseProgramPathResult {
  const query = useQuery<ProgramPathDto, ApiError>({
    queryKey: programKeys.path,
    queryFn: () => getPath(),
    staleTime: 5 * 60 * 1000, // R5.1
    retry: 2, // R5.1
    refetchOnWindowFocus: true, // R5.1
  })

  // R5.2: TanStack automatically retains STALE cache in `query.data` when a
  // query errors, so we keep it as-is. We only supplement the no-cache case
  // (first load, no prior data) with the mock fallback. Business (4xx) errors
  // keep `data` undefined and surface via `error` so the UI can react to them.
  const usingMock =
    query.data === undefined &&
    query.error !== null &&
    isEligibleFallbackError(query.error)

  const data = usingMock ? MOCK_PROGRAM_PATH : query.data

  return {
    ...query,
    data,
    isUsingMockFallback: usingMock,
  }
}

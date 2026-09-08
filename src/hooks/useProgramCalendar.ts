/**
 * useProgramCalendar — read hook for the program consistency calendar.
 *
 * SPEC: MOBILE-INTEGRATION-SPEC.md
 *   - R2.3: the calendar query asks for a ≤ 92-day range (the service enforces
 *     the cap; this hook only forwards `from`/`to` and renders `days[].isPerfectDay`).
 *   - R5.1: staleTime 5 min, retry on transient failure, refetchOnWindowFocus.
 *   - R5.2: on an ELIGIBLE error (network / 5xx / timeout) the query falls back to
 *     the stale cache and, if none exists, to a mock — WITHOUT any toast. Business
 *     4xx errors (e.g. 404, range-invalid) are propagated so the UI can react.
 *
 * Task: MOBILE-INTEGRATION-TASKS.md §3.4. Depends on services/program/program-service
 * (getCalendar, already range-guarded) and hooks/queryKeys (programKeys.calendar).
 *
 * verbatimModuleSyntax: every type import below uses `import type`.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'

import { getCalendar } from '../services/program/program-service'
import { programKeys } from './queryKeys'
import { ApiError } from '../utils/apiClient'

import type { ProgramCalendarDto, CalendarDayDetailDto } from '../services/program/types'

const CALENDAR_STALE_TIME_MS = 5 * 60 * 1000

const MOCK_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * An error is "eligible" for silent fallback (R5.2) when it is a transport/
 * server failure — anything that could resolve on a retry or is not the
 * patient's fault. Business 4xx responses are NOT eligible: they mean a real
 * contract condition (no enrollment, bad range) the UI must handle explicitly.
 */
function isEligibleQueryError(err: unknown): err is ApiError {
  if (!(err instanceof ApiError)) {
    // Unknown throws (not our ApiError) are treated as transport failures.
    return true
  }
  if (err.errorType === 'network' || err.errorType === 'TIMEOUT') return true
  if (err.errorType === 'server') return true
  if (typeof err.status === 'number' && err.status >= 500) return true
  return false
}

/**
 * Build a type-valid calendar mock for the requested range.
 * TODO: Remove mock fallback — used ONLY when the backend is unreachable and no
 * stale cache exists (R5.2). Replace with real `days[].isPerfectDay` from server.
 */
function buildMockCalendar(from: string, to: string): ProgramCalendarDto {
  const days: CalendarDayDetailDto[] = []
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)

  for (
    let d = new Date(start);
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const localDate = d.toISOString().slice(0, 10)
    days.push({
      localDate,
      weekday: MOCK_WEEKDAYS[d.getUTCDay()],
      weekNumber: 0,
      isPerfectDay: false,
      points: 0,
      bonusAwarded: 0,
      completedTaskCodes: [],
    })
  }

  return {
    days,
    summary: { perfectDays: 0, missedDays: days.length, totalXp: 0 },
  }
}

/**
 * GET /api/v1/program/calendar?from=&to= (identity resolved from JWT — R7.2).
 *
 * @param from - inclusive local start date (YYYY-MM-DD)
 * @param to   - inclusive local end date (YYYY-MM-DD); range MUST be ≤ 92 days
 * @returns TanStack Query result whose `data` is the server calendar, the stale
 *          cache, or the mock fallback on eligible failure.
 */
export function useProgramCalendar(
  from: string,
  to: string,
  options?: { enabled?: boolean },
): UseQueryResult<ProgramCalendarDto, ApiError> {
  const queryClient = useQueryClient()
  const enabled = options?.enabled ?? true

  return useQuery<ProgramCalendarDto, ApiError>({
    queryKey: programKeys.calendar(from, to),
    queryFn: async (): Promise<ProgramCalendarDto> => {
      // Internal retry (R5.1 retry: 2) for transient eligible failures before
      // falling back. Business errors are rethrown immediately and never retried.
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          return await getCalendar(from, to)
        } catch (err) {
          if (!isEligibleQueryError(err)) throw err
        }
      }

      // All eligible attempts failed → stale cache first, then mock (R5.2).
      // No toast is ever shown for query failures.
      const stale = queryClient.getQueryData<ProgramCalendarDto>(
        programKeys.calendar(from, to),
      )
      if (stale) return stale
      return buildMockCalendar(from, to) // TODO: Remove mock fallback
    },
    staleTime: CALENDAR_STALE_TIME_MS,
    retry: false, // retry handled inside queryFn for eligible errors only
    refetchOnWindowFocus: true,
    enabled,
  })
}

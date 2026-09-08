/**
 * Centralized query keys for program-progress TanStack Query hooks.
 * All keys are scoped under ['program', ...] for easy invalidation.
 */

export const programKeys = {
  /** GET /api/v1/program/me/snapshot */
  snapshot: ['program', 'snapshot'] as const,

  /** GET /api/v1/program/calendar?from=&to= */
  calendar: (from: string, to: string) =>
    ['program', 'calendar', from, to] as const,

  /** GET /api/v1/program/path */
  path: ['program', 'path'] as const,

  /** GET /api/v1/program/scores */
  scores: ['program', 'scores'] as const,

  /** GET /api/v1/program/me/league */
  league: ['program', 'league'] as const,

  /** GET /api/v1/program/me/scores-history?weeks=12 (tab Evo, trend card) */
  scoresHistory: ['program', 'scores-history'] as const,

  /** All program queries — use for enrollment-level invalidation */
  all: ['program'] as const,
} as const

/**
 * Invalidation matrix (DESIGN §Query keys):
 * - completing/registering task → invalidate snapshot + path + calendar + scores
 * - enrollment → invalidate ALL program queries
 * - focus/reconnect → TanStack Query handles staleTime refresh
 * - scoresHistory is INTENTIONALLY not invalidated on task completion: the
 *   series has weekly granularity (a task won't change it) and the query's
 *   staleTime absorbs it; invalidating would only trigger a redundant refetch.
 */
export const programInvalidation = {
  /** After completing a task or registering nutrition */
  afterMutation: (queryClient: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<void> }) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: programKeys.snapshot }),
      queryClient.invalidateQueries({ queryKey: programKeys.path }),
      queryClient.invalidateQueries({ queryKey: programKeys.scores }),
      // Calendar invalidation depends on the current month range; caller can
      // invalidate specific range keys via programKeys.calendar(from, to).
    ]),

  /** After enrollment (creates or re-activates) */
  afterEnrollment: (queryClient: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<void> }) =>
    queryClient.invalidateQueries({ queryKey: programKeys.all }),

  /** After nutrition log (meal/hydration) */
  afterNutritionLog: (queryClient: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<void> }) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: programKeys.snapshot }),
      queryClient.invalidateQueries({ queryKey: programKeys.scores }),
    ]),
} as const

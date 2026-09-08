/**
 * useCompleteTask — optimistic task-completion mutation for the program.
 *
 * Implements SPEC R2.2 / R3 / R5.3 / R5.4 / R5.6 and DESIGN §Mutaciones.
 *
 * Behaviour:
 *  - Generates a UUID `clientRequestId` ONCE per action; reuses it on retries
 *    (R3.1). A replay with the same key returns the same body with no extra XP
 *    (R3.2) — celebration is fired in `onMutate` only, deduped by key, so a
 *    server replay never re-animates (R3.2: "replay body has NO flag").
 *  - `onMutate`: cancel snapshot query, snapshot previous cache, optimistically
 *    mark the task Completed + XP estimate, fire celebration once per key.
 *  - `onError`: roll back the cached snapshot (R5.3).
 *  - `onSuccess`: reconcile XP / streak / day-points / bonus from the response.
 *  - `onSettled`: invalidate snapshot / path / calendar / scores (R5.3).
 *  - Network / 5xx failure → enqueue to offline-queue (R5.4) + "offline" toast.
 *  - 409 IDEMPOTENCY_KEY_REUSED → new key + single retry (R3.3).
 *  - 409 TASK_NOT_SCHEDULED / 422 DATE_OUTSIDE_ACTIVE_WEEK / 409 ENROLLMENT_INACTIVE
 *    → no retry, no enqueue, snapshot invalidated (R3.4, R4.4).
 *
 * `enrollmentId` / `localDate` are ALWAYS taken from the snapshot, never UI
 * input (R2.2). `taskCode` comes from the task catalog.
 *
 * Celebration is decoupled via a `program:task-celebrated` window CustomEvent
 * (detail: CelebrateInfo) so the UI (e.g. ProgramPage confetti) can subscribe
 * without coupling. Pass `onCelebrate` to override the trigger.
 */

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { completeTask } from '../services/program/tasks-service'
import { enqueue } from '../services/program/offline-queue'
import { programKeys } from './queryKeys'
import { ApiError } from '../utils/apiClient'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'
import type {
  CompleteTaskInput,
  CompleteTaskResponseDto,
  ProgramSnapshotDto,
  TaskCode,
  TodayTaskDto,
  VitalsPayload,
} from '../services/program/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Variables the UI passes — never includes ids/dates (those come from snapshot). */
export interface CompleteTaskVars {
  taskCode: TaskCode
  moodScore?: number
  barriers?: string
  contentFingerprint?: string
  clientCompletedAt?: string
  // Additive (vital-signs-tracking): optional nested vitals for the `vitals`
  // task. Carried verbatim into the wire payload and the offline queue.
  vitals?: VitalsPayload | null
}

/** Payload delivered to the celebration listener / onCelebrate callback. */
export interface CelebrateInfo {
  taskCode: TaskCode
  xpEstimate: number
  clientRequestId: string
}

/** Hook options. */
export interface UseCompleteTaskOptions {
  /** Override the celebration trigger. Defaults to a `program:task-celebrated`
   *  window CustomEvent so the UI can wire confetti/popup without coupling. */
  onCelebrate?: (info: CelebrateInfo) => void
}

/** Internal mutation variables (clientRequestId attached by the wrapper). */
type MutationVars = CompleteTaskVars & { clientRequestId: string }

/** Context returned from onMutate and consumed by onError/onSettled. */
interface CompleteTaskContext {
  previousSnapshot: ProgramSnapshotDto | null
  payload: CompleteTaskInput | null
  clientRequestId: string
}

// ---------------------------------------------------------------------------
// Local celebration dedupe (R3.2: replay body has NO flag)
// ---------------------------------------------------------------------------

const firedCelebrations = new Set<string>()

function fireCelebrationOnce(
  clientRequestId: string,
  taskCode: TaskCode,
  snapshot: ProgramSnapshotDto | null,
  onCelebrate?: (info: CelebrateInfo) => void,
): void {
  if (firedCelebrations.has(clientRequestId)) return
  firedCelebrations.add(clientRequestId)

  const task = snapshot?.todayTasks.find((t) => t.taskCode === taskCode)
  const info: CelebrateInfo = {
    taskCode,
    xpEstimate: task?.points ?? 0,
    clientRequestId,
  }

  if (onCelebrate) {
    onCelebrate(info)
  } else {
    window.dispatchEvent(
      new CustomEvent<CelebrateInfo>('program:task-celebrated', { detail: info }),
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UUID generator with a safe fallback for environments lacking crypto.randomUUID. */
function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Transport failures (R5.4): timeout / network / 5xx are eligible for the queue. */
function isRetryableNetworkError(err: ApiError): boolean {
  return (
    err.errorType === 'TIMEOUT' ||
    err.errorType === 'network' ||
    (err.errorType === 'server' && err.status >= 500)
  )
}

/** Vitals payload keys that map 1:1 into `RecentVitalsDto` (measuredAt → recordedAt). */
const VITAL_RECORD_KEYS = ['heartRate', 'systolic', 'diastolic', 'o2Saturation', 'glucose', 'weightKg', 'temperatureC'] as const

/**
 * Optimistic completion: mark task Completed + add its point estimate to
 * XP/today. For the `vitals` task with at least one provided value, the
 * submitted values are MERGED over the cached `content.recentVitals`
 * (recordedAt = measuredAt ?? now) so the completed view shows what was just
 * submitted without waiting for a refetch. The merge mirrors the server's
 * eventual truth (last-value-per-metric over 90 days): submitted metrics are
 * overwritten, non-submitted metrics keep their previous value, recordedAt
 * advances. The optimistic state is visible immediately; on mutation failure
 * (e.g. offline) `onError` rolls the snapshot back to `previousSnapshot` and
 * the completion is enqueued for replay, then `onSettled` invalidates the
 * snapshot so the refetch reconciles to server truth. No vitals → behaviour
 * identical to before. Never mutates the input snapshot.
 */
export function applyOptimistic(
  snapshot: ProgramSnapshotDto,
  taskCode: TaskCode,
  vitals?: VitalsPayload | null,
): ProgramSnapshotDto {
  const task = snapshot.todayTasks.find((t) => t.taskCode === taskCode)
  if (!task || task.status === 'Completed') return snapshot

  const xpEstimate = task.points
  return {
    ...snapshot,
    xp: { ...snapshot.xp, balance: snapshot.xp.balance + xpEstimate },
    todayPoints: snapshot.todayPoints + xpEstimate,
    todayTasks: snapshot.todayTasks.map((t) => {
      if (t.taskCode !== taskCode) return t
      const completed: TodayTaskDto = { ...t, status: 'Completed', completedAt: new Date().toISOString() }
      if (taskCode !== 'vitals' || vitals == null) return completed
      const hasVitals = VITAL_RECORD_KEYS.some((k) => vitals[k] != null)
      if (!hasVitals) return completed
      const { measuredAt, ...values } = vitals
      return {
        ...completed,
        content: {
          ...(t.content ?? {}),
          // Merge (no replace): el servidor reconcilia last-value-per-metric
          // sobre 90 días — lo no enviado hoy conserva su valor previo, lo
          // enviado se sobreescribe y recordedAt avanza. Así el estado
          // optimista coincide con el eventual post-refetch.
          recentVitals: { ...(t.content?.recentVitals ?? {}), ...values, recordedAt: measuredAt ?? new Date().toISOString() },
        },
      }
    }),
  }
}

/**
 * Reconcile authoritative values returned by the server (R5.3).
 *
 * `todayBonusAvailable` server semantics: "bonus STILL EARNABLE" — true when
 * the perfect-day bonus has NOT been awarded yet today, false once awarded
 * (`checkin.IsPerfectDay != true`). The earned signal is the server's
 * `isPerfectDay` (robusto incluso ante una regla DAY_BONUS hipotética de
 * monto 0, donde `dailyBonusAwarded` sería 0 con el día ya perfecto): cuando
 * el día es perfecto la UI debe pintar el cofre como desbloqueado; si no, se
 * conserva el valor cacheado previo. Exported for unit tests.
 */
export function reconcileSnapshot(
  snapshot: ProgramSnapshotDto | undefined,
  data: CompleteTaskResponseDto,
): ProgramSnapshotDto | undefined {
  if (!snapshot) return snapshot
  return {
    ...snapshot,
    xp: { ...snapshot.xp, balance: data.xpBalanceAfter },
    streak: { ...snapshot.streak, current: data.streakCurrent },
    todayPoints: data.dayPoints,
    todayBonusAvailable: data.isPerfectDay ? false : snapshot.todayBonusAvailable,
  }
}

/** Build the wire payload — enrollmentId / localDate come from the snapshot. */
function buildPayload(snapshot: ProgramSnapshotDto, vars: MutationVars): CompleteTaskInput {
  return {
    enrollmentId: snapshot.enrollmentId,
    localDate: snapshot.todayLocalDate,
    taskCode: vars.taskCode,
    clientRequestId: vars.clientRequestId,
    clientCompletedAt: vars.clientCompletedAt,
    moodScore: vars.moodScore,
    barriers: vars.barriers,
    contentFingerprint: vars.contentFingerprint,
    vitals: vars.vitals,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompleteTask(
  options?: UseCompleteTaskOptions,
): UseMutationResult<CompleteTaskResponseDto, ApiError, MutationVars, CompleteTaskContext> & {
  completeTask: (vars: CompleteTaskVars) => void
} {
  const queryClient = useQueryClient()
  const { showToast } = useApp()
  const t = useT()
  const onCelebrate = options?.onCelebrate

  const mutation = useMutation<CompleteTaskResponseDto, ApiError, MutationVars, CompleteTaskContext>({
    // No automatic retry: network failures go to the offline queue (R5.4);
    // the idempotency retry is handled explicitly in mutationFn (R3.3).
    retry: false,

    mutationFn: async (vars): Promise<CompleteTaskResponseDto> => {
      const snapshot = queryClient.getQueryData<ProgramSnapshotDto>(programKeys.snapshot)
      if (!snapshot) {
        throw new ApiError({
          message: 'Program snapshot is not loaded',
          errorType: 'business',
          status: 409,
          code: 'NO_ACTIVE_ENROLLMENT',
        })
      }
      try {
        return await completeTask(buildPayload(snapshot, vars))
      } catch (err) {
        // R3.3 — IDEMPOTENCY_KEY_REUSED: same key, different task/date.
        // Generate a fresh key and retry exactly once.
        if (err instanceof ApiError && err.code === 'IDEMPOTENCY_KEY_REUSED') {
          const retried: MutationVars = { ...vars, clientRequestId: newClientRequestId() }
          return await completeTask(buildPayload(snapshot, retried))
        }
        throw err
      }
    },

    onMutate: async (vars): Promise<CompleteTaskContext> => {
      await queryClient.cancelQueries({ queryKey: programKeys.snapshot })

      const snapshot = queryClient.getQueryData<ProgramSnapshotDto>(programKeys.snapshot) ?? null
      const previousSnapshot = snapshot

      if (snapshot) {
        queryClient.setQueryData<ProgramSnapshotDto>(programKeys.snapshot, (old) =>
          old ? applyOptimistic(old, vars.taskCode, vars.vitals) : old,
        )
      }

      const payload = snapshot ? buildPayload(snapshot, vars) : null

      fireCelebrationOnce(vars.clientRequestId, vars.taskCode, previousSnapshot, onCelebrate)

      return { previousSnapshot, payload, clientRequestId: vars.clientRequestId }
    },

    onError: (error, _vars, ctx): void => {
      // R5.3 — roll back ALL caches modified in onMutate.
      if (ctx?.previousSnapshot) {
        queryClient.setQueryData(programKeys.snapshot, ctx.previousSnapshot)
      }
      // 422 NUTRITION_EVIDENCE_REQUIRED (S4/D3): el gate de adherencia
      // nutricional lista las comidas del plan sin evidencia — toast err con
      // el detalle (B7 contract). Solo este shape; el resto de errores
      // conserva el comportamiento previo (rollback silencioso).
      if (error instanceof ApiError && error.errors?.missingMealCodes?.length) {
        showToast(
          t('Faltan comidas del plan: {meals}', {
            meals: error.errors.missingMealCodes.join(', '),
          }),
          'err',
        )
      }
    },

    onSuccess: (data, _vars, _ctx): void => {
      queryClient.setQueryData<ProgramSnapshotDto>(programKeys.snapshot, (old) =>
        reconcileSnapshot(old, data),
      )
    },

    onSettled: async (_data, error, vars, ctx): Promise<void> => {
      // R5.3 — invalidate program queries after every completion attempt.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: programKeys.snapshot }),
        queryClient.invalidateQueries({ queryKey: programKeys.path }),
        queryClient.invalidateQueries({ queryKey: ['program', 'calendar'] as const }),
        queryClient.invalidateQueries({ queryKey: programKeys.scores }),
      ])

      if (!(error instanceof ApiError)) return

      // R5.4 — transport failure: enqueue for replay + offline toast.
      if (isRetryableNetworkError(error)) {
        if (ctx?.payload) {
          enqueue<CompleteTaskInput>({
            actionType: 'completeTask',
            payload: ctx.payload,
            clientRequestId: vars.clientRequestId,
            createdAt: new Date().toISOString(),
          })
        }
        showToast(
          'Sin conexión. Tu progreso se sincronizará cuando vuelvas a estar en línea.',
          'warn',
        )
        return
      }

      // R3.4 / R4.4 — business errors (TASK_NOT_SCHEDULED, DATE_OUTSIDE_ACTIVE_WEEK,
      // ENROLLMENT_INACTIVE): no retry, no enqueue. Snapshot already invalidated.
      // The error propagates to the consumer for code-based UX messaging (R5.6).
    },
  })

  const complete = useCallback(
    (vars: CompleteTaskVars): void => {
      mutation.mutate({ ...vars, clientRequestId: newClientRequestId() })
    },
    [mutation],
  )

  return Object.assign(mutation, { completeTask: complete })
}

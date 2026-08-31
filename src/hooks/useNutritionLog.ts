/**
 * useNutritionLog — nutrition/hydration logging mutation
 * (SPEC R2.6, R5.3, R5.4, R5.5, R5.6; DESIGN §mutations; task 3.6).
 *
 * Optimistic mutation around `logMeal()`:
 *   - 409 HABIT_ALREADY_LOGGED → keep the optimistic "logged" marker (the meal
 *     IS already recorded server-side), award NO extra XP, and DO NOT enqueue
 *     (R2.6 / R5.6 — business conflict, no retry).
 *   - Transport failure (timeout / network / 5xx) → enqueue for ordered offline
 *     replay with the SAME mealCode+localDate (R5.4 / R5.5). The server dedups
 *     naturally by meal+day, so no clientRequestId is sent on the wire.
 *   - onSettled → invalidate snapshot + scores ONLY when XP could change
 *     (success path); on 409/transport we skip invalidation so the optimistic
 *     marker (or queued state) survives until reconnect/replay reconciles.
 *
 * Optimism model: we mark the meal as logged immediately via an additive client
 * cache field and add XP only after the server confirms (onSuccess). Because no
 * XP is added optimistically, "revert the optimism" on 409 costs nothing — the
 * marker is already the server truth.
 *
 * verbatimModuleSyntax: all type imports use `import type`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { logMeal, type MealCode } from '../services/program/nutrition-service'
import { enqueue } from '../services/program/offline-queue'
import { programKeys, programInvalidation } from './queryKeys'

import { ApiError } from '../utils/apiClient'
import type {
  NutritionLogResultDto,
  ProgramSnapshotDto,
} from '../services/program/types'

/** Mutation input. */
export interface LogMealVariables {
  mealCode: MealCode
  localDate?: string
}

/**
 * Client-only additive field carried on the snapshot cache for optimistic
 * nutrition logging. NOT a wire field (R7.1 additive spirit): it lives only in
 * the TanStack cache to give instant UI feedback and is dropped on refetch.
 */
type CachedSnapshot = ProgramSnapshotDto & {
  todayNutritionLogged?: string[]
}

/** Transport failure eligible for offline-queue replay (R5.4 / R5.5). */
function isTransportError(err: unknown): err is ApiError {
  if (!(err instanceof ApiError)) return false
  if (err.errorType === 'network' || err.errorType === 'TIMEOUT') return true
  return err.errorType === 'server' && err.status >= 500
}

/** Business conflict: meal/hydration already logged today (R2.6 / R5.6). */
function isAlreadyLogged(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 409 && err.code === 'HABIT_ALREADY_LOGGED'
}

/**
 * Nutrition/hydration logging mutation with optimistic cache update.
 *
 * @returns TanStack `useMutation` result. On 409 the `error` carries
 *   `code: 'HABIT_ALREADY_LOGGED'` so the UI can show the "already logged"
 *   state; the optimistic marker is retained. On transport failure the entry is
 *   enqueued for replay and `error.errorType` is 'network' | 'TIMEOUT' | 'server'.
 */
export function useNutritionLog() {
  const queryClient = useQueryClient()

  return useMutation<NutritionLogResultDto, ApiError, LogMealVariables>({
    // DESIGN §query keys: networkMode 'online' so an offline trigger is paused
    // (not silently dropped); transport failures during an in-flight request
    // still surface via onError and are enqueued (R5.4).
    networkMode: 'online',

    mutationFn: ({ mealCode, localDate }) => logMeal(mealCode, localDate),

    onMutate: async (vars) => {
      // Cancel in-flight snapshot/scores queries so the optimistic patch wins.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: programKeys.snapshot }),
        queryClient.cancelQueries({ queryKey: programKeys.scores }),
      ])

      // Optimistically mark the meal/hydration as logged for instant UI feedback.
      queryClient.setQueryData<CachedSnapshot>(programKeys.snapshot, (old) => {
        if (!old) return old
        const logged = new Set(old.todayNutritionLogged ?? [])
        logged.add(vars.mealCode)
        return { ...old, todayNutritionLogged: [...logged] }
      })
    },

    onError: (error, vars) => {
      // 409 HABIT_ALREADY_LOGGED: the meal is already recorded server-side, so
      // the optimistic marker is already correct. No extra XP, NO enqueue (R5.6).
      if (isAlreadyLogged(error)) return

      // Transport failure → enqueue for ordered replay with the SAME
      // mealCode+localDate. The server's per-meal/per-day dedup makes the replay
      // idempotent without a clientRequestId on the wire (R3.2 / R5.5).
      if (isTransportError(error)) {
        enqueue<LogMealVariables>({
          actionType: 'nutritionLog',
          payload: { mealCode: vars.mealCode, localDate: vars.localDate },
          clientRequestId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        })
      }
      // Any other 4xx: per R5.6 do NOT enqueue; the UI surfaces it by code.
    },

    onSuccess: (data, vars) => {
      // Reconcile from server truth: ensure logged + add the awarded XP exactly
      // once (no optimistic XP was added, so no double-count possible).
      queryClient.setQueryData<CachedSnapshot>(programKeys.snapshot, (old) => {
        if (!old) return old
        return {
          ...old,
          todayNutritionLogged: [...new Set([...(old.todayNutritionLogged ?? []), vars.mealCode])],
          xp: { ...old.xp, balance: old.xp.balance + data.xpAwarded },
        }
      })
    },

    onSettled: (_data, error) => {
      // Invalidate snapshot + scores ONLY when XP could have changed (success).
      // 409 awards no XP and transport keeps the queued optimistic marker, so we
      // skip invalidation in both cases (R2.6 / R5.4). The offline queue's own
      // replay flushes invalidate everything after reconnect (R5.5).
      if (error) return
      void programInvalidation.afterNutritionLog(queryClient)
    },
  })
}

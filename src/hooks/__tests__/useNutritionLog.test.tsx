import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ApiError } from '../../utils/apiClient'
import { programKeys } from '../queryKeys'

import type { ProgramSnapshotDto } from '../../services/program/types'

// --- Mocks (misma ruta que importa el hook) ---

const logMealMock = vi.fn()
const enqueueMock = vi.fn()

vi.mock('../../services/program/nutrition-service', () => ({
  logMeal: (...args: unknown[]) => logMealMock(...args),
}))

vi.mock('../../services/program/offline-queue', () => ({
  enqueue: (...args: unknown[]) => enqueueMock(...args),
}))

import { useNutritionLog } from '../useNutritionLog'
import type { LogMealVariables } from '../useNutritionLog'

// --- Helpers ---

function makeSnapshot(): ProgramSnapshotDto {
  return {
    enrollmentId: 'enr-1',
    template: {
      id: 'tpl-1',
      code: 'default-83w',
      name: 'Demo',
      totalWeeks: 83,
      currentWeekNumber: 1,
      currentWeekStatus: 'Active',
      currentWeekStartDateLocal: '2026-09-01',
      currentWeekEndDateLocal: '2026-09-07',
    },
    todayLocalDate: '2026-09-02',
    todayTasks: [],
    todayPoints: 0,
    todayBonusAvailable: false,
    todayPointsMax: 0,
    xp: { balance: 100, level: '1', nextLevelAt: 1000 },
    streak: {
      current: 0,
      longest: 0,
      freezesRemaining: 0,
      multiplierActive: 1,
      multiplierEndsAt: null,
      multiplierRemainingHours: 0,
    },
    nextMilestoneDays: 0,
    calendar: [],
  }
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

const networkError = () =>
  new ApiError({ message: 'Network error', status: 0, errorType: 'network' })

// --- Tests ---

describe('useNutritionLog', () => {
  beforeEach(() => {
    logMealMock.mockReset()
    enqueueMock.mockReset()
  })

  it('success → optimistically patches the server-truth logged field', async () => {
    const client = newClient()
    const snapshot = makeSnapshot()
    client.setQueryData(programKeys.snapshot, snapshot)

    logMealMock.mockResolvedValue({
      mealCode: 'alm',
      localDate: '2026-09-02',
      xpAwarded: 10,
    })

    const { result } = renderHook(() => useNutritionLog(), {
      wrapper: makeWrapper(client),
    })

    await act(async () => {
      result.current.mutate({ mealCode: 'alm' })
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    const cached = client.getQueryData<ProgramSnapshotDto & { todayNutritionLogged?: string[] }>(
      programKeys.snapshot,
    )
    expect(cached?.todayNutritionLogged).toContain('alm')
    expect(cached?.xp.balance).toBe(110)
  })

  it('409 HABIT_ALREADY_LOGGED → keeps the logged state and does NOT enqueue', async () => {
    const client = newClient()
    const snapshot = makeSnapshot()
    client.setQueryData(programKeys.snapshot, snapshot)

    logMealMock.mockRejectedValue(
      new ApiError({
        message: 'HABIT_ALREADY_LOGGED: la comida ya fue registrada.',
        status: 409,
        code: 'HABIT_ALREADY_LOGGED',
        errorType: 'business',
      }),
    )

    const { result } = renderHook(() => useNutritionLog(), {
      wrapper: makeWrapper(client),
    })

    await act(async () => {
      result.current.mutate({ mealCode: 'des' })
      await vi.waitFor(() => expect(result.current.isError).toBe(true))
    })

    // El marcador optimista se CONSERVA en el caché (la verdad server-side ya
    // lo incluye) y NO se encola nada: conflicto de negocio, sin retry (R5.6).
    // B6: la aserción del caché es explícita — no basta error.code + no-enqueue.
    const cached = client.getQueryData<ProgramSnapshotDto & { todayNutritionLogged?: string[] }>(
      programKeys.snapshot,
    )
    expect(cached?.todayNutritionLogged).toContain('des')
    expect(result.current.error?.code).toBe('HABIT_ALREADY_LOGGED')
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('transport error → enqueues offline replay with intake fields verbatim', async () => {
    const client = newClient()
    const snapshot = makeSnapshot()
    client.setQueryData(programKeys.snapshot, snapshot)

    logMealMock.mockRejectedValue(networkError())

    const { result } = renderHook(() => useNutritionLog(), {
      wrapper: makeWrapper(client),
    })

    const intake = {
      calories: 450,
      proteinG: 25.5,
      carbsG: 40,
      fatG: 12,
      fiberG: 6,
      waterMl: 500,
      source: 'ai_photo',
      foodAnalysisId: 'a1b2c3d4-0000-4000-8000-000000000001',
    }
    const vars: LogMealVariables = { mealCode: 'alm', localDate: '2026-09-02', intake }

    await act(async () => {
      result.current.mutate(vars)
      await vi.waitFor(() => expect(result.current.isError).toBe(true))
    })

    expect(enqueueMock).toHaveBeenCalledTimes(1)
    const entry = enqueueMock.mock.calls[0][0] as {
      actionType: string
      payload: unknown
    }
    expect(entry.actionType).toBe('nutritionLog')
    // El payload viaja VERBATIM con el MISMO shape anidado que logMeal (B2):
    // mealCode + localDate + bloque `intake` — nunca aplanado en top-level.
    expect(entry.payload).toEqual({
      mealCode: 'alm',
      localDate: '2026-09-02',
      intake: {
        calories: 450,
        proteinG: 25.5,
        carbsG: 40,
        fatG: 12,
        fiberG: 6,
        waterMl: 500,
        source: 'ai_photo',
        foodAnalysisId: 'a1b2c3d4-0000-4000-8000-000000000001',
      },
    })
  })
})
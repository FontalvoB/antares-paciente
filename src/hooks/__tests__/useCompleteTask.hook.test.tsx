/**
 * useCompleteTask — hook-level behaviour tests (anti-lie fix).
 *
 * Regla central: el servidor manda. Nada de celebración ni feedback de éxito
 * local hasta que la completación es confirmada; un 422 del gate de adherencia
 * nutricional debe dejar el cache EXACTAMENTE como estaba.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ApiError } from '../../utils/apiClient'
import { programKeys } from '../queryKeys'
import type {
  CompleteTaskResponseDto,
  ProgramSnapshotDto,
} from '../../services/program/types'

// --- Mocks (misma ruta que importa el hook) ---

const completeTaskMock = vi.fn()
const enqueueMock = vi.fn()
const showToastMock = vi.fn()

vi.mock('../../services/program/tasks-service', () => ({
  completeTask: (...args: unknown[]) => completeTaskMock(...args),
}))

vi.mock('../../services/program/offline-queue', () => ({
  enqueue: (...args: unknown[]) => enqueueMock(...args),
}))

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ showToast: showToastMock }),
}))

vi.mock('../../i18n/I18nContext', () => ({
  useT: () => (key: string) => key,
}))

import { useCompleteTask } from '../useCompleteTask'

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
    todayLocalDate: '2026-09-09',
    todayTasks: [
      {
        taskCode: 'nut',
        title: 'Plan nutricional',
        short: 'Registra tus comidas',
        points: 60,
        status: 'Pending',
        completedAt: null,
      },
    ],
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

function makeResponse(
  overrides: Partial<CompleteTaskResponseDto> = {},
): CompleteTaskResponseDto {
  return {
    taskCompletionId: 'tc-1',
    pointsAwarded: 60,
    xpBalanceAfter: 160,
    isPerfectDay: false,
    dailyBonusAwarded: 0,
    streakCurrent: 3,
    freezesRemaining: 0,
    dayPoints: 60,
    dayPointsMax: 220,
    ...overrides,
  }
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const gate422 = () =>
  new ApiError({
    message: 'NUTRITION_EVIDENCE_REQUIRED',
    status: 422,
    code: 'NUTRITION_EVIDENCE_REQUIRED',
    errorType: 'business',
    errors: { missingMealCodes: ['des', 'alm', 'cen'] },
  })

// --- Tests ---

describe('useCompleteTask — server truth', () => {
  let celebrateSpy: Mock<(e: Event) => void>

  beforeEach(() => {
    completeTaskMock.mockReset()
    enqueueMock.mockReset()
    showToastMock.mockReset()
    celebrateSpy = vi.fn()
    window.addEventListener('program:task-celebrated', celebrateSpy)
  })

  afterEach(() => {
    window.removeEventListener('program:task-celebrated', celebrateSpy)
  })

  it('success → celebration fires once and per-call onSuccess runs', async () => {
    const client = newClient()
    client.setQueryData(programKeys.snapshot, makeSnapshot())
    completeTaskMock.mockResolvedValue(makeResponse())

    const { result } = renderHook(() => useCompleteTask(), { wrapper: makeWrapper(client) })
    const successCb = vi.fn()

    await act(async () => {
      result.current.completeTask({ taskCode: 'nut' }, { onSuccess: successCb })
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    expect(celebrateSpy).toHaveBeenCalledTimes(1)
    const detail = (celebrateSpy.mock.calls[0][0] as CustomEvent).detail as {
      xpEstimate: number
    }
    expect(detail.xpEstimate).toBe(60)
    expect(successCb).toHaveBeenCalledTimes(1)
    // Reconcile: XP del server (no el estimado) prevalece.
    const cached = client.getQueryData<ProgramSnapshotDto>(programKeys.snapshot)
    expect(cached?.xp.balance).toBe(160)
    expect(cached?.todayTasks[0].status).toBe('Completed')
  })

  it('422 nutrition gate → NO celebration, cache fully rolled back, error toast with meals', async () => {
    const client = newClient()
    const before = makeSnapshot()
    client.setQueryData(programKeys.snapshot, before)
    completeTaskMock.mockRejectedValue(gate422())

    const { result } = renderHook(() => useCompleteTask(), { wrapper: makeWrapper(client) })
    const successCb = vi.fn()
    const errorCb = vi.fn()

    await act(async () => {
      result.current.completeTask({ taskCode: 'nut' }, { onSuccess: successCb, onError: errorCb })
      await vi.waitFor(() => expect(result.current.isError).toBe(true))
    })

    // La mentira que arreglamos esto: nada de celebración ni de éxito local.
    expect(celebrateSpy).not.toHaveBeenCalled()
    expect(successCb).not.toHaveBeenCalled()
    expect(errorCb).toHaveBeenCalledTimes(1)

    // Rollback total del cache: la tarea vuelve a Pending, XP intacto.
    const cached = client.getQueryData<ProgramSnapshotDto>(programKeys.snapshot)
    expect(cached?.todayTasks[0].status).toBe('Pending')
    expect(cached?.xp.balance).toBe(100)
    expect(cached?.todayPoints).toBe(0)

    // Toast con el contrato B7 (missingMealCodes).
    expect(showToastMock).toHaveBeenCalledWith(
      expect.stringContaining('Faltan comidas del plan'),
      'err',
    )
    // Un 422 de negocio no va a la cola offline.
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('transport error → enqueued for replay, offline toast, no celebration', async () => {
    const client = newClient()
    client.setQueryData(programKeys.snapshot, makeSnapshot())
    completeTaskMock.mockRejectedValue(
      new ApiError({ message: 'network down', status: 0, errorType: 'network' }),
    )

    const { result } = renderHook(() => useCompleteTask(), { wrapper: makeWrapper(client) })

    await act(async () => {
      result.current.completeTask({ taskCode: 'nut' })
      await vi.waitFor(() => expect(result.current.isError).toBe(true))
    })

    expect(celebrateSpy).not.toHaveBeenCalled()
    expect(enqueueMock).toHaveBeenCalledTimes(1)
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'warn')
  })

  it('replay dedupe (R3.2): same clientRequestId never re-animates', async () => {
    const client = newClient()
    client.setQueryData(programKeys.snapshot, makeSnapshot())
    completeTaskMock.mockResolvedValue(makeResponse())

    const { result } = renderHook(() => useCompleteTask(), { wrapper: makeWrapper(client) })

    // Mismo clientRequestId forzado (escenario de replay del server).
    const vars = { taskCode: 'nut' as const }
    await act(async () => {
      result.current.mutate({ ...vars, clientRequestId: 'fixed-key-1' })
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
    })
    await act(async () => {
      result.current.mutate({ ...vars, clientRequestId: 'fixed-key-1' })
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    expect(celebrateSpy).toHaveBeenCalledTimes(1)
  })
})

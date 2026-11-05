import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useNutritionPlanStatus } from '../useNutritionPlanStatus'
import { nutritionKeys, programKeys } from '../queryKeys'
import type { NutritionPlanStatusDto } from '../../services/nutrition/my-nutrition-plan-service'

const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../../services/nutrition/my-nutrition-plan-service', () => ({ getMyNutritionPlanStatus: () => mocks.read() }))
vi.mock('../../utils/authApi', () => ({ onSessionInvalid: () => () => {} }))
afterEach(() => cleanup())

describe('estado nutricional y cambio de día del ciclo', () => {
  it('actualiza plan y protocolo cuando cambia el día aunque siga activo', async () => {
    let response: NutritionPlanStatusDto = { status: 'active', durationDays: 30, currentDay: 10, startDate: '2026-11-01', endDate: '2026-11-30' }
    mocks.read.mockImplementation(async () => response)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const hook = renderHook(() => useNutritionPlanStatus(), { wrapper })
    await waitFor(() => expect(hook.result.current.status?.currentDay).toBe(10))
    invalidate.mockClear()
    response = { ...response, currentDay: 11 }
    await act(async () => { await hook.result.current.refetch() })
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: nutritionKeys.myNutritionPlan, exact: true }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: programKeys.snapshot })
    invalidate.mockClear()
    await act(async () => { await hook.result.current.refetch() })
    expect(invalidate).not.toHaveBeenCalled()
    response = { ...response, revision: 2 }
    await act(async () => { await hook.result.current.refetch() })
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: nutritionKeys.myNutritionPlan, exact: true }))
    hook.unmount()
    client.clear()
  })

  it('la caducidad invalida la dieta anterior para que deje de verse', async () => {
    let response: NutritionPlanStatusDto = { status: 'active', durationDays: 30, currentDay: 30 }
    mocks.read.mockImplementation(async () => response)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const hook = renderHook(() => useNutritionPlanStatus(), { wrapper })
    await waitFor(() => expect(hook.result.current.status?.status).toBe('active'))
    invalidate.mockClear()
    response = { status: 'expired', durationDays: 30 }
    await act(async () => { await hook.result.current.refetch() })
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: nutritionKeys.myNutritionPlan, exact: true }))
    hook.unmount()
    client.clear()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '../../utils/apiClient'
import type { MeAssignment, MeBattery } from '../../utils/healthTestsApi'
import { initialBatteryCompletedCount } from '../../utils/programAssignment'
import { useProgram } from '../useProgram'

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), completion: vi.fn(), enroll: vi.fn(), batteries: vi.fn(), assignments: vi.fn() }))
vi.mock('../../services/program/program-service', () => ({ getSnapshot: mocks.snapshot, getProgramCompletion: mocks.completion, enrollMe: mocks.enroll }))
vi.mock('../../utils/healthTestsApi', () => ({ fetchMyBatteries: mocks.batteries, fetchMyAssignments: mocks.assignments }))

const codes = ['historia-clinica', 'temperamento', 'nutricional', 'movimiento', 'sueno', 'iac-adresd', 'orp', 'ers', 'bateria-antares']
const battery = { id: 'initial', batteryId: '0d0198a4-ade2-50af-a6d4-e5fe29096d41' } as MeBattery
const assignments = (n: number) => codes.slice(0, n).map(testCode => ({ testCode, status: 'completed', batteryAssignmentId: 'initial' }) as MeAssignment)
const absent = () => new ApiError({ message: 'No active week', status: 404, code: 'NO_ACTIVE_ENROLLMENT', errorType: 'business' })
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider> }
  return renderHook(() => useProgram(), { wrapper: Wrapper })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.snapshot.mockRejectedValue(absent())
  mocks.completion.mockResolvedValue({ completion: null })
  mocks.batteries.mockResolvedValue([battery])
  mocks.assignments.mockResolvedValue(assignments(8))
})

describe('cierre de programa 4.10', () => {
  const completion = { enrollmentId: 'finished', totalDays: 83, perfectDays: 40, canStartNewProgram: true }
  it('resuelve el resumen antes de consultar batería y nunca inicia otro programa', async () => {
    mocks.completion.mockResolvedValue({ completion })
    const { result } = setup()
    await waitFor(() => expect(result.current.programState).toBe('completed'))
    expect(result.current.completion).toEqual(completion)
    expect(result.current.snapshot).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(mocks.batteries).not.toHaveBeenCalled()
    expect(mocks.enroll).not.toHaveBeenCalled()
  })
  it('espera el resumen sin mostrar tests pendientes ni tareas anteriores', async () => {
    mocks.completion.mockReturnValue(new Promise(() => {}))
    const { result } = setup()
    await waitFor(() => expect(mocks.completion).toHaveBeenCalled())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.snapshot).toBeNull()
    expect(mocks.batteries).not.toHaveBeenCalled()
  })
  it('no transforma un fallo del cierre en una batería pendiente; permite reintentar', async () => {
    mocks.completion.mockRejectedValue(new ApiError({ message: 'unavailable', status: 503 }))
    const { result } = setup()
    await waitFor(() => expect(result.current.programState).toBe('recoverable'))
    expect(result.current.isError).toBe(true)
    expect(mocks.batteries).not.toHaveBeenCalled()
    mocks.completion.mockResolvedValue({ completion })
    await act(async () => { result.current.refetch() })
    await waitFor(() => expect(result.current.programState).toBe('completed'))
  })
  it('una inscripción activa evita consultar o presentar el cierre anterior', async () => {
    mocks.snapshot.mockResolvedValue({ enrollmentId: 'new-active', todayTasks: [] })
    const { result } = setup()
    await waitFor(() => expect(result.current.snapshot?.enrollmentId).toBe('new-active'))
    expect(result.current.completion).toBeNull()
    expect(mocks.completion).not.toHaveBeenCalled()
  })
  it('retira el snapshot almacenado cuando el servidor confirma que ya no está activo', async () => {
    mocks.snapshot.mockResolvedValueOnce({ enrollmentId: 'old-active', todayTasks: [] }).mockRejectedValue(absent())
    mocks.completion.mockResolvedValue({ completion })
    const { result } = setup()
    await waitFor(() => expect(result.current.snapshot?.enrollmentId).toBe('old-active'))
    await act(async () => { result.current.refetch() })
    await waitFor(() => expect(result.current.programState).toBe('completed'))
    expect(result.current.snapshot).toBeNull()
  })
})
describe('asignación post-tests', () => {
  it.each([0, 3, 8])('%i/9 deja el plan pendiente sin inscribir', async n => {
    mocks.assignments.mockResolvedValue(assignments(n))
    const { result } = setup()
    await waitFor(() => expect(result.current.programState).toBe('pending-tests'))
    expect(result.current.snapshot).toBeNull()
    expect(mocks.enroll).not.toHaveBeenCalled()
  })
  it('9/9 espera confirmación y refetch detecta la semana activa', async () => {
    mocks.assignments.mockResolvedValue(assignments(9))
    const { result } = setup()
    await waitFor(() => expect(result.current.programState).toBe('pending-assignment'))
    expect(result.current.snapshot).toBeNull()
    mocks.snapshot.mockResolvedValue({ enrollmentId: 'active', todayTasks: [] })
    await act(async () => { result.current.refetch() })
    await waitFor(() => expect(result.current.programState).toBe('active'))
    expect(result.current.snapshot?.enrollmentId).toBe('active')
    expect(mocks.enroll).not.toHaveBeenCalled()
  })
  it('snapshot existente conserva el flujo normal sin requerir batería', async () => {
    mocks.snapshot.mockResolvedValue({ enrollmentId: 'existing', todayTasks: [] })
    const { result } = setup()
    await waitFor(() => expect(result.current.snapshot?.enrollmentId).toBe('existing'))
    expect(mocks.batteries).not.toHaveBeenCalled()
  })
  it('un 404 diferente no se confunde con espera clínica', async () => {
    mocks.snapshot.mockRejectedValue(new ApiError({ message: 'Missing', status: 404, code: 'OTHER', errorType: 'business' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.programState).toBe('recoverable'))
    expect(result.current.snapshot).toBeNull()
    expect(mocks.batteries).not.toHaveBeenCalled()
  })
  it('explica la traducción no disponible y permite reintentar sin inventar una asignación', async () => {
    mocks.snapshot.mockRejectedValue(new ApiError({ message: 'English content unavailable', status: 503, code: 'CONTENT_TRANSLATION_UNAVAILABLE' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.programState).toBe('recoverable'), { timeout: 6000 })
    expect(result.current.productMessage).toBe('No pudimos preparar este contenido en inglés. Vuelve a intentarlo.')
    expect(result.current.snapshot).toBeNull()
    expect(mocks.batteries).not.toHaveBeenCalled()
    mocks.snapshot.mockResolvedValue({ enrollmentId: 'active', todayTasks: [] })
    await act(async () => { result.current.refetch() })
    await waitFor(() => expect(result.current.programState).toBe('active'))
  })
  it('la carga de batería no muestra tareas', async () => {
    mocks.batteries.mockReturnValue(new Promise(() => {}))
    const { result } = setup()
    await waitFor(() => expect(mocks.batteries).toHaveBeenCalled())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.snapshot).toBeNull()
  })
  it('un error de batería no inventa completitud y permite reintentar', async () => {
    mocks.batteries.mockRejectedValue(new Error('offline'))
    const { result } = setup()
    await waitFor(() => expect(result.current.programState).toBe('recoverable'))
    expect(result.current.snapshot).toBeNull()
    mocks.batteries.mockResolvedValue([battery])
    await act(async () => { result.current.refetch() })
    await waitFor(() => expect(result.current.programState).toBe('pending-tests'))
  })
  it('no cuenta otros tests, duplicados ni otras baterías', () => {
    const items = assignments(8)
    items.push(items[0], { ...items[0], testCode: 'optional' }, { ...assignments(9)[8], batteryAssignmentId: 'other' })
    expect(initialBatteryCompletedCount([battery], items)).toBe(8)
    expect(initialBatteryCompletedCount([], assignments(9))).toBe(0)
  })
})

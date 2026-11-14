import type { ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../i18n/I18nContext'
import { programKeys } from '../../hooks/queryKeys'
import type { ProgramSnapshotDto } from '../../services/program/types'
import { DailyProtocolReminder } from '../DailyProtocolReminder'

const api = vi.hoisted(() => ({ snapshot: vi.fn() }))
vi.mock('../../services/program/program-service', () => ({ getSnapshot: api.snapshot }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ flow: 'app', screen: 'home',
  panicOpen: false, voiceOpen: false, realMode: true, user: { nombre: 'Ana' }, navigate: vi.fn() }) }))
vi.mock('@ionic/react', () => ({ IonIcon: () => null,
  IonButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  IonModal: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) => isOpen ? <div role="dialog">{children}</div> : null,
}))
const clients: QueryClient[] = []
function setup(snapshot?: ProgramSnapshotDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  if (snapshot) client.setQueryData(programKeys.snapshot, snapshot)
  render(<QueryClientProvider client={client}><I18nProvider><DailyProtocolReminder /></I18nProvider></QueryClientProvider>)
  return client
}
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); localStorage.clear() })

describe('2.24b · observador real del snapshot en Inicio', () => {
  it.each([true, false])('observa un día con rest=%s sin avisos de queryFn ni peticiones adicionales', rest => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const snapshot = { enrollmentId: crypto.randomUUID(), todayLocalDate: '2026-11-14', rest,
      template: { currentWeekStatus: 'Active' }, todayTasks: [
        { taskCode: 'podcast', status: 'Pending' }, { taskCode: 'nut', status: 'Pending' },
        ...(!rest ? [{ taskCode: 'ejercicio', status: 'Pending' }] : []),
      ] } as ProgramSnapshotDto
    const client = setup(snapshot)
    act(() => { void client.invalidateQueries({ queryKey: programKeys.snapshot }); vi.advanceTimersByTime(12_000) })
    expect(screen.getByRole('dialog').textContent).toContain(`Tienes ${rest ? 2 : 3} actividades pendientes`)
    expect(client.getQueryData(programKeys.snapshot)).toEqual(snapshot)
    expect(api.snapshot).not.toHaveBeenCalled()
    expect([...errors.mock.calls, ...warnings.mock.calls].flat().filter(value => String(value).includes('No queryFn'))).toEqual([])
  })

  it('sin snapshot no consulta ni muestra recordatorio y reacciona al poblar la caché', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = setup()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.snapshot).not.toHaveBeenCalled()
    act(() => {
      client.setQueryData(programKeys.snapshot, { enrollmentId: crypto.randomUUID(), todayLocalDate: '2026-11-14',
        rest: true, template: { currentWeekStatus: 'Active' }, todayTasks: [{ taskCode: 'nut', status: 'Pending' }] })
      vi.advanceTimersByTime(0)
    })
    act(() => vi.advanceTimersByTime(12_000))
    expect(screen.getByRole('dialog').textContent).toContain('Tienes 1 actividades pendientes')
    expect(errors.mock.calls.flat().filter(value => String(value).includes('No queryFn'))).toEqual([])
    expect(api.snapshot).not.toHaveBeenCalled()
  })
})

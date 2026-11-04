import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { ProgramSnapshotDto } from '../../services/program/types'
import { DailyProtocolReminder } from '../DailyProtocolReminder'

const state = vi.hoisted(() => ({ app: { flow: 'app', screen: 'home', panicOpen: false, voiceOpen: false, realMode: true, user: { nombre: 'Luis de prueba' }, navigate: vi.fn() }, snapshot: null as ProgramSnapshotDto | null }))
vi.mock('../../context/AppContext', () => ({ useApp: () => state.app }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: state.snapshot }) }))
vi.mock('../../i18n/I18nContext', () => ({ useT: () => (s: string, p?: Record<string, string>) => s.replace(/\{([^}]+)\}/g, (match, key) => p?.[key] ?? match) }))
vi.mock('@ionic/react', () => ({ IonIcon: () => null, IonButton: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>, IonModal: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) => isOpen ? <div role="dialog">{children}</div> : null }))

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); state.app.navigate.mockClear()
  Object.assign(state.app, { flow: 'app', screen: 'home', panicOpen: false, voiceOpen: false, realMode: true })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  state.snapshot = { enrollmentId: crypto.randomUUID(), todayLocalDate: '2026-11-03', template: { currentWeekStatus: 'Active' }, todayTasks: [{ taskCode: 'nutraceutico', status: 'Pending' }] } as ProgramSnapshotDto
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('recordatorio de protocolo diario', () => {
  it('espera, personaliza y permite abrir el protocolo sin completar tareas', () => {
    render(<DailyProtocolReminder />)
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => vi.advanceTimersByTime(12_000))
    expect(screen.getByText('Tu salud te espera, Luis')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar mi protocolo' }))
    expect(state.app.navigate).toHaveBeenCalledWith('prog')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('no repite el aviso de la misma inscripción y fecha al volver a entrar', () => {
    const view = render(<DailyProtocolReminder />)
    act(() => vi.advanceTimersByTime(12_000))
    fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }))
    view.unmount(); render(<DailyProtocolReminder />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('respeta una emergencia activa y solo empieza a contar cuando termina', () => {
    state.app.panicOpen = true
    const view = render(<DailyProtocolReminder />)
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.queryByRole('dialog')).toBeNull()
    state.app.panicOpen = false; view.rerender(<DailyProtocolReminder />)
    act(() => vi.advanceTimersByTime(12_000))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it.each(['sin pendientes', 'sin conexión real', 'en consulta', 'fallback'])('no molesta: %s', scenario => {
    if (scenario === 'sin pendientes') state.snapshot!.todayTasks = []
    if (scenario === 'sin conexión real') state.app.realMode = false
    if (scenario === 'en consulta') state.app.screen = 'room'
    if (scenario === 'fallback') state.snapshot!.enrollmentId = 'mock-enrollment'
    render(<DailyProtocolReminder />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

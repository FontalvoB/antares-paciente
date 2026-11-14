import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../i18n/I18nContext'
import type { ProgramSnapshotDto } from '../../services/program/types'
import { ProgramPage } from '../ProgramPage'
import { HomePage } from '../HomePage'
import { TodayView } from '../program/TodayView'

const state = vi.hoisted(() => ({
  screen: 'prog', snapshot: null as ProgramSnapshotDto | null,
  complete: vi.fn(), completeStep: vi.fn(), navigate: vi.fn(), header: vi.fn(),
}))
vi.mock('../../hooks/useProgram', () => ({ useProgram: () => ({ snapshot: state.snapshot,
  isLoading: false, isRefreshing: false, programState: 'active', productMessage: null,
  initialAssessmentsCompleted: 9, refetch: vi.fn() }) }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ screen: state.screen,
  program: { ejercicio: true }, pointsToday: 999, pointsTotal: 999, realMode: true,
  completeStep: state.completeStep, navigate: state.navigate, openTests: vi.fn(),
  openPanic: vi.fn(), openVoice: vi.fn(), showToast: vi.fn(), streak: 0, programWeek: 1,
  weekCheckins: [], user: { nombre: 'QA Patient', id: 'qa' }, wearableConnected: false }) }))
vi.mock('../../context/WearableContext', () => ({ useWearable: () => ({ today: {}, samples: {} }) }))
vi.mock('../../hooks/useCompleteTask', () => ({ useCompleteTask: () => ({ isPending: false, completeTask: state.complete }), applyOptimistic: (value: unknown) => value }))
vi.mock('../../hooks/useProgramScores', () => ({ useProgramScores: () => ({ scores: undefined, isLoading: false, isError: false, refetch: vi.fn() }) }))
vi.mock('../../hooks/useProgramCalendar', () => ({ useProgramCalendar: () => ({ data: { days: [] } }) }))
vi.mock('../../hooks/useStreakChests', () => ({ useStreakChests: () => ({ chests: [] }) }))
vi.mock('../../hooks/useMetricsHistory', () => ({ useMetricsHistory: () => ({ history: null, isLoading: false }) }))
vi.mock('../../hooks/useScoresHistory', () => ({ useScoresHistory: () => ({ history: null, isLoading: false }) }))
vi.mock('../../hooks/useNotifications', () => ({ useNotifications: () => ({ unreadCount: 0 }) }))
vi.mock('../../components/notifications/NotificationsModal', () => ({ NotificationsModal: () => null }))
vi.mock('../../components/MetricHistoryModal', () => ({ MetricHistoryModal: () => null }))
vi.mock('../../components/Mascot', () => ({ Mascot: () => null }))
vi.mock('../../components/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>, Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../program/visuals', async original => ({ ...(await original<typeof import('../program/visuals')>()), CountUp: ({ to }: { to: number }) => <>{to}</> }))
vi.mock('../program/ProgramHeader', async original => {
  const { ProgramHeader } = await original<typeof import('../program/ProgramHeader')>()
  return { ProgramHeader: (props: Parameters<typeof ProgramHeader>[0]) => {
    state.header(props)
    return <ProgramHeader {...props} />
  } }
})
vi.mock('@ionic/react', async original => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonIcon: () => null, IonModal: () => null, IonPopover: () => null,
  IonSegment: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonSegmentButton: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonButton: ({ children, onClick, disabled, className, 'aria-label': label }: ButtonHTMLAttributes<HTMLButtonElement>) =>
    <button className={className} onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
}))

/** Fixture de RestCompletionPostgresTests (2.4): podcast 10 + nutrición 10 + bonus 50. */
function restSnapshot(completeAll = false): ProgramSnapshotDto {
  return {
    enrollmentId: 'rest-2.4', todayLocalDate: '2026-11-03', rest: true,
    template: { currentWeekNumber: 1, totalWeeks: 12, currentWeekStartDateLocal: '2026-11-02', currentWeekEndDateLocal: '2026-11-08' },
    todayTasks: [
      { taskCode: 'podcast', title: 'Escuchar podcast', short: '', points: 10, status: 'Completed', content: null },
      { taskCode: 'nut', title: 'Cumplir plan nutricional', short: '', points: 10, status: completeAll ? 'Completed' : 'Pending', content: null },
    ],
    todayPoints: completeAll ? 70 : 10, todayPointsMax: 70,
    dailyBonusAmount: 50, todayBonusAvailable: !completeAll,
    xp: { balance: completeAll ? 70 : 10 }, streak: { current: completeAll ? 2 : 1 },
    calendar: [], upcoming: [],
  } as unknown as ProgramSnapshotDto
}

const clients: QueryClient[] = []
function setup(home = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const content = () => <QueryClientProvider client={client}><I18nProvider>{home ? <HomePage /> : <ProgramPage />}</I18nProvider></QueryClientProvider>
  const result = render(content())
  return { ...result, refresh: () => result.rerender(content()) }
}
beforeEach(() => { localStorage.clear(); state.snapshot = restSnapshot(); state.screen = 'prog' })
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); localStorage.clear() })

describe('2.24 · descanso y verdad del backend', () => {
  it.each([false, true])('conserva XP, máximo 70 y tareas exigibles de la fixture 2.4, completo=%s', completeAll => {
    state.snapshot = restSnapshot(completeAll)
    const { container } = setup()
    expect(state.header).toHaveBeenLastCalledWith(expect.objectContaining({
      pointsToday: completeAll ? 70 : 10, pointsMax: 70,
      doneCount: completeAll ? 2 : 1, total: 2,
    }))
    if (!completeAll) expect(screen.getByText(/10\s*\/\s*70 XP/)).toBeTruthy()
    expect(container.querySelectorAll('button.pcard')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Hacer ejercicio/ })).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Hoy descansas del ejercicio')
    expect(container.querySelectorAll('button.pcard.done')).toHaveLength(completeAll ? 2 : 1)
    if (completeAll) expect(screen.getByText('Bonus del día desbloqueado')).toBeTruthy()
    else {
      expect(screen.getByText('Completa las 2 misiones')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Cumplir plan nutricional, siguiente' })).toBeTruthy()
    }
    expect(state.complete).not.toHaveBeenCalled()
    expect(state.completeStep).not.toHaveBeenCalled()
  })

  it('Inicio no conserva el acceso residual y solo cuenta tareas y bonus reales', () => {
    state.snapshot = restSnapshot(true)
    const { container } = setup(true)
    expect(screen.queryByRole('button', { name: /Hacer ejercicio/ })).toBeNull()
    expect(container.querySelectorAll('.wheel-badge')).toHaveLength(3)
    expect(container.querySelector('.wheel-core-count')?.textContent).toBe('3/3')
    fireEvent.click(screen.getByRole('button', { name: 'Cumplir plan nutricional' }))
    expect(state.navigate).toHaveBeenCalledWith('program-nut')
  })

  it('una apertura directa de Ejercicio muestra descanso sin misión, puntos, rutina o completación', () => {
    state.screen = 'program-ejercicio'
    const { container } = setup()
    expect(screen.getByRole('status').textContent).toContain('Hoy descansas del ejercicio')
    expect(container.querySelector('.lesson-sheet-head')?.textContent).toContain('Descanso de ejercicio')
    expect(container.querySelector('.lesson-sheet-head')?.textContent).not.toMatch(/Misión|150|estaciones/)
    expect(screen.queryByText('Rutina no disponible')).toBeNull()
    expect(screen.queryByRole('button', { name: /Ya lo hice|Iniciar circuito|Saltar estación/ })).toBeNull()
    expect(state.complete).not.toHaveBeenCalled()
  })

  it('no restaura tareas ficticias cuando el servidor envía un día vacío con máximo cero', () => {
    state.snapshot = { ...restSnapshot(), todayTasks: [], todayPoints: 0, todayPointsMax: 0 }
    const { container } = setup()
    expect(screen.getByText(/0\s*\/\s*0 XP/)).toBeTruthy()
    expect(container.querySelectorAll('button.pcard')).toHaveLength(0)
    expect(screen.queryByText('Cofre del día')).toBeNull()
    expect(screen.queryByText('Día perfecto')).toBeNull()
  })

  it('el descanso explícito gana sobre un ejercicio contradictorio o en caché', () => {
    const value = restSnapshot()
    const exercise = { taskCode: 'ejercicio', title: 'Hacer ejercicio del día', points: 150, status: 'Completed' } as ProgramSnapshotDto['todayTasks'][number]
    render(<I18nProvider><TodayView program={{ podcast: true, nut: false, ejercicio: true, vitals: false, nutraceutico: false, emocional: false }}
      todayTasks={[...value.todayTasks, exercise]} rest allDone={false} first="Ana" programWeek={1}
      todayBonusAvailable dailyBonusAmount={50} onOpenTask={vi.fn()} onGoEvo={vi.fn()} onGoChat={vi.fn()} /></I18nProvider>)
    expect(screen.queryByRole('button', { name: /Hacer ejercicio/ })).toBeNull()
    expect(screen.getByText('Completa las 2 misiones')).toBeTruthy()
  })

  it('detiene el cronómetro al recibir descanso sin completar ni encolar ejercicio', () => {
    state.screen = 'program-ejercicio'
    state.snapshot = { ...restSnapshot(), rest: undefined, todayTasks: [{ taskCode: 'ejercicio', title: 'Movimiento', points: 10, status: 'Pending', content: {
      exercises: [{ name: 'Estación', durationSecs: 100 }],
    } }] } as ProgramSnapshotDto
    const view = setup()
    vi.useFakeTimers()
    fireEvent.click(screen.getByText('Iniciar circuito'))
    act(() => vi.advanceTimersByTime(1000))
    state.snapshot = restSnapshot()
    view.refresh()
    act(() => vi.advanceTimersByTime(200_000))
    expect(screen.getByRole('status').textContent).toContain('Hoy descansas del ejercicio')
    expect(view.container.querySelector('.ex-clock')).toBeNull()
    expect(state.complete).not.toHaveBeenCalled()
    expect(state.completeStep).not.toHaveBeenCalled()
  })

  it('traduce el descanso sin cambiar puntos o identidad del día', () => {
    localStorage.setItem('antares_lang', 'en')
    state.screen = 'program-ejercicio'
    setup()
    expect(screen.getByRole('status').textContent).toContain('Today is your exercise rest day')
    expect(state.snapshot?.todayPointsMax).toBe(70)
    expect(state.snapshot?.todayLocalDate).toBe('2026-11-03')
  })
})

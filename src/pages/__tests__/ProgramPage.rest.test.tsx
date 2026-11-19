import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../i18n/I18nContext'
import type { ProgramSnapshotDto } from '../../services/program/types'
import { ProgramPage } from '../ProgramPage'
import { HomePage } from '../HomePage'
import { TodayView } from '../program/TodayView'

const state = vi.hoisted(() => ({
  screen: 'prog', snapshot: null as ProgramSnapshotDto | null,
  complete: vi.fn(), completeStep: vi.fn(), navigate: vi.fn(), header: vi.fn(), toast: vi.fn(),
}))
vi.mock('../../hooks/useProgram', () => ({ useProgram: () => ({ snapshot: state.snapshot,
  isLoading: false, isRefreshing: false, programState: 'active', productMessage: null,
  initialAssessmentsCompleted: 9, refetch: vi.fn() }) }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ screen: state.screen,
  program: { ejercicio: true }, pointsToday: 999, pointsTotal: 999, realMode: true,
  completeStep: state.completeStep, navigate: state.navigate, openTests: vi.fn(),
  openPanic: vi.fn(), openVoice: vi.fn(), showToast: state.toast, streak: 0, programWeek: 1,
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
  IonBadge: ({ children, className }: { children: ReactNode; className?: string }) => <span className={className}>{children}</span>,
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
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); state.snapshot = restSnapshot(); state.screen = 'prog' })
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); localStorage.clear() })

describe('Protocolo diario · tareas activas y descanso', () => {
  it.each([false, true])('excluye podcast del progreso y de los XP del día, completo=%s', completeAll => {
    state.snapshot = restSnapshot(completeAll)
    const { container } = setup()
    expect(state.header).toHaveBeenLastCalledWith(expect.objectContaining({
      pointsToday: completeAll ? 60 : 0, pointsMax: 60,
      doneCount: completeAll ? 1 : 0, total: 1,
    }))
    if (!completeAll) expect(screen.getByText(/0\s*\/\s*60 XP/)).toBeTruthy()
    expect(container.querySelectorAll('button.pcard')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Ejercicios, Próximamente' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Hoy descansas del ejercicio')
    expect(container.querySelectorAll('button.pcard.done')).toHaveLength(completeAll ? 1 : 0)
    if (completeAll) expect(screen.getByText('Bonus del día desbloqueado')).toBeTruthy()
    else {
      expect(screen.getByText('Completa las 1 misiones')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Cumplir plan nutricional, siguiente' })).toBeTruthy()
    }
    expect(state.complete).not.toHaveBeenCalled()
    expect(state.completeStep).not.toHaveBeenCalled()
  })

  it('Inicio no conserva el acceso residual y solo cuenta tareas y bonus reales', () => {
    state.snapshot = restSnapshot(true)
    const { container } = setup(true)
    expect(screen.queryByRole('button', { name: /Hacer ejercicio/ })).toBeNull()
    expect(container.querySelectorAll('.wheel-badge')).toHaveLength(2)
    expect(container.querySelector('.wheel-core-count')?.textContent).toBe('2/2')
    fireEvent.click(screen.getByRole('button', { name: 'Cumplir plan nutricional' }))
    expect(state.navigate).toHaveBeenCalledWith('program-nut')
  })

  it('Inicio muestra 0/5 con cuatro tareas activas y el cofre aunque las dos pausadas figuren completadas', () => {
    const value = restSnapshot()
    const pendingTasks = (['vitals', 'nut', 'nutraceutico', 'emocional'] as const).map(taskCode => ({
      taskCode, title: taskCode, short: '', points: 10, status: 'Pending' as const, completedAt: null,
    }))
    state.snapshot = { ...value, rest: false, todayTasks: [
      value.todayTasks[0], ...pendingTasks,
      { taskCode: 'ejercicio', title: 'Ejercicios', short: '', points: 10, status: 'Completed', completedAt: value.todayLocalDate },
    ] }
    const { container } = setup(true)
    expect(container.querySelector('.wheel-core-count')?.textContent).toBe('0/5')
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(0)
  })

  it.each(['program-ejercicio', 'program-podcast'])('una apertura directa de %s se queda en el protocolo', route => {
    state.screen = route
    const { container } = setup()
    expect(screen.getByRole('status').textContent).toContain('Hoy descansas del ejercicio')
    expect(container.querySelector('.lesson-sheet-head')).toBeNull()
    expect(screen.queryByText('Rutina no disponible')).toBeNull()
    expect(screen.queryByRole('button', { name: /Ya lo hice|Iniciar circuito|Saltar estación/ })).toBeNull()
    expect(state.complete).not.toHaveBeenCalled()
  })

  it('no restaura tareas ficticias cuando el servidor envía un día vacío con máximo cero', () => {
    state.snapshot = { ...restSnapshot(), todayTasks: [], todayPoints: 0, todayPointsMax: 0 }
    const { container } = setup()
    expect(screen.getByText(/0\s*\/\s*0 XP/)).toBeTruthy()
    expect(container.querySelectorAll('button.pcard')).toHaveLength(2)
    expect(container.querySelectorAll('.pcard-coming-soon')).toHaveLength(2)
    expect(screen.queryByText('Cofre del día')).toBeNull()
    expect(screen.queryByText('Día perfecto')).toBeNull()
  })

  it('el descanso conserva el badge y excluye un ejercicio completado en caché', () => {
    const value = restSnapshot()
    const exercise = { taskCode: 'ejercicio', title: 'Hacer ejercicio del día', points: 150, status: 'Completed' } as ProgramSnapshotDto['todayTasks'][number]
    render(<I18nProvider><TodayView program={{ podcast: true, nut: false, ejercicio: true, vitals: false, nutraceutico: false, emocional: false }}
      todayTasks={[...value.todayTasks, exercise]} rest allDone={false} first="Ana" programWeek={1}
      todayBonusAvailable dailyBonusAmount={50} onOpenTask={vi.fn()} onGoEvo={vi.fn()} onGoChat={vi.fn()} /></I18nProvider>)
    const card = screen.getByRole('button', { name: 'Ejercicios, Próximamente' })
    expect(card.classList.contains('done')).toBe(false)
    expect(card.querySelector('.pcard-pts')).toBeNull()
  })

  it('no promete una racha ni un cofre cuando el servidor aún no los confirma', () => {
    state.snapshot = { ...restSnapshot(true), todayBonusAvailable: true }
    setup()
    expect(state.header).toHaveBeenLastCalledWith(expect.objectContaining({ doneCount: 1, total: 1, allDone: false }))
    expect(screen.getByText('Bonus pendiente de confirmación')).toBeTruthy()
    expect(screen.queryByText('Día perfecto')).toBeNull()
  })

  it.each([
    ['es', 'Podcast, Próximamente', 'Ejercicios, Próximamente', 'Esta actividad estará disponible próximamente.'],
    ['en', 'Podcast, Coming soon', 'Exercises, Coming soon', 'This activity will be available soon.'],
  ])('ordena las tarjetas y muestra un aviso sin navegar ni completar en %s', (lang, podcast, exercises, message) => {
    localStorage.setItem('antares_lang', lang)
    const { container } = setup()
    expect(document.documentElement.lang).toBe(lang)
    const cards = Array.from(container.querySelectorAll('button.pcard'))
    expect(cards.slice(-2)).toEqual([screen.getByRole('button', { name: podcast }), screen.getByRole('button', { name: exercises })])
    expect(cards[0].classList.contains('current')).toBe(true)
    for (const card of cards.slice(-2)) {
      expect(card.querySelector('.pcard-chevron, .pcard-pts')).toBeNull()
      fireEvent.click(card)
    }
    expect(state.toast.mock.calls).toEqual([[message, 'info'], [message, 'info']])
    expect(state.navigate).not.toHaveBeenCalled()
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider, useI18n } from '../../i18n/I18nContext'
import { LanguageQuerySync } from '../../components/LanguageQuerySync'
import { programKeys } from '../../hooks/queryKeys'
import { ApiError } from '../../utils/apiClient'
import { requestLanguage } from '../../utils/requestLanguage'
import { ProgramPage } from '../ProgramPage'
import type { ProgramSnapshotDto } from '../../services/program/types'

const state = vi.hoisted(() => ({ screen: 'program-vitals', load: vi.fn(), complete: vi.fn() }))
vi.mock('../../services/program/program-service', () => ({ getSnapshot: state.load }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ screen: state.screen, program: {}, completeStep: vi.fn(), pointsToday: 0, navigate: vi.fn(), openTests: vi.fn(), showToast: vi.fn(), streak: 0, programWeek: 1, weekCheckins: [], user: { nombre: 'QA Patient', id: 'qa' }, wearableConnected: false }) }))
vi.mock('../../context/WearableContext', () => ({ useWearable: () => ({ samples: {}, today: {}, info: {}, device: null, phase: 'idle', sessionStale: false, lastSyncAt: null, syncing: false, syncHistory: vi.fn() }) }))
vi.mock('../../hooks/useCompleteTask', () => ({ useCompleteTask: () => ({ isPending: false, completeTask: state.complete }), applyOptimistic: (value: unknown) => value }))
vi.mock('../../hooks/useProgramScores', () => ({ useProgramScores: () => ({ scores: undefined, isLoading: false, isError: false, refetch: vi.fn() }) }))
vi.mock('../../hooks/useProgramCalendar', () => ({ useProgramCalendar: () => ({ data: { days: [] } }) }))
vi.mock('../../hooks/useStreakChests', () => ({ useStreakChests: () => ({ chests: [] }) }))
vi.mock('../../components/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>, Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('framer-motion', () => ({ AnimatePresence: ({ children }: { children: ReactNode }) => children, motion: { div: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div> } }))
vi.mock('@ionic/react', () => {
  const Wrap = ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>
  return {
    IonButton: ({ children, onClick, disabled, className, 'aria-label': label, 'aria-pressed': pressed }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string; 'aria-label'?: string; 'aria-pressed'?: boolean }) => <button className={className} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={pressed}>{children}</button>,
    IonInput: ({ label, value, disabled, onIonInput }: { label: string; value: string; disabled?: boolean; onIonInput: (event: { detail: { value: string } }) => void }) => <label>{label}<input value={value ?? ''} disabled={disabled} onChange={event => onIonInput({ detail: { value: event.target.value } })} /></label>,
    IonTextarea: ({ label, value, className, onIonInput }: { label: string; value: string; className?: string; onIonInput: (event: { detail: { value: string } }) => void }) => <label>{label}<textarea className={className} value={value} onChange={event => onIonInput({ detail: { value: event.target.value } })} /></label>,
    IonRange: ({ value, 'aria-label': label }: { value: number; 'aria-label'?: string }) => <input aria-label={label} type="range" value={value} readOnly />,
    IonIcon: () => null, IonSpinner: () => <span role="status" />,
    IonModal: () => null, IonProgressBar: () => null,
    IonChip: Wrap, IonSegment: Wrap, IonSegmentButton: Wrap, IonAccordionGroup: Wrap, IonAccordion: Wrap, IonItem: Wrap, IonLabel: Wrap, IonCard: Wrap, IonCardContent: Wrap, IonSkeletonText: Wrap,
  }
})
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const snapshot = (english = false) => ({
  enrollmentId: 'enrollment', todayLocalDate: '2026-11-06', template: { currentWeekNumber: 1, totalWeeks: 24, currentWeekStartDateLocal: '2026-11-02' },
  todayTasks: [
    { taskCode: 'vitals', title: english ? 'Record vitals' : 'Medir signos', status: 'Pending', points: 100, content: {} },
    { taskCode: 'emocional', title: english ? 'Emotional check-in' : 'Registro emocional', status: 'Pending', points: 50, content: {} },
    { taskCode: 'ejercicio', title: english ? 'Daily movement' : 'Movimiento diario', status: 'Pending', points: 150, content: { exerciseRoutineName: english ? 'English routine' : 'Rutina española', exercises: [{ name: english ? 'First station' : 'Primera estación', durationSecs: 5 }, { name: english ? 'Second station' : 'Segunda estación', durationSecs: 10 }] } },
    { taskCode: 'podcast', title: english ? 'Podcast' : 'Escuchar podcast', status: 'Pending', points: 80, content: { title: english ? 'English episode' : 'Episodio español', mediaUrl: 'https://example.invalid/qa.mp3', durationSecs: 100 } },
  ], streak: { current: 0 }, streakChests: [],
} as unknown as ProgramSnapshotDto)
const clients: QueryClient[] = []
function ChangeLanguage() { const { setLang } = useI18n(); return <button onClick={() => setLang('en')}>Switch English</button> }
function setup(lesson: string) {
  state.screen = `program-${lesson}`
  const english = deferred<ProgramSnapshotDto>()
  state.load.mockImplementation(() => requestLanguage() === 'en' ? english.promise : new Promise(() => {}))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(programKeys.snapshot, snapshot()); clients.push(client)
  const view = render(<QueryClientProvider client={client}><I18nProvider><LanguageQuerySync /><ChangeLanguage /><ProgramPage /></I18nProvider></QueryClientProvider>)
  return { english, client, ...view }
}
beforeEach(() => { localStorage.setItem('antares_lang', 'es'); state.complete.mockClear(); state.load.mockReset() })
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })
describe('actual ProgramPage during language refresh', () => {
  it('keeps the VitalsLesson input instance and unsaved measurement throughout the new request', async () => {
    const view = setup('vitals')
    const input = view.container.querySelector('.vitals-record input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '88' } })
    fireEvent.click(screen.getByText('Switch English'))
    await waitFor(() => expect(state.load).toHaveBeenCalledTimes(2))
    expect(view.container.querySelector('.vitals-record input')).toBe(input)
    expect(input.value).toBe('88')
    await act(async () => view.english.resolve(snapshot(true)))
    await screen.findByText('Record vitals')
    expect(view.container.querySelector('.vitals-record input')).toBe(input)
    expect(input.value).toBe('88')
    expect(state.complete).not.toHaveBeenCalled()
  })
  it('keeps a cached lesson draft beside a truthful retry notice if translation fails', async () => {
    const view = setup('vitals')
    const input = view.container.querySelector('.vitals-record input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '92' } })
    state.load.mockRejectedValue(new ApiError({ status: 503, code: 'CONTENT_TRANSLATION_UNAVAILABLE', message: 'English content could not be prepared.' }))
    fireEvent.click(screen.getByText('Switch English'))
    await screen.findByText("We couldn't prepare this content in English. Please try again.", {}, { timeout: 6000 })
    expect(view.container.querySelector('.vitals-record input')).toBe(input)
    expect(input.value).toBe('92')
    expect(screen.getByText('Retry')).toBeTruthy()
    expect(state.complete).not.toHaveBeenCalled()
  })
  it('retains emotional mood, manual sleep and the actual note field', async () => {
    const view = setup('emocional')
    fireEvent.click(screen.getByRole('button', { name: 'Bien' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar mis horas' }))
    fireEvent.change(screen.getByLabelText('Horas de sueño'), { target: { value: '7.5' } })
    fireEvent.click(screen.getByText('Aplicar'))
    const note = view.container.querySelector('.emotion-note') as HTMLTextAreaElement
    fireEvent.change(note, { target: { value: 'My unsaved personal note' } })
    fireEvent.click(screen.getByText('Switch English'))
    await waitFor(() => expect(state.load).toHaveBeenCalledTimes(2))
    expect(view.container.querySelector('.emotion-note')).toBe(note)
    expect(note.value).toBe('My unsaved personal note')
    await act(async () => view.english.resolve(snapshot(true)))
    await screen.findByText('Emotional check-in')
    expect(view.container.querySelector('.emotion-note')).toBe(note)
    expect(note.value).toBe('My unsaved personal note')
    expect(screen.getByRole('button', { name: 'Good' }).getAttribute('aria-pressed')).toBe('true')
    expect(view.container.querySelector('.emotion-duration')?.textContent).toBe('7 h 30 min')
  })
  it('keeps exercise stations and running timer instead of completing against an empty routine', async () => {
    const view = setup('ejercicio')
    await waitFor(() => expect(state.load).toHaveBeenCalledTimes(1))
    vi.useFakeTimers()
    fireEvent.click(screen.getByText('Iniciar circuito'))
    act(() => vi.advanceTimersByTime(2000))
    expect(view.container.querySelector('.ex-clock')?.textContent).toBe('00:03')
    fireEvent.click(screen.getByText('Switch English'))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(state.load).toHaveBeenCalledTimes(2)
    act(() => vi.advanceTimersByTime(3000))
    act(() => vi.advanceTimersByTime(1000))
    expect(view.container.querySelector('.ex-ring-center .kicker')?.textContent).toBe('2 / 2')
    expect(view.container.querySelector('.ex-clock')?.textContent).toBe('00:09')
    expect(state.complete).not.toHaveBeenCalled()
    await act(async () => { view.english.resolve(snapshot(true)); await vi.advanceTimersByTimeAsync(1) })
    expect(view.container.querySelector('.ex-clock')?.textContent).toBe('00:09')
    expect(view.container.querySelector('.ex-step-name')?.textContent).toBe('Second station')
  })
  it('preserves the same audio instance, playback and elapsed progress when the URL is unchanged', async () => {
    const audios: Array<{ src: string; currentTime: number; duration: number; pause: ReturnType<typeof vi.fn>; ontimeupdate?: () => void; onplay?: () => void }> = []
    vi.stubGlobal('Audio', class {
      src: string; currentTime = 0; duration = 100; ontimeupdate?: () => void; onplay?: () => void
      pause = vi.fn(); play = vi.fn(async () => { this.onplay?.() })
      constructor(url: string) { this.src = url; audios.push(this) }
    })
    const view = setup('podcast')
    fireEvent.click(view.container.querySelector('.pod-play')!)
    const audio = audios[0]
    act(() => { audio.currentTime = 40; audio.ontimeupdate?.() })
    expect(view.container.querySelector('.pod-times')?.textContent).toContain('00:40')
    fireEvent.click(screen.getByText('Switch English'))
    await waitFor(() => expect(state.load).toHaveBeenCalledTimes(2))
    expect(view.container.querySelector('.pod-times')?.textContent).toContain('00:40')
    await act(async () => view.english.resolve(snapshot(true)))
    await screen.findByText('English episode')
    expect(audios).toHaveLength(1)
    expect(audio.pause).not.toHaveBeenCalled()
    expect(view.container.querySelector('.pod-times')?.textContent).toContain('00:40')
    expect(view.container.querySelector('.pod-play')?.textContent).toContain('Pause')
  })
})

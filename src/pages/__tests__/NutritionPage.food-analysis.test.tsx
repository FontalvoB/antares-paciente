import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../i18n/I18nContext'
import { ApiError } from '../../utils/apiClient'
import type { ProgramSnapshotDto } from '../../services/program/types'
import { programKeys } from '../../hooks/queryKeys'
import { NutritionPageContent as NutritionPage } from '../NutritionPage'

const api = vi.hoisted(() => ({ analyze: vi.fn(), fetch: vi.fn(), toast: vi.fn() }))
vi.mock('../../utils/apiClient', async original => ({
  ...(await original<typeof import('../../utils/apiClient')>()), apiFetch: api.fetch,
}))
vi.mock('../../utils/foodAiApi', async original => ({
  ...(await original<typeof import('../../utils/foodAiApi')>()), analyzeFoodImage: api.analyze,
}))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ showToast: api.toast }) }))
vi.mock('../../context/WearableContext', () => ({ useWearable: () => ({ today: {} }) }))
const snapshot = { enrollmentId: 'qa', todayLocalDate: '2026-11-14', todayTasks: [],
  template: {}, xp: { balance: 0 } } as unknown as ProgramSnapshotDto
vi.mock('../../hooks/useProgram', () => ({ useProgram: () => ({ snapshot,
  isLoading: false, isMockFallback: false, productMessage: null }) }))
vi.mock('../../hooks/useMyNutritionPlan', () => ({ useMyNutritionPlan: () => ({ plan: null, isLoading: false }) }))
vi.mock('../../hooks/useNutritionPlanStatus', () => ({ useNutritionPlanStatus: () => ({ status: null }) }))
vi.mock('../../hooks/useProgramScores', () => ({ useProgramScores: () => ({ scores: null, isLoading: false }) }))
vi.mock('../../hooks/useMetricsHistory', () => ({ useMetricsHistory: () => ({ history: null, isLoading: false }) }))
vi.mock('../../hooks/useCompleteTask', () => ({ useCompleteTask: () => ({ isPending: false }), applyOptimistic: (value: unknown) => value }))
vi.mock('../../components/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>, Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../components/CameraCapture', () => ({ CameraCapture: ({ onCapture }: {
  onCapture: (blob: Blob, filename: string) => void,
}) => <button onClick={() => onCapture(new Blob(['fixture']), 'comida.jpg')}>Capturar fixture</button> }))
vi.mock('../../components/FoodResultCard', () => ({ FoodResultCard: () => <div>Alimento de la fixture</div> }))
vi.mock('framer-motion', async original => {
  const { createElement } = await import('react')
  const tag = (name: string) => ({ children, className }: { children?: ReactNode; className?: string }) => createElement(name, { className }, children)
  return { ...(await original<typeof import('framer-motion')>()), useReducedMotion: () => true,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: { div: tag('div'), article: tag('article'), circle: tag('circle'), span: tag('span') },
  }
})
vi.mock('@ionic/react', async original => {
  const Wrap = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return { ...(await original<typeof import('@ionic/react')>()),
    IonIcon: () => null, IonSpinner: () => <span />, IonProgressBar: () => null,
    IonSegment: Wrap, IonSegmentButton: Wrap, IonContent: Wrap,
    IonModal: ({ children, isOpen }: { children: ReactNode; isOpen?: boolean }) => isOpen ? <div>{children}</div> : null,
    IonActionSheet: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: {
      children: ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string,
    }) => <button disabled={disabled} onClick={onClick} aria-label={label}>{children}</button>,
    IonInput: ({ label, value, onIonInput }: { label: string; value: string;
      onIonInput: (event: { target: { value: string } }) => void,
    }) => <label>{label}<input value={value} onChange={event => onIonInput(event)} /></label>,
  }
})

const analysisId = 'ac5a9a36-712a-446c-8af4-202600000035'
const summary = { calories: 520, protein: 30, carbohydrates: 60, fat: 15, fiber: 5 }
const originalIntake = { calories: 410, proteinG: 20, carbsG: 45, fatG: 14, fiberG: 4 }
const analysis = () => ({ analysisId, provider: 'llm', foods: [{ name: 'Comida', nutritionStatus: 'available' }], summary, intake: originalIntake })
const clients: QueryClient[] = []
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  client.setQueryData(programKeys.snapshot, snapshot)
  render(<QueryClientProvider client={client}><I18nProvider><NutritionPage /></I18nProvider></QueryClientProvider>)
  fireEvent.click(screen.getAllByRole('button', { name: 'Foto IA' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Capturar fixture' }))
  return screen.findByText('Alimento de la fixture')
}
function bodyAt(index = 0) {
  // El hook y el servicio son reales; se inspecciona el body serializable de apiFetch.
  const [path, options] = api.fetch.mock.calls[index]
  expect(path).toBe('/api/v1/program/nutrition/log')
  expect(options.method).toBe('POST')
  return JSON.parse(JSON.stringify(options.body))
}
beforeEach(() => {
  localStorage.clear()
  api.analyze.mockReset().mockResolvedValue(analysis())
  api.fetch.mockReset().mockResolvedValue({ mealCode: 'des', localDate: '2026-11-14', xpAwarded: 0 })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); localStorage.clear() })

describe('3.5 · Foto IA desde NutritionPage hasta el servicio de registro', () => {
  it.each(['confirmar', 'corregir', 'original'] as const)('envía análisis y UUID al %s la comida', async path => {
    if (path === 'original') api.analyze.mockResolvedValue({ ...analysis(), summary: null })
    await setup()
    if (path === 'corregir') {
      fireEvent.click(screen.getByRole('button', { name: 'Editar valores' }))
      fireEvent.change(screen.getByLabelText('Calorías (kcal)'), { target: { value: '615' } })
      fireEvent.change(screen.getByLabelText('Proteínas (g)'), { target: { value: '42' } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Desayuno' }))
    await waitFor(() => expect(api.fetch).toHaveBeenCalledOnce())
    expect(bodyAt()).toEqual({ mealCode: 'des', clientRequestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      intake: { source: 'ai_photo', foodAnalysisId: analysisId,
        ...(path === 'original' ? originalIntake : { calories: path === 'corregir' ? 615 : 520,
          proteinG: path === 'corregir' ? 42 : 30, carbsG: 60, fatG: 15, fiberG: 5 }),
      },
    })
    expect(bodyAt().foodAnalysisId).toBeUndefined()
    expect(api.analyze).toHaveBeenCalledOnce()
  })

  it('un reintento de guardado conserva el UUID, análisis y valores originales', async () => {
    api.fetch.mockRejectedValueOnce(new ApiError({ status: 0, errorType: 'network', message: 'Sin conexión' }))
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Desayuno' }))
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.any(String), 'err'))
    const original = bodyAt()
    const queue = JSON.parse(localStorage.getItem('program-offline-queue')!)
    expect(queue[0].clientRequestId).toBe(original.clientRequestId)
    expect(queue[0].payload).toEqual(original)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Desayuno' }))
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2))
    expect(bodyAt(1)).toEqual(original)
  })

  it('cambiar de foto reemplaza el análisis y la identidad del borrador', async () => {
    api.fetch.mockRejectedValueOnce(new ApiError({ status: 400, errorType: 'business', message: 'Revisar valores' }))
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Desayuno' }))
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.any(String), 'err'))
    const previous = bodyAt()
    api.analyze.mockResolvedValue({ ...analysis(), analysisId: 'nuevo-analisis' })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar foto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Capturar fixture' }))
    await screen.findByText('Alimento de la fixture')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Desayuno' }))
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2))
    expect(bodyAt(1).intake.foodAnalysisId).toBe('nuevo-analisis')
    expect(bodyAt(1).clientRequestId).not.toBe(previous.clientRequestId)
  })
})

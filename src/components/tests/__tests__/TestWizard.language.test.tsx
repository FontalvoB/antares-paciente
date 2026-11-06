import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { TestWizard } from '../TestWizard'
import { FALLBACK_THEME } from '../model'
import type { WizardStep } from '../model'

vi.mock('../../../i18n/I18nContext', () => ({ useT: () => (key: string) => key }))
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick, disabled, 'aria-label': label }: { children: ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => <button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
  IonIcon: () => null, IonSpinner: () => null, IonProgressBar: () => null,
  IonTextarea: () => <textarea />,
}))
vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
}))
const steps = (english: boolean): WizardStep[] => [
  { kind: 'intro', key: 'intro', title: english ? 'Start' : 'Inicio', sub: '', emoji: '', minutes: 1, count: 2 },
  { kind: 'open', key: 'question-1', index: 0, question: english ? 'First question' : 'Primera pregunta', placeholder: '', emoji: '' },
  { kind: 'open', key: 'question-2', index: 1, question: english ? 'Second question' : 'Segunda pregunta', placeholder: '', emoji: '' },
]
function wizard(english: boolean) {
  return <TestWizard theme={FALLBACK_THEME} steps={steps(english)} answers={{}} extras={{ openNotes: [], onOpenNote: vi.fn() }} onScale={vi.fn()} onNum={vi.fn()} onBackendMulti={vi.fn()} onComplete={vi.fn()} />
}
describe('wizard translated question copy', () => {
  it('keeps the current question when only presentation text changes', () => {
    const view = render(wizard(false))
    fireEvent.click(screen.getByText('Comenzar evaluación'))
    fireEvent.click(screen.getByText('Continuar'))
    expect(screen.getByText('Segunda pregunta')).toBeTruthy()
    view.rerender(wizard(true))
    expect(screen.getByText('Second question')).toBeTruthy()
    expect(screen.queryByText('Start')).toBeNull()
  })
})

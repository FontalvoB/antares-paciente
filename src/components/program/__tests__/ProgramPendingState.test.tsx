import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../../../i18n/I18nContext'
import { ProgramPendingState } from '../ProgramPendingState'

afterEach(() => { cleanup(); localStorage.removeItem('antares_lang') })
describe('Programa pendiente ES/EN', () => {
  it.each(['es', 'en'])('muestra explicación y CTA a batería en %s', lang => {
    localStorage.setItem('antares_lang', lang)
    const onTests = vi.fn()
    render(<I18nProvider><ProgramPendingState loading={false} state="pending-tests" message={null} onTests={onTests} onRetry={vi.fn()} /></I18nProvider>)
    expect(screen.getByText(lang === 'es' ? 'Plan pendiente' : 'Plan pending')).toBeTruthy()
    fireEvent.click(screen.getByText(lang === 'es' ? 'Completar mis evaluaciones' : 'Complete my assessments'))
    expect(onTests).toHaveBeenCalledOnce()
  })
  it.each(['es', 'en'])('espera clínica sin CTA ni métricas en %s', lang => {
    localStorage.setItem('antares_lang', lang)
    const { container } = render(<I18nProvider><ProgramPendingState loading={false} state="pending-assignment" message={null} onTests={vi.fn()} onRetry={vi.fn()} /></I18nProvider>)
    expect(screen.getByText(lang === 'es' ? 'Pendiente de confirmación clínica' : 'Pending clinical confirmation')).toBeTruthy()
    expect(container.querySelector('ion-button')).toBeNull()
    expect(container.querySelector('ion-progress-bar')).toBeNull()
  })
})

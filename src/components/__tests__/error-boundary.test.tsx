import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider, useI18n } from '../../i18n/I18nContext'
import { ErrorBoundary } from '../error-boundary'

beforeEach(() => {
  localStorage.setItem('antares_lang', 'en')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

function BrokenCommunity(): never {
  throw new Error('Sensitive server details must stay out of the fallback')
}

describe('Community error boundary localization', () => {
  it('keeps healthy community content visible', () => {
    render(<I18nProvider><ErrorBoundary><p>Community content</p></ErrorBoundary></I18nProvider>)
    expect(screen.getByText('Community content')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
  })

  it('shows the English recovery copy and preserves reload without exposing the caught error', () => {
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    render(<I18nProvider><ErrorBoundary><BrokenCommunity /></ErrorBoundary></I18nProvider>)
    expect(screen.getByText('Something went wrong showing the community')).toBeTruthy()
    expect(screen.getByText('An unexpected error occurred. You can try reloading the page.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Sensitive server details')
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('updates the caught fallback in place when the language changes', () => {
    let attempts = 0
    function BrokenContent(): never { attempts += 1; throw new Error('Private exception') }
    function ChangeLanguage() {
      const { toggleLang } = useI18n()
      return <button onClick={toggleLang}>Change test language</button>
    }
    render(<I18nProvider><ChangeLanguage /><ErrorBoundary><BrokenContent /></ErrorBoundary></I18nProvider>)
    const caughtAttempts = attempts
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change test language' }))
    expect(screen.getByText('Algo salió mal al mostrar la comunidad')).toBeTruthy()
    expect(screen.getByText('Ocurrió un error inesperado. Puedes intentar recargar la página.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
    expect(screen.queryByText('Something went wrong showing the community')).toBeNull()
    expect(document.body.textContent).not.toContain('Private exception')
    expect(attempts).toBe(caughtAttempts)
  })
})

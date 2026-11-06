import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider, useI18n } from '../I18nContext'
import { requestLanguage } from '../../utils/requestLanguage'

function Picker() {
  const { lang, setLang } = useI18n()
  return <><output>{lang}</output><button onClick={() => setLang('en')}>English</button></>
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); requestLanguage() })
describe('idioma con almacenamiento del WebView', () => {
  it('respeta la selección guardada y usa español al limpiar una preferencia accesible', () => {
    localStorage.setItem('antares_lang', 'en')
    const view = render(<I18nProvider><Picker /></I18nProvider>)
    expect(screen.getByText('en')).toBeTruthy()
    view.unmount(); localStorage.clear()
    render(<I18nProvider><Picker /></I18nProvider>)
    expect(screen.getByText('es')).toBeTruthy()
    expect(requestLanguage()).toBe('es')
  })
  it('mantiene UI y peticiones en inglés cuando leer y guardar la preferencia está bloqueado', () => {
    localStorage.clear(); requestLanguage()
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    render(<I18nProvider><Picker /></I18nProvider>)
    expect(screen.getByText('es')).toBeTruthy()
    fireEvent.click(screen.getByText('English'))
    expect(screen.getByText('en')).toBeTruthy()
    expect(requestLanguage()).toBe('en')
  })
})

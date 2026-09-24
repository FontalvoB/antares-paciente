import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PanicOverlay } from '../PanicOverlay'

const context = vi.hoisted(() => ({
  panicOpen: true,
  sosActive: false,
  activateSos: vi.fn(),
  closePanic: vi.fn(),
  showToast: vi.fn(),
  user: { fam1Nombre: 'Contacto de prueba', fam1Parentesco: 'Familiar', fam1Cel: '000' },
}))

vi.mock('../../context/AppContext', () => ({ useApp: () => context }))
vi.mock('../../i18n/I18nContext', () => ({
  useT: () => (key: string, params?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? name),
}))

describe('SOS — preservación del temporizador al rediseñar la vista', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    context.panicOpen = true
    context.sosActive = false
    context.activateSos.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('activa una sola vez al completar los cinco segundos, nunca antes', () => {
    render(<PanicOverlay />)
    act(() => vi.advanceTimersByTime(4000))
    expect(context.activateSos).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1000))
    expect(context.activateSos).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(5000))
    expect(context.activateSos).toHaveBeenCalledTimes(1)
  })

  it('detiene el conteo al cerrar y comienza un conteo nuevo al reabrir', () => {
    const { rerender } = render(<PanicOverlay />)
    act(() => vi.advanceTimersByTime(3000))
    context.panicOpen = false
    rerender(<PanicOverlay />)
    act(() => vi.advanceTimersByTime(6000))
    expect(context.activateSos).not.toHaveBeenCalled()
    context.panicOpen = true
    rerender(<PanicOverlay />)
    act(() => vi.advanceTimersByTime(4000))
    expect(context.activateSos).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1000))
    expect(context.activateSos).toHaveBeenCalledTimes(1)
  })

  it('no inicia un nuevo conteo cuando SOS ya está activo', () => {
    context.sosActive = true
    render(<PanicOverlay />)
    act(() => vi.advanceTimersByTime(10000))
    expect(context.activateSos).not.toHaveBeenCalled()
  })
})

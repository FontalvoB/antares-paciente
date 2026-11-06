import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EmotionalLesson } from '../EmotionalLesson'
import { NutraceuticLesson } from '../NutraceuticLesson'
import type { HealthSample } from '../../../devices/types'

const wearable = vi.hoisted(() => ({ samples: {} as { sleep?: HealthSample }, device: { deviceId: 'band', name: 'H59_E206' }, syncing: false, lastSyncAt: null as number | null }))
vi.mock('../../../context/WearableContext', () => ({ useWearable: () => wearable }))
vi.mock('../../../i18n/I18nContext', () => {
  const t = (s: string, params?: Record<string, string>) => s.replace(/\{([^}]+)\}/g, (m, key) => params?.[key] ?? m)
  return { useT: () => t, useI18n: () => ({ t, lang: 'es' }) }
})
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, disabled, onClick, ...props }: { children: ReactNode; disabled?: boolean; onClick?: () => void; 'aria-pressed'?: boolean; 'aria-label'?: string }) => <button disabled={disabled} onClick={onClick} aria-pressed={props['aria-pressed']} aria-label={props['aria-label']}>{children}</button>,
  IonIcon: () => null,
  IonInput: ({ label, value, onIonInput }: { label: string; value: string; onIonInput: (event: { detail: { value: string } }) => void }) => <label>{label}<input value={value} onChange={e => onIonInput({ detail: { value: e.target.value } })} /></label>,
  IonTextarea: ({ label, value, onIonInput }: { label: string; value: string; onIonInput: (event: { detail: { value: string } }) => void }) => <label>{label}<textarea value={value} onChange={e => onIonInput({ detail: { value: e.target.value } })} /></label>,
  IonRange: ({ value, onIonInput, ...props }: { value: number; onIonInput: (event: { detail: { value: number } }) => void; 'aria-label': string }) => <input aria-label={props['aria-label']} type="range" min="1" max="10" value={value} onChange={e => onIonInput({ detail: { value: Number(e.target.value) } })} />,
  IonSegment: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonSegmentButton: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

beforeEach(() => { wearable.samples = {}; wearable.syncing = false; wearable.lastSyncAt = null; vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 3, 10)) })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('evaluación emocional con datos reales', () => {
  it('envía todos los campos contestados y no confirma entrega antes de guardar', () => {
    const save = vi.fn()
    render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: /Bien/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar mis horas' }));
    fireEvent.change(screen.getByLabelText('Horas de sueño'), { target: { value: '7.5' } }); fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    fireEvent.change(screen.getByLabelText('Estrés'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Motivación'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Algo que quieras contar (opcional)'), { target: { value: ' Dormí mejor. ' } })
    expect(screen.queryByText('Registro enviado a tu equipo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Guardar evaluación/ }))
    expect(save).toHaveBeenCalledWith({ mood: '4', barrier: '', emotional: { stressScore: 3, motivationScore: 8, sleepMinutes: 450, sleepSource: 'manual', sleepNightDate: '2026-11-03', notes: 'Dormí mejor.' } })
  })
  it('no inventa estrés ni motivación si no se responden', () => {
    const save = vi.fn()
    render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: /Neutro/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar mis horas' }));
    fireEvent.change(screen.getByLabelText('Horas de sueño'), { target: { value: '6' } }); fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar evaluación/ }))
    expect(save.mock.calls[0][0].emotional).toEqual({ sleepMinutes: 360, sleepSource: 'manual', sleepNightDate: '2026-11-03' })
  })
  it('ofrece sueño del wearable y conserva los minutos exactos al seleccionarlo', () => {
    const save = vi.fn()
    wearable.samples.sleep = { metric: 'sleep', value: 427, unit: 'min', ts: Date.now() - 3 * 3600_000, deviceId: 'band', source: 'history', sleepDurationVersion: 1 }
    render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: /Bien/ }))
    expect(screen.getByText('7 h 07 min')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Guardar evaluación/ }))
    expect(save.mock.calls[0][0].emotional).toMatchObject({ sleepMinutes: 427, sleepSource: 'wearable', sleepRecordedAt: new Date(Date.now() - 3 * 3600_000).toISOString() })
  })
  it('una corrección manual cambia el origen y no conserva una fecha de wearable falsa', () => {
    const save = vi.fn()
    wearable.samples.sleep = { metric: 'sleep', value: 420, unit: 'min', ts: Date.now(), deviceId: 'band', sleepDurationVersion: 1 }
    render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: /Bien/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Corregir este dato' }))
    fireEvent.change(screen.getByLabelText('Horas de sueño'), { target: { value: '8' } }); fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar evaluación/ }))
    expect(save.mock.calls[0][0].emotional).toEqual({ sleepMinutes: 480, sleepSource: 'manual', sleepNightDate: '2026-11-03' })
  })
  it('conserva una corrección manual aunque llegue otro dato del wearable', () => {
    const save = vi.fn()
    wearable.samples.sleep = { metric: 'sleep', value: 427, unit: 'min', ts: Date.now(), deviceId: 'band', sleepDurationVersion: 1 }
    const { rerender } = render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bien' }))
    fireEvent.click(screen.getByRole('button', { name: 'Corregir este dato' }))
    fireEvent.change(screen.getByLabelText('Horas de sueño'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    wearable.samples.sleep = { ...wearable.samples.sleep, value: 399, ts: Date.now() + 1000 }
    rerender(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: /Guardar evaluación/ }))
    expect(save.mock.calls[0][0].emotional).toEqual({ sleepMinutes: 480, sleepSource: 'manual', sleepNightDate: '2026-11-03' })
  })
  it('guarda sueño desconocido sin inventar cero y separa calidad subjetiva', () => {
    const save = vi.fn()
    render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Neutro' }))
    fireEvent.click(screen.getByRole('button', { name: 'No tengo este dato' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reparador' }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar evaluación/ }))
    expect(save.mock.calls[0][0].emotional).toEqual({ sleepSource: 'unknown', sleepQuality: 'restorative' })
  })
  it('no utiliza una estimación cacheada calculada con la semántica antigua', () => {
    const save = vi.fn()
    wearable.samples.sleep = { metric: 'sleep', value: 427, unit: 'min', ts: Date.now(), deviceId: 'band' }
    render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    expect(screen.queryByText('7 h 07 min')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Bien' }))
    expect((screen.getByRole('button', { name: /Guardar evaluación/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('muestra las respuestas que devolvió el servidor sin fabricar un resumen pendiente', () => {
    const saved = { moodScore: 4, answers: { sleepMinutes: 427, sleepSource: 'wearable' as const, stressScore: 3, sleepQuality: 'fair' as const } }
    const { rerender } = render(<EmotionalLesson done saved={saved} pts={50} onComplete={vi.fn()} />)
    expect(screen.getByText('7 h 07 min')).toBeTruthy()
    expect(screen.getByText('3/10')).toBeTruthy()
    rerender(<EmotionalLesson done pending saved={saved} pts={50} onComplete={vi.fn()} />)
    expect(screen.queryByText('7 h 07 min')).toBeNull()
    expect(screen.getByText('Tu evaluación está pendiente de sincronización')).toBeTruthy()
  })
  it('bloquea sueño inválido y no permite volver a completar un registro guardado', () => {
    const save = vi.fn()
    const { rerender } = render(<EmotionalLesson done={false} pts={50} onComplete={save} />)
    fireEvent.click(screen.getByRole('button', { name: /Bien/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar mis horas' }));
    fireEvent.change(screen.getByLabelText('Horas de sueño'), { target: { value: '25' } }); fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar evaluación/ }))
    expect(save).not.toHaveBeenCalled()
    rerender(<EmotionalLesson done pts={50} onComplete={save} />)
    expect(screen.queryByRole('button', { name: /Guardar evaluación/ })).toBeNull()
  })
})

describe('nutracéutico y comunidad', () => {
  it('solo ofrece compartir una toma confirmada con borrador revisable', () => {
    const share = vi.fn()
    const props = { pts: 80, takenAt: '', slot: 'manana', onSlot: vi.fn(), onComplete: vi.fn(), onShare: share, dayNumber: 19 }
    const { rerender } = render(<NutraceuticLesson {...props} done={false} />)
    expect(screen.queryByRole('button', { name: 'Preparar publicación' })).toBeNull()
    expect(screen.getByLabelText('Día 19 para estar más sano')).toBeTruthy()
    expect(screen.queryByText(/1 cápsula/)).toBeNull()
    rerender(<NutraceuticLesson {...props} done />)
    fireEvent.click(screen.getByRole('button', { name: 'Preparar publicación' }))
    expect(share).toHaveBeenCalledOnce()
    expect(props.onComplete).not.toHaveBeenCalled()
  })
  it('una marca optimista o en cola no confirma la dosis ni permite compartir', () => {
    render(<NutraceuticLesson done pending pts={80} takenAt="" onComplete={vi.fn()} onShare={vi.fn()} />)
    expect(screen.getByText('Pendiente de sincronización')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Preparar publicación' })).toBeNull()
    expect(screen.queryByText('Dosis de hoy confirmada')).toBeNull()
    expect(screen.queryByText('Mañana')).toBeNull()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ProgramHeader } from '../ProgramHeader'

vi.mock('../../../i18n/I18nContext', () => ({
  useT: () => (text: string, params?: Record<string, string>) => text.replace(/\{([^}]+)\}/g, (match, key) => params?.[key] ?? match),
}))
vi.mock('../../../components/notifications/NotificationsModal', () => ({ NotificationsModal: () => null }))
vi.mock('../visuals', () => ({ CountUp: ({ to }: { to: number }) => <>{to}</> }))
afterEach(cleanup)

const props = { programWeek: 3, doneCount: 2, total: 6, allDone: false, pointsToday: 200,
  pointsMax: 630, readyChests: 0, tab: 'hoy' as const, onTab: vi.fn(), onOpenChests: vi.fn() }

describe('día visible antes de elegir una misión', () => {
  it('identifica el día del programa sin confundirlo con la unidad o tareas completadas', () => {
    render(<ProgramHeader {...props} dayNumber={19} />)
    expect(screen.getByLabelText('Día 19 del programa').textContent).toBe('Día 19')
    expect(screen.getByText('Unidad 3')).toBeTruthy()
    expect(screen.getByText('Protocolo de hoy')).toBeTruthy()
  })
  it.each([undefined, null, 0, -1, NaN])('omite el día cuando no está verificado: %s', dayNumber => {
    const { container } = render(<ProgramHeader {...props} dayNumber={dayNumber} />)
    expect(container.querySelector('.pgh-program-day')).toBeNull()
    expect(screen.getByText('Unidad 3')).toBeTruthy()
  })
  it('conserva el día cuando se completan todas las actividades', () => {
    render(<ProgramHeader {...props} allDone doneCount={6} dayNumber={19} />)
    expect(screen.getByLabelText('Día 19 del programa')).toBeTruthy()
    expect(screen.getByText('Día perfecto')).toBeTruthy()
  })
})

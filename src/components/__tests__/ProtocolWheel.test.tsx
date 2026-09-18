import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProtocolWheel } from '../ProtocolWheel'
import type { ProgramDay, ProgramTaskId } from '../../types'

afterEach(cleanup)
const pending: ProgramDay = {
  podcast: false, vitals: false, nut: false, ejercicio: false,
  nutraceutico: false, emocional: false,
}
const labels = { title: 'Protocolo diario', total: 7, caption: 'Siguiente misión', actionLabel: 'Entrar' }

describe('ProtocolWheel', () => {
  it.each(Object.keys(pending) as ProgramTaskId[])('rellena únicamente %s al recibir su finalización', (task) => {
    const { container, rerender } = render(<ProtocolWheel {...labels} program={pending} count={0} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(0)
    rerender(<ProtocolWheel {...labels} program={{ ...pending, [task]: true }} count={1} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(1)
    expect(container.querySelector('.wheel-badge.done')?.getAttribute('data-task')).toBe(task)
    expect(container.querySelector('.wheel-core-count')?.textContent).toBe('1/7')
    rerender(<ProtocolWheel {...labels} program={pending} count={0} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(0)
  })

  it('mantiene el cofre pendiente hasta reclamarlo y muestra el día completo después', () => {
    const program = Object.fromEntries(Object.keys(pending).map(key => [key, true])) as ProgramDay
    const { container, rerender } = render(<ProtocolWheel {...labels} program={program} count={6} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(6)
    expect(container.querySelector('[data-task="chest"]')?.classList.contains('done')).toBe(false)
    rerender(<ProtocolWheel {...labels} program={program} count={7} chestClaimed />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(7)
    expect(container.querySelector('.wheel-core.complete')).not.toBeNull()
  })
})

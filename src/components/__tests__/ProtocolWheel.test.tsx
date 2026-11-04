import { cleanup, render, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProtocolWheel } from '../ProtocolWheel'
import type { ProgramDay, ProgramTaskId } from '../../types'

vi.mock('../../i18n/I18nContext', () => ({ useT: () => (text: string) => text }))

afterEach(cleanup)
const pending: ProgramDay = {
  podcast: false, vitals: false, nut: false, ejercicio: false,
  nutraceutico: false, emocional: false,
}
const labels = { title: 'Protocolo diario', total: 7 }

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

 it('cada nodo navega solamente a su actividad y el centro al protocolo', () => {
   const onSelect = vi.fn()
   const onOpenProgram = vi.fn()
   const { container } = render(<ProtocolWheel {...labels} program={pending} count={0} onSelect={onSelect} onOpenProgram={onOpenProgram} />)
   for (const id of [...Object.keys(pending), 'chest']) {
     fireEvent.click(container.querySelector(`[data-task="${id}"] ion-button`)!)
     expect(onSelect).toHaveBeenLastCalledWith(id)
   }
   expect(onSelect).toHaveBeenCalledTimes(7)
   expect(onOpenProgram).not.toHaveBeenCalled()
   fireEvent.click(container.querySelector('.wheel-core ion-button')!)
   expect(onOpenProgram).toHaveBeenCalledOnce()
 })

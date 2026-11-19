import { cleanup, render, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProtocolWheel } from '../ProtocolWheel'
import type { ProgramDay } from '../../types'

vi.mock('../../i18n/I18nContext', () => ({ useT: () => (text: string) => text }))

afterEach(cleanup)
const pending: ProgramDay = {
  podcast: false, vitals: false, nut: false, ejercicio: false,
  nutraceutico: false, emocional: false,
}
const activeTasks = ['vitals', 'nut', 'nutraceutico', 'emocional'] as const
const labels = { title: 'Protocolo diario', total: 5 }

describe('ProtocolWheel', () => {
  it('solo ofrece tareas activas aun si el snapshot trae podcast o ejercicio completados', () => {
    const onSelect = vi.fn()
    const { container } = render(<ProtocolWheel title="Protocolo diario" total={2} count={0}
      taskCodes={['podcast', 'nut', 'ejercicio']} program={{ ...pending, podcast: true, ejercicio: true }} onSelect={onSelect} />)
    expect(container.querySelectorAll('.wheel-badge')).toHaveLength(2)
    expect(container.querySelector('[data-task="podcast"]')).toBeNull()
    expect(container.querySelector('[data-task="ejercicio"]')).toBeNull()
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(0)
    expect(container.querySelector('.wheel-core-count')?.textContent).toBe('0/2')
    fireEvent.click(container.querySelector('[data-task="nut"] ion-button')!)
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('nut')
    expect(Array.from(container.querySelectorAll('path')).every(path => !path.getAttribute('d')?.includes('NaN'))).toBe(true)
  })

  it.each(activeTasks)('rellena únicamente %s al recibir su finalización', (task) => {
    const { container, rerender } = render(<ProtocolWheel {...labels} program={pending} count={0} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(0)
    rerender(<ProtocolWheel {...labels} program={{ ...pending, [task]: true }} count={1} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(1)
    expect(container.querySelector('.wheel-badge.done')?.getAttribute('data-task')).toBe(task)
    expect(container.querySelector('.wheel-core-count')?.textContent).toBe('1/5')
    rerender(<ProtocolWheel {...labels} program={pending} count={0} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(0)
  })

  it('mantiene el cofre pendiente hasta reclamarlo y muestra el día completo después', () => {
    const program = Object.fromEntries(Object.keys(pending).map(key => [key, true])) as ProgramDay
    const { container, rerender } = render(<ProtocolWheel {...labels} program={program} count={4} />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(4)
    expect(container.querySelector('[data-task="chest"]')?.classList.contains('done')).toBe(false)
    rerender(<ProtocolWheel {...labels} program={program} count={5} chestClaimed />)
    expect(container.querySelectorAll('.wheel-badge.done')).toHaveLength(5)
    expect(container.querySelector('.wheel-core.complete')).not.toBeNull()
  })
})

 it('cada nodo navega solamente a su actividad y el centro al protocolo', () => {
   const onSelect = vi.fn()
   const onOpenProgram = vi.fn()
   const { container } = render(<ProtocolWheel {...labels} program={pending} count={0} onSelect={onSelect} onOpenProgram={onOpenProgram} />)
   for (const id of [...activeTasks, 'chest']) {
     fireEvent.click(container.querySelector(`[data-task="${id}"] ion-button`)!)
     expect(onSelect).toHaveBeenLastCalledWith(id)
   }
   expect(onSelect).toHaveBeenCalledTimes(5)
   expect(onOpenProgram).not.toHaveBeenCalled()
   fireEvent.click(container.querySelector('.wheel-core ion-button')!)
   expect(onOpenProgram).toHaveBeenCalledOnce()
 })

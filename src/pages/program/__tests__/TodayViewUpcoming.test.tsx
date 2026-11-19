import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../../../i18n/I18nContext'
import type { ProgramUpcomingDayDto } from '../../../services/program/types'
import { TodayView } from '../TodayView'

vi.mock('@ionic/react', async original => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonIcon: () => null,
  IonAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonAccordion: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  IonItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonButton: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

afterEach(() => { cleanup(); localStorage.clear() })

const days: ProgramUpcomingDayDto[] = Array.from({ length: 6 }, (_, index) => ({
  date: `2026-11-${15 + index}`, day: 12 + index, weekNumber: index < 3 ? 2 : 3,
  rest: index === 1 ? true : undefined,
  missions: [{ type: 'podcast', title: `Audio de mi equipo ${index + 1}`, mediaId: `audio-${index}`, contentUnavailable: index === 2 }],
}))

function setup(upcoming?: ProgramUpcomingDayDto[] | null) {
  const onOpenTask = vi.fn()
  render(<I18nProvider><TodayView
    program={{ podcast: false, vitals: false, nut: false, ejercicio: false, nutraceutico: false, emocional: false }}
    allDone={false} first="Ana" programWeek={2} upcoming={upcoming}
    onOpenTask={onOpenTask} onGoEvo={() => {}} onGoChat={() => {}}
  /></I18nProvider>)
  return onOpenTask
}

describe('TodayView · próximos días del contrato 2.5', () => {
  it('muestra los seis días del servidor, sus contenidos, descanso y contenido pendiente sin completarlos', () => {
    const open = setup(days)
    const preview = screen.getByRole('region', { name: 'Lo que viene' })
    expect(within(preview).getByText('15/11/2026')).toBeTruthy()
    expect(within(preview).getByText('20/11/2026')).toBeTruthy()
    expect(within(preview).getByText('Día 15 · Semana 3')).toBeTruthy()
    expect(within(preview).getByText('Audio de mi equipo 6')).toBeTruthy()
    expect(within(preview).getByText('Descanso de ejercicio')).toBeTruthy()
    expect(within(preview).getByRole('status').textContent).toBe('Tu equipo está preparando este contenido.')
    expect(within(preview).queryByRole('button', { name: /Completar|Ya lo hice|Abrir/ })).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  it.each([undefined, null, []])('tolera upcoming ausente o vacío sin inventar un calendario: %s', value => {
    setup(value)
    expect(screen.queryByRole('region', { name: 'Lo que viene' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ejercicios, Próximamente' })).toBeTruthy()
  })

  it('traduce las etiquetas y conserva el título clínico recibido', () => {
    localStorage.setItem('antares_lang', 'en')
    setup(days)
    const preview = screen.getByRole('region', { name: 'Coming up' })
    expect(within(preview).getByText('Day 12 · Week 2')).toBeTruthy()
    expect(within(preview).getByText('Exercise rest day')).toBeTruthy()
    expect(within(preview).getByText('Audio de mi equipo 1')).toBeTruthy()
  })
})

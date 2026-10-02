import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { NutritionWeek, NutritionWeightChart, NutritionMetrics } from '../NutritionInsights'
import type { MetricSeriesDto } from '../../../services/program/types'

vi.mock('../../../i18n/I18nContext', () => ({ useT: () => (key: string) => key }))
afterEach(cleanup)

describe('Nutrición: visualizaciones con datos reales', () => {
  it('no convierte la ausencia de adherencia en un porcentaje cero', () => {
    const retry = vi.fn()
    render(<NutritionWeek current={null} previous={null} loading={false} failed onRetry={retry} locale="es-ES" />)
    expect(screen.getByText('Sin datos de adherencia esta semana todavía')).toBeTruthy()
    expect(screen.queryByText('0%')).toBeNull()
    fireEvent.click(screen.getByText('Reintentar'))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('conserva una adherencia de cero y compara contra el período real', () => {
    render(<NutritionWeek current={0} previous={12} loading={false} failed={false} onRetry={() => {}} locale="es-ES" />)
    expect(screen.getByText(/↓ 12/)).toBeTruthy()
    expect(screen.getByText('12%')).toBeTruthy()
    expect(screen.queryByText('Sin datos de adherencia esta semana todavía')).toBeNull()
  })

  it('selecciona el peso más reciente aunque la serie llegue desordenada y permite consultar otro', () => {
    const series: MetricSeriesDto = { code: 'weight', unit: 'kg', target: null, favorableDirection: null, points: [{date:'2026-10-02',value:81.7},{date:'2026-09-08',value:84}] }
    const { container } = render(<NutritionWeightChart series={series} locale="es-ES" />)
    expect(container.querySelector('[aria-live]')?.textContent).toContain('81,7')
    fireEvent.click(screen.getByText('84,0 kg'))
    expect(container.querySelector('[aria-live]')?.textContent).toContain('08/09/2026')
    expect(container.querySelector('[aria-live]')?.textContent).toContain('84,0')
  })

  it('no inventa indicadores clínicos sin mediciones', () => {
    render(<NutritionMetrics metrics={[]} loading={false} locale="es-ES" />)
    expect(screen.getAllByText('Sin medición')).toHaveLength(3)
    expect(screen.getAllByText('—')).toHaveLength(3)
  })
})

import { describe, expect, it } from 'vitest'
import {
  formatMetricTarget,
  formatMetricValue,
  metricProgress,
  resolveHomeCards,
  type HomeMetricCard,
} from '../metrics'
import type { MetricSeriesDto } from '../../services/program/types'

// Helpers de aserción por kind.
function asValue(card: HomeMetricCard) {
  if (card.kind !== 'value') throw new Error(`expected value card, got ${card.kind}`)
  return card
}
function asRequiresData(card: HomeMetricCard) {
  if (card.kind !== 'requires-data') throw new Error(`expected requires-data card, got ${card.kind}`)
  return card
}

const bmiSeries: MetricSeriesDto = {
  code: 'bmi',
  unit: 'kg/m²',
  target: { lo: null, hi: 25 },
  favorableDirection: 'down',
  points: [
    { date: '2026-03-12', value: 27.8 },
    { date: '2026-05-01', value: 27.2 },
    { date: '2026-06-19', value: 26.8 },
  ],
}
const weightSeries: MetricSeriesDto = {
  code: 'weight',
  unit: 'kg',
  target: null,
  favorableDirection: null,
  points: [
    { date: '2026-03-12', value: 79.1 },
    { date: '2026-06-19', value: 76.2 },
  ],
}

describe('resolveHomeCards — verdad del backend, nada fabricado', () => {
  it('imc usa la serie bmi del endpoint (current = último punto, barra con target real)', () => {
    const cards = resolveHomeCards({
      heightCm: 168,
      metrics: [bmiSeries],
      adherence: [],
      xpBalance: 120,
    })
    const imc = asValue(cards.imc)
    expect(imc.current).toBe(26.8)
    expect(imc.points).toHaveLength(3)
    expect(imc.first).toBe(27.8)
    expect(imc.last).toBe(26.8)
    expect(imc.target).toEqual({ lo: null, hi: 25 })
    // bmi baja hacia hi=25: aún no dentro, avance parcial (0.357…).
    expect(imc.progress).toBeCloseTo((27.8 - 26.8) / (27.8 - 25), 5)
    expect(imc.progress).toBeLessThan(1)
  })

  it('imc sin serie bmi pero con peso + talla del perfil: cómputo cliente peso/(talla/100)² por fecha', () => {
    const cards = resolveHomeCards({
      heightCm: 168,
      metrics: [weightSeries],
      adherence: [],
      xpBalance: 0,
    })
    const imc = asValue(cards.imc)
    const h = 1.68
    // El resolver redondea cada punto a 2 decimales.
    const round2 = (n: number) => Math.round(n * 100) / 100
    expect(imc.points[0].value).toBeCloseTo(round2(79.1 / (h * h)), 5)
    expect(imc.points[1].value).toBeCloseTo(round2(76.2 / (h * h)), 5)
    expect(imc.current).toBeCloseTo(round2(76.2 / (h * h)), 5)
    // Fallback sin target del endpoint → sin barra (honesto).
    expect(imc.progress).toBeNull()
    expect(imc.target).toBeNull()
  })

  it('imc sin bmi ni (peso+talla) → requires-data con nota', () => {
    const cards = resolveHomeCards({
      heightCm: null,
      metrics: [],
      adherence: [],
      xpBalance: 0,
    })
    const imc = asRequiresData(cards.imc)
    expect(imc.note).toBe('Se completa con tu primera medición')
  })

  it('imc sin bmi y con peso pero sin talla → requires-data (no puede computar)', () => {
    const cards = resolveHomeCards({
      heightCm: null,
      metrics: [weightSeries],
      adherence: [],
      xpBalance: 0,
    })
    expect(cards.imc.kind).toBe('requires-data')
  })

  it('hba1c y fat: con serie real muestran valor, target y dirección; sin filas → requires-data', () => {
    const cards = resolveHomeCards({
      heightCm: null,
      metrics: [
        {
          code: 'hba1c',
          unit: '%',
          target: { lo: null, hi: 5.7 },
          favorableDirection: 'down',
          points: [
            { date: '2026-02-18', value: 6.4 },
            { date: '2026-06-25', value: 6.0 },
          ],
        },
      ],
      adherence: [],
      xpBalance: 0,
    })
    const hba1c = asValue(cards.hba1c)
    expect(hba1c.current).toBe(6.0)
    expect(hba1c.unit).toBe('%')
    expect(hba1c.progress).toBeGreaterThan(0)
    const fat = asRequiresData(cards.fat)
    expect(fat.note).toBe('Aparece cuando tu equipo registra tu primer análisis/bioimpedancia')
  })

  it('adh se alimenta de dimensions.adherence del scores-history; sin puntos → requires-data', () => {
    const cards = resolveHomeCards({
      heightCm: null,
      metrics: [],
      adherence: [
        { date: '2026-05-25', value: 61 },
        { date: '2026-06-08', value: 67 },
        { date: '2026-06-22', value: 74 },
      ],
      xpBalance: 0,
    })
    const adh = asValue(cards.adh)
    expect(adh.current).toBe(74)
    expect(adh.points).toHaveLength(3)
    // Sin target de adherencia en el contrato → sin barra.
    expect(adh.progress).toBeNull()

    const empty = resolveHomeCards({ heightCm: null, metrics: [], adherence: [], xpBalance: 0 })
    expect(asRequiresData(empty.adh).note).toBe('Se completa con tu primera semana de adherencia')
  })

  it('pts usa el balance XP real SIN historial falso (points vacíos, sin barra)', () => {
    const cards = resolveHomeCards({
      heightCm: null,
      metrics: [],
      adherence: [],
      xpBalance: 4820,
    })
    const pts = asValue(cards.pts)
    expect(pts.current).toBe(4820)
    expect(pts.points).toEqual([])
    expect(pts.progress).toBeNull()
    expect(pts.target).toBeNull()
    expect(pts.unit).toBe('XP')
  })
})

describe('metricProgress — barra hacia el borde del target REAL', () => {
  it('dirección down: dentro/mejor que hi → 1 (objetivo alcanzado)', () => {
    expect(
      metricProgress({ series: [27.8, 26.6, 24.9], target: { lo: null, hi: 25 }, favorableDirection: 'down' }),
    ).toBe(1)
  })

  it('dirección up: dentro/mejor que lo → 1', () => {
    expect(
      metricProgress({ series: [52, 61, 88], target: { lo: 85, hi: null }, favorableDirection: 'up' }),
    ).toBe(1)
  })

  it('avance parcial 0..1 desde el primer registro hacia el borde', () => {
    const p = metricProgress({ series: [52, 61, 67], target: { lo: 85, hi: null }, favorableDirection: 'up' })
    expect(p).toBeCloseTo((67 - 52) / (85 - 52), 5)
  })

  it('sin dirección favorable o sin borde del target → null (la UI no dibuja barra)', () => {
    expect(
      metricProgress({ series: [27.8, 26.8], target: { lo: null, hi: 25 }, favorableDirection: null }),
    ).toBeNull()
    expect(
      metricProgress({ series: [27.8, 26.8], target: { lo: null, hi: null }, favorableDirection: 'down' }),
    ).toBeNull()
    expect(metricProgress({ series: [], target: { lo: null, hi: 25 }, favorableDirection: 'down' })).toBeNull()
  })
})

describe('formatMetricValue / formatMetricTarget — presentación', () => {
  it('formatea con la cantidad de decimales de la tarjeta (locale es-ES, coma decimal)', () => {
    expect(formatMetricValue(26.8, 1)).toBe('26,8')
    expect(formatMetricValue(4820, 0)).toBe('4820')
  })

  it('formatea el rango {lo,hi} con los DECIMALES de la tarjeta; bordes sueltos como ≤ / ≥; null sin rango', () => {
    // CRITICAL: un target de HbA1c {hi: 5.7} con decimals 1 rinde "≤ 5,7 %",
    // jamás "≤ 6 %" (misrepresentaría el cutoff ADA).
    expect(formatMetricTarget({ lo: null, hi: 5.7 }, '%', 1)).toBe('≤ 5,7 %')
    expect(formatMetricTarget({ lo: null, hi: 6.4 }, '%', 1)).toBe('≤ 6,4 %')
    expect(formatMetricTarget({ lo: 18.5, hi: 25 }, 'kg/m²', 1)).toBe('18,5–25,0 kg/m²')
    expect(formatMetricTarget({ lo: 85, hi: null }, '%', 0)).toBe('≥ 85 %')
    expect(formatMetricTarget(null, '%', 1)).toBeNull()
  })
})
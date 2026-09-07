import { describe, expect, it } from 'vitest'
import { formatTransformDelta } from '../formatTransformDelta'

describe('formatTransformDelta — texto firmado REAL + tone según `favorable`', () => {
  it('favorable true con delta positivo → tone favorable, texto +2.1 kg', () => {
    expect(formatTransformDelta({ delta: 2.1, unit: 'kg', favorable: true })).toEqual({
      text: '+2.1 kg',
      tone: 'favorable',
    })
  })

  it('favorable true con delta negativo (peso bajó) → texto firmado real, tone favorable', () => {
    expect(formatTransformDelta({ delta: -1.4, unit: 'kg', favorable: true })).toEqual({
      text: '-1.4 kg',
      tone: 'favorable',
    })
  })

  it('favorable false → tone unfavorable, signo real (nunca se inventa un signo)', () => {
    expect(formatTransformDelta({ delta: 3, unit: '%', favorable: false })).toEqual({
      text: '+3 %',
      tone: 'unfavorable',
    })
    expect(formatTransformDelta({ delta: -2, unit: 'kg', favorable: false }).text).toBe('-2 kg')
  })

  it('favorable undefined (payload previo sin el campo aditivo) → tone neutral', () => {
    expect(formatTransformDelta({ delta: 2.2, unit: 'cm' })).toEqual({ text: '+2.2 cm', tone: 'neutral' })
    expect(formatTransformDelta({ delta: -0.4, unit: '%' })).toEqual({ text: '-0.4 %', tone: 'neutral' })
  })

  it('delta 0 → sin signo; tone según favorable', () => {
    expect(formatTransformDelta({ delta: 0, unit: '%', favorable: true })).toEqual({ text: '0 %', tone: 'favorable' })
    expect(formatTransformDelta({ delta: 0, unit: '%' })).toEqual({ text: '0 %', tone: 'neutral' })
  })

  it('unit vacía → texto solo con el número (sin cola)', () => {
    expect(formatTransformDelta({ delta: 5, unit: '', favorable: true })).toEqual({ text: '+5', tone: 'favorable' })
  })
})
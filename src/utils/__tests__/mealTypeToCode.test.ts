import { describe, it, expect } from 'vitest'

import { mealTypeToCode } from '../mealTypeToCode'

/**
 * D4 — mapa canónico mealType ↔ mealCode (SPEC nutrition-intake-adherence):
 * Desayuno→des, Almuerzo→alm, Snack(Merienda)→mer, Cena→cen.
 * Corrige el fallthrough por prefijo de NutritionPage (Snack caía en cen) y el
 * id crudo de Lessons (mealTypeLower 'desayuno' nunca matcheaba 'des').
 */
describe('mealTypeToCode', () => {
  it('mapea Desayuno → des', () => {
    expect(mealTypeToCode('Desayuno')).toBe('des')
  })

  it('mapea Almuerzo → alm', () => {
    expect(mealTypeToCode('Almuerzo')).toBe('alm')
  })

  it('mapea Snack (Merienda) → mer', () => {
    expect(mealTypeToCode('Snack')).toBe('mer')
    expect(mealTypeToCode('Merienda')).toBe('mer')
  })

  it('mapea Cena → cen', () => {
    expect(mealTypeToCode('Cena')).toBe('cen')
  })

  it('es insensible a mayúsculas/espacios', () => {
    expect(mealTypeToCode('  desayuno ')).toBe('des')
    expect(mealTypeToCode('ALMUERZO')).toBe('alm')
  })

  it('devuelve null para tipos desconocidos (nunca cen por fallthrough)', () => {
    expect(mealTypeToCode('Brunch')).toBeNull()
    expect(mealTypeToCode('')).toBeNull()
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Contract test del wire shape de logMeal (SPEC nutrition-page-integration
// "Successful meal log"; B2): el backend enlaza el intake como bloque ANIDADO
// `intake` (`LogNutritionRequest.Intake`, NutritionIntakePayload?) — un shape
// aplanado en top-level se descartaría en silencio sobre HTTP real. La clase
// de bug flat-vs-nested queda LOCKED asertando el body SERIALIZADO
// (JSON.stringify) tal como lo envía apiFetch.
const apiFetchMock = vi.fn()

vi.mock('../../../utils/apiClient', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

import { logMeal, type NutritionIntakePayload } from '../nutrition-service'

describe('logMeal wire contract (nested intake, B2)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue({ mealCode: 'alm', localDate: '2026-09-02', xpAwarded: 10 })
  })

  it('serialized body contains the nested intake block (intake.calories etc.)', async () => {
    const intake: NutritionIntakePayload = {
      calories: 450,
      proteinG: 25.5,
      carbsG: 40,
      fatG: 12,
      fiberG: 6,
      waterMl: 500,
      source: 'manual',
      foodAnalysisId: 'a1b2c3d4-0000-4000-8000-000000000001',
    }

    await logMeal('alm', '2026-09-02', intake)

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    const [path, options] = apiFetchMock.mock.calls[0] as [
      string,
      { method?: string; body: unknown },
    ]
    expect(path).toBe('/api/v1/program/nutrition/log')
    expect(options.method).toBe('POST')

    const body = options.body as Record<string, unknown>
    expect(body.mealCode).toBe('alm')
    expect(body.localDate).toBe('2026-09-02')

    // Shape anidado: los campos de intake viven DENTRO de `intake`, nunca en
    // top-level (el binding del backend los descartaría aplanados).
    const nested = body.intake as Record<string, unknown>
    expect(nested.calories).toBe(450)
    expect(nested.proteinG).toBe(25.5)
    expect(nested.carbsG).toBe(40)
    expect(nested.fatG).toBe(12)
    expect(nested.fiberG).toBe(6)
    expect(nested.waterMl).toBe(500)
    expect(nested.source).toBe('manual')
    expect(nested.foodAnalysisId).toBe('a1b2c3d4-0000-4000-8000-000000000001')
    expect(body.calories).toBeUndefined()
    expect(body.proteinG).toBeUndefined()

    // Clase de bug flat-vs-nested: el body SERIALIZADO (lo que viaja por HTTP)
    // contiene el bloque `intake` con sus campos — este stringify es lo que
    // apiFetch hace con `body` antes de fetch.
    const serialized = JSON.stringify(body)
    expect(serialized).toContain('"intake":{"calories":450')
    expect(serialized).toContain('"waterMl":500')
    expect(serialized).toContain('"foodAnalysisId":"a1b2c3d4-0000-4000-8000-000000000001"')
    // Y NO hay campos aplanados en top-level del JSON.
    expect(serialized).not.toMatch(/^\{"mealCode":"alm","localDate":"[^"]+","calories"/)
  })

  it('bare marker (no intake) → body keeps the legacy flat shape without intake', async () => {
    await logMeal('des')

    const [, options] = apiFetchMock.mock.calls[0] as [string, { body: unknown }]
    const body = options.body as Record<string, unknown>
    expect(body.mealCode).toBe('des')
    expect(body.intake).toBeUndefined()
    expect(JSON.stringify(body)).toBe('{"mealCode":"des"}')
  })

  it('hydratation wire shape: mealCode agua + nested intake.waterMl (B6)', async () => {
    await logMeal('agua', undefined, { waterMl: 750, source: 'manual' })

    const [, options] = apiFetchMock.mock.calls[0] as [string, { body: unknown }]
    const body = options.body as Record<string, unknown>
    expect(body.mealCode).toBe('agua')
    const nested = body.intake as Record<string, unknown>
    expect(nested.waterMl).toBe(750)
    expect(nested.source).toBe('manual')
    expect(JSON.stringify(body)).toContain('"intake":{"waterMl":750')
  })

  it('invalid meal code fails fast without hitting the network', async () => {
    await expect(logMeal('brunch' as never)).rejects.toThrow(/Invalid mealCode/)
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
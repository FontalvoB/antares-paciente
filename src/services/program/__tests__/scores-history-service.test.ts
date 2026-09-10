import { describe, expect, it, vi, beforeEach } from 'vitest'

// Contract test del wire de scores-history (tab Evo): URL con weeks, parse
// del DTO tipado (sparse/ASC) y propagación del 404 NO_ACTIVE_ENROLLMENT como
// ApiError — el consumidor (trend card) lo degrada a estado vacío honesto.
const apiFetchMock = vi.fn()

vi.mock('../../../utils/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/apiClient')>()
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) }
})

import { getScoresHistory, SCORES_HISTORY_WEEKS } from '../scores-history-service'
import { ApiError } from '../../../utils/apiClient'
import type { ScoresHistoryDto } from '../types'

const historyFixture: ScoresHistoryDto = {
  points: [
    {
      weekNumber: 1,
      periodStart: null,
      periodEnd: '2026-06-21',
      healthScore: null,
      healthPrevious: null,
      transformationScore: null,
    },
    {
      weekNumber: 2,
      periodStart: '2026-06-22',
      periodEnd: '2026-06-28',
      healthScore: 64,
      healthPrevious: null,
      transformationScore: 12,
    },
    {
      weekNumber: 5,
      periodStart: '2026-07-13',
      periodEnd: '2026-07-19',
      healthScore: 72,
      healthPrevious: 64,
      transformationScore: 18,
    },
  ],
}

describe('getScoresHistory — parse del contrato FROZEN', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('pide la ventana por defecto (12 semanas) con GET', async () => {
    apiFetchMock.mockResolvedValue(historyFixture)
    const history = await getScoresHistory()
    expect(history.points).toHaveLength(3)
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/program/me/scores-history?weeks=12', { method: 'GET' })
  })

  it('respeta weeks custom', async () => {
    apiFetchMock.mockResolvedValue({ points: [] })
    await getScoresHistory(8)
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/program/me/scores-history?weeks=8', { method: 'GET' })
  })

  it('mapea el wire sparse/ASC sin transformar: nulls y semanas salteadas viajan tal cual', async () => {
    apiFetchMock.mockResolvedValue(historyFixture)
    const history = await getScoresHistory()
    expect(history.points[0]).toEqual({
      weekNumber: 1,
      periodStart: null,
      periodEnd: '2026-06-21',
      healthScore: null,
      healthPrevious: null,
      transformationScore: null,
    })
    expect(history.points[2].healthPrevious).toBe(64)
    expect(history.points[2].weekNumber).toBe(5)
  })

  it('parsea el aditivo dimensions (adherence + resto) cuando el wire lo trae', async () => {
    apiFetchMock.mockResolvedValue({
      points: [
        {
          weekNumber: 6,
          periodStart: '2026-07-20',
          periodEnd: '2026-07-26',
          healthScore: 74,
          healthPrevious: 72,
          transformationScore: 19,
          dimensions: {
            adherence: 81,
            clinical: 68,
            nutrition: 77,
            psychology: 72,
            exercise: 85,
          },
        },
      ],
    })
    const history = await getScoresHistory()
    expect(history.points[0].dimensions).toEqual({
      adherence: 81,
      clinical: 68,
      nutrition: 77,
      psychology: 72,
      exercise: 85,
    })
  })

  it('dimensions ausente o null viaja tal cual (payloads previos sin cómputo)', async () => {
    apiFetchMock.mockResolvedValue({
      points: [
        {
          weekNumber: 1,
          periodStart: null,
          periodEnd: '2026-06-21',
          healthScore: null,
          healthPrevious: null,
          transformationScore: null,
        },
        {
          weekNumber: 7,
          periodStart: '2026-07-27',
          periodEnd: '2026-08-02',
          healthScore: 78,
          healthPrevious: null,
          transformationScore: 21,
          dimensions: null,
        },
      ],
    })
    const history = await getScoresHistory()
    expect('dimensions' in history.points[0]).toBe(false)
    expect(history.points[1].dimensions).toBeNull()
  })

  it('SCORES_HISTORY_WEEKS es el default del contrato (12)', () => {
    expect(SCORES_HISTORY_WEEKS).toBe(12)
  })
})

describe('getScoresHistory — 404 degradado honestamente (nunca tragado)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('404 NO_ACTIVE_ENROLLMENT propaga como ApiError con code — el hook lo degrada a empty', async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({
        message: 'No active enrollment',
        status: 404,
        code: 'NO_ACTIVE_ENROLLMENT',
        errorType: 'business',
      }),
    )
    await expect(getScoresHistory()).rejects.toMatchObject({ status: 404, code: 'NO_ACTIVE_ENROLLMENT' })
  })

  it('404 sin body ProblemDetails también viaja como ApiError', async () => {
    apiFetchMock.mockRejectedValue(new ApiError({ message: 'HTTP 404', status: 404 }))
    await expect(getScoresHistory()).rejects.toMatchObject({ status: 404 })
  })
})
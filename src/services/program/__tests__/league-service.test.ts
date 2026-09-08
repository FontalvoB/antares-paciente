import { describe, it, expect, vi, beforeEach } from 'vitest'

// Contract test del wire de la Liga (LEAGUE v1, camelCase): parse de la
// respuesta tipada y body del PUT de preferencias + mapping de errores 400.
const apiFetchMock = vi.fn()

vi.mock('../../../utils/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/apiClient')>()
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) }
})

import { getLeague, updateLeaguePreferences } from '../league-service'
import { ApiError } from '../../../utils/apiClient'
import type { LeagueResponseDto } from '../types'

const leagueFixture: LeagueResponseDto = {
  cohort: {
    scope: 'state',
    stateCode: 'FL',
    participants: 42,
    computedAt: '2026-09-04T12:00:00.000Z',
  },
  me: { optedIn: true, nickname: 'Maratonista' },
  categories: {
    racha: {
      entries: [
        { position: 1, display: 'Sofía', isMe: false, value: 34 },
        { position: 5, display: 'Maratonista', isMe: true, value: 22 },
      ],
      myRank: 5,
      myValue: 22,
      totalParticipants: 42,
    },
    evo: { entries: [], myRank: null, myValue: null, totalParticipants: 42 },
    adh: { entries: [], myRank: null, myValue: null, totalParticipants: 42 },
    clin: { entries: [], myRank: null, myValue: null, totalParticipants: 42 },
  },
}

describe('getLeague — parse del wire camelCase', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('devuelve el DTO tipado con cohorte/me/categorías', async () => {
    apiFetchMock.mockResolvedValue(leagueFixture)
    const league = await getLeague()
    expect(league.cohort.scope).toBe('state')
    expect(league.cohort.stateCode).toBe('FL')
    expect(league.cohort.participants).toBe(42)
    expect(league.me).toEqual({ optedIn: true, nickname: 'Maratonista' })
    expect(league.categories.racha.entries[1]).toEqual({
      position: 5,
      display: 'Maratonista',
      isMe: true,
      value: 22,
    })
    expect(league.categories.racha.myRank).toBe(5)
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/program/me/league', { method: 'GET' })
  })
})

describe('updateLeaguePreferences — PUT body + errores 400', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('envía { nickname, optIn } y devuelve las preferencias guardadas', async () => {
    apiFetchMock.mockResolvedValue({ optedIn: true, nickname: 'Maratonista' })
    const saved = await updateLeaguePreferences({ nickname: 'Maratonista', optIn: true })
    expect(saved).toEqual({ optedIn: true, nickname: 'Maratonista' })
    const [path, options] = apiFetchMock.mock.calls[0] as [string, { method: string; body: unknown }]
    expect(path).toBe('/api/v1/program/me/league-preferences')
    expect(options.method).toBe('PUT')
    expect(options.body).toEqual({ nickname: 'Maratonista', optIn: true })
  })

  it('nickname null viaja tal cual (el server limpia lo almacenado)', async () => {
    apiFetchMock.mockResolvedValue({ optedIn: false, nickname: null })
    await updateLeaguePreferences({ nickname: null, optIn: false })
    const [, options] = apiFetchMock.mock.calls[0] as [string, { body: unknown }]
    expect(options.body).toEqual({ nickname: null, optIn: false })
  })

  it('400 con errors → ApiError con el mensaje real passthrough', async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({
        message: 'La solicitud contiene datos inválidos.',
        status: 400,
        title: 'Validation Error',
        errorType: 'business',
        errors: { Nickname: ['Ese apodo no está disponible.'] },
      }),
    )
    await expect(updateLeaguePreferences({ nickname: 'admin', optIn: true })).rejects.toMatchObject({
      status: 400,
      errorType: 'business',
      errors: { Nickname: ['Ese apodo no está disponible.'] },
    })
  })
})
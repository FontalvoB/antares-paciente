import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ApiError } from '../../utils/apiClient'
import { programKeys } from '../queryKeys'
import type { LeagueResponseDto } from '../../services/program/types'

const getLeagueMock = vi.fn()

vi.mock('../../services/program/league-service', () => ({
  getLeague: (...args: unknown[]) => getLeagueMock(...args),
}))

import { useLeague } from '../useLeague'

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

const leagueFixture: LeagueResponseDto = {
  cohort: { scope: 'state', stateCode: 'FL', participants: 12, computedAt: '2026-09-04T12:00:00.000Z' },
  me: { optedIn: true, nickname: 'Fénix' },
  categories: {
    racha: { entries: [], myRank: null, myValue: null, totalParticipants: 12 },
    evo: { entries: [], myRank: null, myValue: null, totalParticipants: 12 },
    adh: { entries: [], myRank: null, myValue: null, totalParticipants: 12 },
    clin: { entries: [], myRank: null, myValue: null, totalParticipants: 12 },
  },
}

describe('useLeague — estados honestos (sin mock fallback)', () => {
  beforeEach(() => {
    getLeagueMock.mockReset()
  })

  it('loading → league undefined', async () => {
    getLeagueMock.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useLeague(), { wrapper: makeWrapper(newClient()) })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.league).toBeUndefined()
  })

  it('error sin cache → isError + league undefined (la UI muestra el estado)', async () => {
    getLeagueMock.mockRejectedValue(
      new ApiError({ message: 'Not Found', status: 404, code: 'NO_ACTIVE_ENROLLMENT', errorType: 'business' }),
    )
    const { result } = renderHook(() => useLeague(), { wrapper: makeWrapper(newClient()) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.league).toBeUndefined()
    expect(result.current.error?.code).toBe('NO_ACTIVE_ENROLLMENT')
  })

  it('data → league tipado + refetch disponible', async () => {
    getLeagueMock.mockResolvedValue(leagueFixture)
    const client = newClient()
    const { result } = renderHook(() => useLeague(), { wrapper: makeWrapper(client) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.league?.cohort.stateCode).toBe('FL')
    expect(result.current.league?.me.optedIn).toBe(true)
    expect(client.getQueryData(programKeys.league)).toEqual(leagueFixture)
    expect(typeof result.current.refetch).toBe('function')
  })
})
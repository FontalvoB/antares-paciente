/**
 * useLeague — league query (LEAGUE v1, task League-frontend).
 *
 * Error contract (R5.2 pattern, igual que useProgramScores): NUNCA toast en
 * un query; los errores elegibles (network/5xx) conservan el cache previo vía
 * TanStack Query, y sin cache el query queda en isError — la UI muestra
 * estados honestos (loading / error con reintento / 404 sin inscripción).
 * NO hay mock fallback: la vista vieja mentía, esta muestra estados.
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getLeague } from '../services/program/league-service'
import { programKeys } from './queryKeys'
import { ApiError } from '../utils/apiClient'
import type { LeagueResponseDto } from '../services/program/types'

export type UseLeagueResult = UseQueryResult<LeagueResponseDto, ApiError> & {
  /** Payload de la liga; undefined mientras carga o en error sin cache. */
  league: LeagueResponseDto | undefined
}

export function useLeague(): UseLeagueResult {
  const query = useQuery<LeagueResponseDto, ApiError>({
    queryKey: programKeys.league,
    queryFn: getLeague,
    staleTime: 5 * 60 * 1000,
  })

  return {
    ...query,
    league: query.data,
  }
}
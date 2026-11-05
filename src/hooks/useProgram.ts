/** Snapshot de solo lectura: la inscripción y activación pertenecen al backend. */
import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ApiError } from '../utils/apiClient'
import { getSnapshot } from '../services/program/program-service'
import { programKeys } from './queryKeys'
import { fetchMyBatteries, fetchMyAssignments } from '../utils/healthTestsApi'
import { initialBatteryCompletedCount } from '../utils/programAssignment'
import { toLocalISODate } from '../utils/dates'

import type { ProgramSnapshotDto } from '../services/program/types'

// --- Derived product states (SPEC R4.5, R6 — "inscripción" is never shown to the patient) ---

export type ProgramState =
  | 'pending-tests'
  | 'pending-assignment'
  | 'active'
  | 'paused'
  | 'withdrawn'
  | 'no-template'
  | 'recoverable'

export interface UseProgramResult {
  /** Snapshot real del servidor; null mientras carga o no hay semana activa. */
  snapshot: ProgramSnapshotDto | null
  /** Derived enrollment/product state. */
  programState: ProgramState
  /** Compatibilidad con consumidores existentes: la app nunca inscribe. */
  isEnrolling: boolean
  /** True during the initial load (no data, no error yet). */
  isLoading: boolean
  /** True when the query ended in an error we did not absorb into a fallback. */
  isError: boolean
  /** Compatibilidad con consumidores existentes: nunca se fabrican snapshots. */
  isMockFallback: boolean
  /** The underlying ApiError, if any (null otherwise). */
  error: ApiError | null
  /** Human-facing product message for non-active states (already R4/R5 safe, never the raw server detail). */
  productMessage: string | null
  /** Completitud inicial real; null si todavía no se pudo consultar. */
  initialAssessmentsCompleted?: number | null
  /** Manual refetch (e.g. a "reintentar" CTA on the recoverable state). */
  refetch: () => void
}

// --- Product messages (SPEC R4.3 / R4.4 / R4.5, G1/G2) ---

const NOT_READY_MSG = 'El programa todavía no tiene actividades publicadas para ti. Tu equipo de salud debe habilitarlas antes de que puedas comenzar.'
const WITHDRAWN_MSG = 'Tu participación en este programa figura como desactivada, por eso sus actividades ya no están disponibles. Contacta a tu equipo de salud para conocer el motivo y los siguientes pasos.'
const PAUSED_MSG = 'Tu programa figura como pausado y sus actividades están suspendidas. Contacta a tu equipo de salud para saber por qué y cuándo puedes retomarlas.'
const RECOVERABLE_MSG = 'No pudimos consultar tus actividades. El servicio no indicó una causa específica. Reintenta; si se repite, contacta a tu equipo de salud.'
const NETWORK_MSG = 'No pudimos conectar con el servicio de tu programa. Revisa tu conexión a internet y vuelve a intentarlo.'
const TIMEOUT_MSG = 'El servicio de tu programa tardó demasiado en responder. Espera un momento y vuelve a intentarlo.'
const SERVER_MSG = 'El servicio de tu programa tuvo un problema al consultar tus actividades. Reintenta en unos minutos; si se repite, contacta a tu equipo de salud.'
const ASSESSMENTS_UNAVAILABLE_MSG = 'Tu programa aún no está activo y no pudimos comprobar si ya completaste tus evaluaciones. Reintenta; si se repite, contacta a tu equipo de salud.'

/**
 * useProgram — see file header for the full R4/R5 behavior contract.
 */
export function useProgram(): UseProgramResult {
  const query = useQuery<ProgramSnapshotDto, ApiError>({
    queryKey: programKeys.snapshot,
    queryFn: getSnapshot,
    refetchOnMount: 'always',
    refetchInterval: (q) => q.state.error?.status === 404 && q.state.error?.code === 'NO_ACTIVE_ENROLLMENT' ? 30_000 : false,
    // R5.1: retry only transport/server failures, never business (4xx) states.
    retry: (failureCount, err) => {
      if (!(err instanceof ApiError)) return failureCount < 2
      if (err.errorType === 'network' || err.errorType === 'TIMEOUT') return failureCount < 2
      if (err.errorType === 'server' && err.status >= 500) return failureCount < 2
      return false
    },
    staleTime: 5 * 60 * 1000, // 5 min (R5.1)
    refetchOnWindowFocus: true, // SHOULD (R5.1)
    networkMode: 'online',
  })

  const { data, isLoading, isError, error, refetch } = query

  const noActiveEnrollment = error?.status === 404 && error.code === 'NO_ACTIVE_ENROLLMENT'
  const battery = useQuery({
    queryKey: ['health-tests', 'initial-battery-progress'],
    queryFn: async () => {
      const [batteries, assignments] = await Promise.all([fetchMyBatteries(), fetchMyAssignments()])
      return initialBatteryCompletedCount(batteries, assignments)
    },
    enabled: !data && noActiveEnrollment,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: noActiveEnrollment ? 30_000 : false,
  })
  const retryProgram = () => { void refetch(); void battery.refetch() }

  // Midnight rollover (R7.1): when the app comes back to the foreground and the
  // device's local date no longer matches the snapshot's server `today`,
  // refetch so the day's tasks roll over. No polling: the check runs only on
  // `visibilitychange` → visible and window `focus` (TanStack already refetches
  // on window focus when stale; this covers the case where the snapshot is
  // still fresh but the calendar day changed). `lastCheckedDayRef` prevents
  // duplicate refetches within the same device day.
  const lastCheckedDayRef = useRef<string | null>(null)
  useEffect(() => {
    const maybeRollover = () => {
      if (document.visibilityState === 'visible') {
        const deviceToday = toLocalISODate()
        if (
          lastCheckedDayRef.current !== deviceToday &&
          data?.todayLocalDate &&
          data.todayLocalDate !== deviceToday
        ) {
          lastCheckedDayRef.current = deviceToday
          void refetch()
        }
      }
    }
    document.addEventListener('visibilitychange', maybeRollover)
    window.addEventListener('focus', maybeRollover)
    return () => {
      document.removeEventListener('visibilitychange', maybeRollover)
      window.removeEventListener('focus', maybeRollover)
    }
  }, [data?.todayLocalDate, refetch])

  const { snapshot, programState, productMessage } = useMemo(() => {
    if (data) {
      return { snapshot: data, programState: 'active' as ProgramState, productMessage: null }
    }

    if (error) {
      if (noActiveEnrollment) {
        return {
          snapshot: null,
          programState: (battery.isError ? 'recoverable' : battery.data === undefined ? 'active' : battery.data >= 9 ? 'pending-assignment' : 'pending-tests') as ProgramState,
          productMessage: battery.isError ? ASSESSMENTS_UNAVAILABLE_MSG : null,
        }
      }
      // Withdrawn (future recognition, G1).
      if (error.code === 'ENROLLMENT_WITHDRAWN') {
        return {
          snapshot: null,
          programState: 'withdrawn' as ProgramState,
          productMessage: WITHDRAWN_MSG,
        }
      }
      // Paused (future recognition, G1 / R4.4).
      if (error.code === 'ENROLLMENT_PAUSED') {
        return {
          snapshot: null,
          programState: 'paused' as ProgramState,
          productMessage: PAUSED_MSG,
        }
      }
      // No published template → no retry (R4.3, G2).
      if (error.status === 422 || error.code === 'TEMPLATE_NOT_ACTIVE') {
        return {
          snapshot: null,
          programState: 'no-template' as ProgramState,
          productMessage: NOT_READY_MSG,
        }
      }
      // Any other business error → recoverable, no loop.
      return {
        snapshot: null,
        programState: 'recoverable' as ProgramState,
        productMessage: error.errorType === 'network' ? NETWORK_MSG
          : error.errorType === 'TIMEOUT' || error.status === 504 ? TIMEOUT_MSG
            : error.status >= 500 ? SERVER_MSG : RECOVERABLE_MSG,
      }
    }

    // Loading (no data, no error yet).
    return { snapshot: null, programState: 'active' as ProgramState, productMessage: null }
  }, [data, error, noActiveEnrollment, battery.data, battery.isError])

  // Chest auto-open celebration (chests module, spec R3.2 / S2): when a
  // snapshot refetch reveals a newly granted streak chest, fire a one-shot
  // `program:chest-granted` event for the UI to celebrate. The FIRST
  // observation is a baseline — already-granted history never celebrates, and
  // each chest celebrates exactly once per session (dedupe by days). Zero
  // client XP mutation: the XP was granted server-side when the milestone was
  // crossed.
  const celebratedChestsRef = useRef<Set<number> | null>(null)
  useEffect(() => {
    const chests = data?.streakChests
    if (!chests || chests.length === 0) return
    const granted = chests.filter((chest) => chest.granted)
    if (celebratedChestsRef.current === null) {
      celebratedChestsRef.current = new Set(granted.map((chest) => chest.days))
      return
    }
    const seen = celebratedChestsRef.current
    for (const chest of granted) {
      if (seen.has(chest.days)) continue
      seen.add(chest.days)
      window.dispatchEvent(
        new CustomEvent('program:chest-granted', {
          detail: { days: chest.days, xp: chest.xp },
        }),
      )
    }
  }, [data])

  return {
    snapshot,
    programState,
    isEnrolling: false,
    isLoading: isLoading || (!data && noActiveEnrollment && battery.isPending),
    isError: (isError && !noActiveEnrollment) || battery.isError,
    isMockFallback: false,
    error,
    productMessage,
    initialAssessmentsCompleted: battery.data ?? null,
    refetch: retryProgram,
  }
}

/**
 * useProgram — snapshot query with enrollment-state machine (SPEC R4, R5; DESIGN §Carga inicial).
 *
 * Responsibilities (task 3.1):
 * - Query GET /api/v1/program/me/snapshot via TanStack Query under ['program','snapshot'].
 * - 404 NO_ACTIVE_ENROLLMENT → auto-enroll ONCE per mount with device IANA timezone, then refetch (R4.1).
 * - 409 PATIENT_ALREADY_ENROLLED on enroll → ignore the conflict, do NOT parse the body as an
 *   enrollment, refetch snapshot once (R4.2). If the refetch still 404s, surface a recoverable
 *   state — never loop.
 * - 422 / TEMPLATE_NOT_ACTIVE → no retry, product state "Tu programa no está listo aún..." (R4.3, G2).
 * - Explicit future codes ENROLLMENT_PAUSED / ENROLLMENT_WITHDRAWN are recognized WITHOUT inventing
 *   wire fields (G1): a paused/withdrawn signal short-circuits enrollment and yields the matching state.
 * - Eligible transport errors (network/timeout/5xx) with no cached data → stale cache or mock fallback
 *   marked `// TODO: Remove mock fallback`; NO toast is ever emitted here (R5.2).
 *
 * The hook returns the snapshot (or mock fallback), a derived `programState`
 * (`active | paused | withdrawn | no-template | recoverable`) and an `isEnrolling` flag.
 *
 * verbatimModuleSyntax: all type imports use `import type`.
 */

import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ApiError } from '../utils/apiClient'
import { getSnapshot, enrollMe } from '../services/program/program-service'
import { programKeys } from './queryKeys'

import type { ProgramSnapshotDto } from '../services/program/types'

// --- Derived product states (SPEC R4.5, R6 — "inscripción" is never shown to the patient) ---

export type ProgramState =
  | 'active'
  | 'paused'
  | 'withdrawn'
  | 'no-template'
  | 'recoverable'

export interface UseProgramResult {
  /** Snapshot DTO, or the mock fallback when transport failed with no cache (R5.2). Null only while loading or on a terminal business state. */
  snapshot: ProgramSnapshotDto | null
  /** Derived enrollment/product state. */
  programState: ProgramState
  /** True while a one-time auto-enrollment is in flight. */
  isEnrolling: boolean
  /** True during the initial load (no data, no error yet). */
  isLoading: boolean
  /** True when the query ended in an error we did not absorb into a fallback. */
  isError: boolean
  /** The underlying ApiError, if any (null otherwise). */
  error: ApiError | null
  /** Human-facing product message for non-active states (already R4/R5 safe, never the raw server detail). */
  productMessage: string | null
  /** Manual refetch (e.g. a "reintentar" CTA on the recoverable state). */
  refetch: () => void
}

// --- Product messages (SPEC R4.3 / R4.4 / R4.5, G1/G2) ---

const NOT_READY_MSG = 'Tu programa no está listo aún. Contacta a tu equipo de salud.'
const WITHDRAWN_MSG = 'Tu programa no está disponible. Contacta a tu equipo de salud.'
const PAUSED_MSG = 'Tu programa está pausado.'
const RECOVERABLE_MSG = 'No pudimos cargar tu programa en este momento. Intenta nuevamente.'

// --- Internal terminal error types (subclasses of ApiError, no new wire fields) ---

/** 404 after an enroll attempt + refetch still 404 → recoverable, no loop. */
class RecoverableProgramError extends ApiError {
  constructor() {
    super({
      message: 'No active enrollment after auto-enroll attempt',
      status: 404,
      code: 'NO_ACTIVE_ENROLLMENT',
      errorType: 'business',
    })
    this.name = 'RecoverableProgramError'
  }
}

/** Future recognition: backend signals the patient is Withdrawn (G1). Prevents blind auto-enroll. */
class WithdrawnProgramError extends ApiError {
  constructor() {
    super({
      message: 'Program enrollment withdrawn',
      status: 409,
      code: 'ENROLLMENT_WITHDRAWN',
      errorType: 'business',
    })
    this.name = 'WithdrawnProgramError'
  }
}

// --- Mock fallback (R5.2 last resort when transport fails and no cache exists) ---

// TODO: Remove mock fallback — replace with data/program.ts canonical mocks once that module exists.
const MOCK_FALLBACK_SNAPSHOT: ProgramSnapshotDto = {
  enrollmentId: 'mock-enrollment',
  template: {
    id: 'mock-template',
    code: 'mock',
    name: 'Demo',
    totalWeeks: 12,
    currentWeekNumber: 1,
    currentWeekStatus: 'Active',
    currentWeekStartDateLocal: '2026-01-01',
    currentWeekEndDateLocal: '2026-01-07',
  },
  todayLocalDate: '2026-01-01',
  todayTasks: [],
  todayPoints: 0,
  todayBonusAvailable: false,
  todayPointsMax: 0,
  xp: { balance: 0, level: '1', nextLevelAt: 1000 },
  streak: {
    current: 0,
    longest: 0,
    freezesRemaining: 0,
    multiplierActive: 0,
    multiplierEndsAt: null,
    multiplierRemainingHours: 0,
  },
  nextMilestoneDays: 0,
  calendar: [],
}

// --- Helpers ---

/** A transport/server error eligible for stale-cache or mock fallback (R5.2). */
function isEligibleFallbackError(err: ApiError): boolean {
  if (err.errorType === 'network' || err.errorType === 'TIMEOUT') return true
  if (err.errorType === 'server' && err.status >= 500) return true
  return false
}

/** 404 with no active enrollment (current contract) or explicit future paused/withdrawn codes. */
function isNoActiveEnrollment(err: ApiError): boolean {
  if (err.code === 'NO_ACTIVE_ENROLLMENT') return true
  if (err.code === 'ENROLLMENT_PAUSED') return true
  if (err.code === 'ENROLLMENT_WITHDRAWN') return true
  return err.status === 404
}

/**
 * useProgram — see file header for the full R4/R5 behavior contract.
 */
export function useProgram(): UseProgramResult {
  // Device timezone resolved once per mount (R4.1).
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  )

  // Guards a single auto-enrollment attempt for the lifetime of this mount (R4.1 / R4.2).
  const enrolledRef = useRef(false)
  const [isEnrolling, setIsEnrolling] = useState(false)

  const queryFn = async (): Promise<ProgramSnapshotDto> => {
    try {
      return await getSnapshot()
    } catch (err) {
      if (!(err instanceof ApiError)) throw err

      // Future codes short-circuit enrollment (G1) — recognize without inventing wire fields.
      if (err.code === 'ENROLLMENT_PAUSED') {
        throw err // surfaced as paused via the derived state
      }
      if (err.code === 'ENROLLMENT_WITHDRAWN') {
        throw new WithdrawnProgramError()
      }

      if (!isNoActiveEnrollment(err)) throw err

      // 404 NO_ACTIVE_ENROLLMENT → auto-enroll once, then refetch (R4.1).
      await enrollOnce(timezone, enrolledRef, setIsEnrolling)

      // Refetch snapshot exactly once.
      try {
        return await getSnapshot()
      } catch (refetchErr) {
        if (refetchErr instanceof ApiError && isNoActiveEnrollment(refetchErr)) {
          // Still no enrollment after enroll attempt → recoverable, NO loop (R4.1).
          throw new RecoverableProgramError()
        }
        throw refetchErr
      }
    }
  }

  const query = useQuery<ProgramSnapshotDto, ApiError>({
    queryKey: programKeys.snapshot,
    queryFn,
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

  const { snapshot, programState, productMessage } = useMemo(() => {
    if (data) {
      return { snapshot: data, programState: 'active' as ProgramState, productMessage: null }
    }

    if (error) {
      // Recoverable: 404 after enroll attempt (no loop).
      if (error instanceof RecoverableProgramError) {
        return {
          snapshot: null,
          programState: 'recoverable' as ProgramState,
          productMessage: RECOVERABLE_MSG,
        }
      }
      // Withdrawn (future recognition, G1).
      if (error instanceof WithdrawnProgramError || error.code === 'ENROLLMENT_WITHDRAWN') {
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
      // Eligible transport error with no cache → mock fallback (R5.2, no toast).
      if (isEligibleFallbackError(error)) {
        return {
          snapshot: MOCK_FALLBACK_SNAPSHOT,
          programState: 'active' as ProgramState,
          productMessage: null,
        }
      }
      // Any other business error → recoverable, no loop.
      return {
        snapshot: null,
        programState: 'recoverable' as ProgramState,
        productMessage: RECOVERABLE_MSG,
      }
    }

    // Loading (no data, no error yet).
    return { snapshot: null, programState: 'active' as ProgramState, productMessage: null }
  }, [data, error])

  return {
    snapshot,
    programState,
    isEnrolling,
    isLoading,
    isError,
    error,
    productMessage,
    refetch,
  }
}

/**
 * Attempt self-enrollment at most once per mount (R4.1).
 * - 200 → proceed.
 * - 409 PATIENT_ALREADY_ENROLLED → ignore, do NOT parse the body as an enrollment (R4.2).
 * - 409 ENROLLMENT_WITHDRAWN (future) → throw WithdrawnProgramError (G1).
 * - 422 / TEMPLATE_NOT_ACTIVE → rethrow so the caller yields the no-template state (R4.3, G2).
 */
async function enrollOnce(
  timezone: string,
  enrolledRef: MutableRefObject<boolean>,
  setIsEnrolling: (v: boolean) => void,
): Promise<void> {
  if (enrolledRef.current) return
  enrolledRef.current = true
  setIsEnrolling(true)
  try {
    await enrollMe(timezone)
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 409 && e.code === 'PATIENT_ALREADY_ENROLLED') {
        return // race: enrollment already exists elsewhere — ignore (R4.2)
      }
      if (e.status === 409 && e.code === 'ENROLLMENT_WITHDRAWN') {
        throw new WithdrawnProgramError() // future recognition (G1)
      }
      if (e.status === 422 || e.code === 'TEMPLATE_NOT_ACTIVE') {
        throw e // no published template (R4.3, G2)
      }
    }
    throw e
  } finally {
    setIsEnrolling(false)
  }
}

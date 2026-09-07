/**
 * Program service — read endpoints + self-enrollment (DESIGN §Capa de servicios, task 2.1).
 *
 * Transport is delegated entirely to `apiFetch` (apiClient.ts): this module never
 * touches tokens, refresh, or fetch directly. All non-2xx responses (404/409/422/5xx)
 * surface as `ApiError` and are NOT swallowed — the calling hooks decide UX (R1.4, R5.6).
 *
 * Anti-IDOR (R7.2): every read path below carries NO patient/enrollment id in the URL
 * or body; the backend resolves identity from the JWT. Mutations live in other services
 * and take their ids from the snapshot.
 *
 * verbatimModuleSyntax: all type imports use `import type`.
 */

import { apiFetch, ApiError } from '../../utils/apiClient'

import type {
  ProgramSnapshotDto,
  ProgramPathDto,
  ProgramCalendarDto,
  ProgramEnrollmentDto,
  EnrollRequest,
  TaskCode,
} from './types'

// --- DTO-boundary wire normalization (legacy task-code compat) ---

/**
 * Normaliza el wire code LEGADO de la tarea nutracéutico: backends antiguos
 * (y payloads de la cola offline cuando `flush()` exista) pueden emitir
 * `nutribiotico` — el enum actual es `nutraceutico` (JsonStringEnumConverter,
 * match exacto). La normalización vive EN LA FRONTERA del servicio para que
 * hooks/UI/tests solo vean el código canónico.
 */
export function normalizeTaskCode(code: string): TaskCode {
  return code === 'nutribiotico' ? 'nutraceutico' : (code as TaskCode)
}

/** Aplica la normalización a los todayTasks del snapshot (inmutable, no-op si no hay cambios). */
export function normalizeSnapshotTasks(snapshot: ProgramSnapshotDto): ProgramSnapshotDto {
  // El wire legado no pertenece a la unión canónica TaskCode — comparación
  // contra el literal con cast explícito (fuera de la unión a propósito).
  const LEGACY_NB_CODE = 'nutribiotico' as TaskCode
  let changed = false
  const todayTasks = snapshot.todayTasks.map((task) => {
    if (task.taskCode !== LEGACY_NB_CODE) return task
    changed = true
    return { ...task, taskCode: 'nutraceutico' as TaskCode }
  })
  return changed ? { ...snapshot, todayTasks } : snapshot
}

// --- Calendar range guard (DESIGN §Tipos: rango ≤ 92 días) ---

/**
 * Days between two YYYY-MM-DD strings, computed in UTC to avoid local-timezone drift.
 * Returns a signed whole-day count (negative if `to` precedes `from`).
 */
function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  )
  return Math.round((b - a) / 86_400_000)
}

const MAX_CALENDAR_RANGE_DAYS = 92

// --- Reads (no patient/enrollment ids — R7.2) ---

/**
 * GET /api/v1/program/me/snapshot
 * Server resolves enrollment + patient from JWT. 404 = NO_ACTIVE_ENROLLMENT.
 */
export async function getSnapshot(): Promise<ProgramSnapshotDto> {
  const snapshot = await apiFetch<ProgramSnapshotDto>('/api/v1/program/me/snapshot', {
    method: 'GET',
  })
  return normalizeSnapshotTasks(snapshot)
}

/**
 * GET /api/v1/program/path
 * Week nodes by state (Locked/Active/Completed) for the program journey.
 */
export async function getPath(): Promise<ProgramPathDto> {
  return apiFetch<ProgramPathDto>('/api/v1/program/path', {
    method: 'GET',
  })
}

/**
 * GET /api/v1/program/calendar?from=&to=
 * Local-date range, inclusive, capped at 92 days (enforced at the edge before the call).
 * Throws `ApiError` (business) if the range exceeds the limit or is inverted.
 */
export async function getCalendar(from: string, to: string): Promise<ProgramCalendarDto> {
  const span = daysBetween(from, to)
  if (span < 0) {
    throw new ApiError({
      message: 'Calendar range is inverted (to precedes from)',
      status: 400,
      code: 'CALENDAR_RANGE_INVALID',
      errorType: 'business',
    })
  }
  if (span > MAX_CALENDAR_RANGE_DAYS) {
    throw new ApiError({
      message: `Calendar range exceeds ${MAX_CALENDAR_RANGE_DAYS} days`,
      status: 400,
      code: 'CALENDAR_RANGE_EXCEEDED',
      errorType: 'business',
    })
  }

  const query = new URLSearchParams({
    from: encodeURIComponent(from),
    to: encodeURIComponent(to),
  }).toString()

  return apiFetch<ProgramCalendarDto>(`/api/v1/program/calendar?${query}`, {
    method: 'GET',
  })
}

// --- Self-enrollment (R4.1) ---

/**
 * POST /api/v1/program/enrollments/me
 * Body uses null ids on purpose: the server binds the caller's patient from JWT
 * and selects the active template. 409 = already active (ignore body, R4.2);
 * 422 = no published template (R4.3). Both propagate as ApiError.
 */
export async function enrollMe(timezone: string): Promise<ProgramEnrollmentDto> {
  const body: EnrollRequest = {
    patientId: null,
    templateId: null,
    timezone,
  }

  return apiFetch<ProgramEnrollmentDto>('/api/v1/program/enrollments/me', {
    method: 'POST',
    body,
  })
}

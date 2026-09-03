/**
 * Task completion service — POST /api/v1/program/tasks/complete
 *
 * Routes through apiFetch (Bearer, refresh single-flight, RFC 7807).
 * Does NOT generate clientRequestId — the hook owns that.
 * Errors (409/422) propagate as ApiError; never swallowed.
 */

import type { CompleteTaskInput, CompleteTaskResponseDto } from './types'
import { apiFetch } from '../../utils/apiClient'

/**
 * Mark a program task as completed for the current day.
 *
 * @param payload - CompleteTaskInput with enrollmentId, localDate, taskCode,
 *   clientRequestId (ULID/UUID), and optional fields.
 *   enrollmentId and localDate MUST come from the snapshot, never from UI input.
 * @returns CompleteTaskResponseDto with points awarded, XP balance, streak, etc.
 * @throws ApiError on any failure (409/422 are business errors, not retried here).
 */
export function completeTask(
  payload: CompleteTaskInput,
): Promise<CompleteTaskResponseDto> {
  return apiFetch<CompleteTaskResponseDto>(
    '/api/v1/program/tasks/complete',
    { method: 'POST', body: payload },
  )
}

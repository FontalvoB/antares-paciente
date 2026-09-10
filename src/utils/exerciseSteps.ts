import type { ExerciseItemDto } from '../services/program/types'

/**
 * Duración REAL de una estación de ejercicio en segundos (única fuente de
 * verdad, compartida por ProgramPage y ExerciseLesson — sin drift).
 *
 * Defensiva (W4): `durationSecs` solo se acepta si es > 0 — un valor
 * negativo/0 jamás produce una estación de 0 segundos que avance el circuito
 * instantáneamente (y regale puntos). Si no hay duración directa, deriva de
 * `restSeconds × sets` (sets inválidos → 1). Sin nada → 45 (default
 * conservador del contrato).
 */
export function resolveStationSec(ex: ExerciseItemDto): number {
  if (typeof ex.durationSecs === 'number' && ex.durationSecs > 0) {
    return ex.durationSecs
  }
  if (typeof ex.restSeconds === 'number' && ex.restSeconds > 0) {
    return ex.restSeconds * Math.max(1, ex.sets || 1)
  }
  return 45
}
/**
 * Helpers puros de la Liga (LEAGUE v1) — meta de categorías, formato de
 * valores, hora de "actualizado", resolución del estado de la vista y
 * validación de apodo espejo del backend. Sin dependencias de UI para poder
 * testearlos sin montar componentes.
 */

import type { LeagueResponseDto } from '../services/program/types'

export type LeagueCategoryId = 'racha' | 'evo' | 'adh' | 'clin'

/** Categorías servidas por el backend (nombres wire fijos); la etiqueta/unidad son claves t(). */
export const LEAGUE_CATEGORIES: { id: LeagueCategoryId; label: string; unit: string }[] = [
  { id: 'racha', label: 'Racha', unit: 'días' },
  { id: 'evo', label: 'Evolución', unit: 'índice' },
  { id: 'adh', label: 'Adherencia', unit: '%' },
  { id: 'clin', label: 'Salud clínica', unit: 'índice' },
]

/**
 * Formato de valor por categoría: racha = días (int), adh = %, evo/clin =
 * índice (int). El servidor envía ints; aquí solo se decide el sufijo.
 */
export function formatLeagueValue(category: LeagueCategoryId, value: number): string {
  if (category === 'adh') return `${value}%`
  return String(value)
}

export interface LeagueComputedAtParts {
  /** "HH:mm" del locale del device. */
  time: string
  /** Fecha corta (locale del device) cuando NO es hoy; null cuando es hoy. */
  date: string | null
}

/**
 * Honestidad de frescura: los valores del cohorte pueden tener días — el chip
 * no debe implicar que se computaron hace segundos. Hoy (device local) →
 * solo hora; cualquier otro día → fecha corta + hora. null con ISO inválido.
 */
export function formatLeagueUpdatedAt(
  iso: string,
  lang: 'es' | 'en',
): LeagueComputedAtParts | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const time = d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return { time, date: null }
  const date = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
    day: 'numeric',
    month: 'short',
  })
  return { time, date }
}

/**
 * Resuelve el estado de la vista de la Liga (state machine puro, testeado).
 * Reglas:
 * - sin datos + isLoading → 'loading'
 * - league presente → 'data' GANA sobre el error (datos en cache viejos son
 *   más verdaderos que un refetch fallido; el refetch los corregirá)
 * - sin league + isError → 'error' (404 NO_ACTIVE_ENROLLMENT → 'no-enrollment')
 * - league presente pero categoría activa ausente/vacía (participants === 0
 *   o entries.length === 0) → 'empty'
 */
export type LeagueViewState = 'loading' | 'no-enrollment' | 'error' | 'empty' | 'data'

export function resolveLeagueViewState({
  isLoading,
  isError,
  error,
  league,
  activeCategory,
}: {
  isLoading: boolean
  isError: boolean
  error: { code?: string } | null | undefined
  league: LeagueResponseDto | null | undefined
  activeCategory: { entries: unknown[] } | null | undefined
}): LeagueViewState {
  if (!league) {
    if (isLoading) return 'loading'
    if (isError) {
      return error?.code === 'NO_ACTIVE_ENROLLMENT' ? 'no-enrollment' : 'error'
    }
    return 'loading'
  }
  if (
    !activeCategory ||
    league.cohort.participants === 0 ||
    activeCategory.entries.length === 0
  ) {
    return 'empty'
  }
  return 'data'
}

/**
 * Validación del apodo espejo del backend (UpdateLeaguePreferencesCommand
 * Validator): 3-32 chars tras recortar, charset letras (incl. acentuadas y
 * ñ/ü), números, espacio, guion y guion bajo. Los tokens reservados los
 * rechaza el SERVIDOR (mensaje 400 passthrough) — aquí no se adivinan.
 */
const NICKNAME_PATTERN = /^[A-Za-z0-9 _\-áéíóúñüÁÉÍÓÚÑÜ]+$/

export function isValidNickname(raw: string): boolean {
  const trimmed = raw.trim()
  return trimmed.length >= 3 && trimmed.length <= 32 && NICKNAME_PATTERN.test(trimmed)
}
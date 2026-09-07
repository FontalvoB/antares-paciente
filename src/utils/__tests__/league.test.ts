import { describe, expect, it } from 'vitest'
import {
  LEAGUE_CATEGORIES,
  formatLeagueUpdatedAt,
  formatLeagueValue,
  isValidNickname,
  resolveLeagueViewState,
  type LeagueViewState,
} from '../league'
import type { LeagueCategoryDto, LeagueResponseDto } from '../../services/program/types'

function makeCategory(entries = 1): LeagueCategoryDto {
  const rows =
    entries === 0
      ? []
      : [{ position: 1, display: 'Sofía', isMe: false, value: 34 }]
  return {
    entries: rows,
    myRank: entries === 0 ? null : 1,
    myValue: entries === 0 ? null : 34,
    totalParticipants: entries,
  }
}

function makeLeague(participants = 12, categoryEntries = 1): LeagueResponseDto {
  const cat = makeCategory(categoryEntries)
  return {
    cohort: { scope: 'state', stateCode: 'FL', participants, computedAt: '2026-09-04T12:00:00.000Z' },
    me: { optedIn: true, nickname: 'Fénix' },
    categories: { racha: cat, evo: cat, adh: cat, clin: cat },
  }
}

function resolve(
  overrides: Partial<Parameters<typeof resolveLeagueViewState>[0]> = {},
): LeagueViewState {
  return resolveLeagueViewState({
    isLoading: false,
    isError: false,
    error: null,
    league: null,
    activeCategory: null,
    ...overrides,
  })
}

describe('LEAGUE_CATEGORIES — meta server-driven', () => {
  it('las 4 categorías con ids wire fijos', () => {
    expect(LEAGUE_CATEGORIES.map((c) => c.id)).toEqual(['racha', 'evo', 'adh', 'clin'])
  })

  it('etiquetas/unidades como claves t()', () => {
    expect(LEAGUE_CATEGORIES.find((c) => c.id === 'adh')?.label).toBe('Adherencia')
    expect(LEAGUE_CATEGORIES.find((c) => c.id === 'racha')?.unit).toBe('días')
    expect(LEAGUE_CATEGORIES.find((c) => c.id === 'clin')?.unit).toBe('índice')
  })
})

describe('formatLeagueValue — por categoría', () => {
  it('racha = días (int), sin sufijo', () => {
    expect(formatLeagueValue('racha', 22)).toBe('22')
  })

  it('adh = %', () => {
    expect(formatLeagueValue('adh', 88)).toBe('88%')
  })

  it('evo/clin = índice (int), sin sufijo', () => {
    expect(formatLeagueValue('evo', 27)).toBe('27')
    expect(formatLeagueValue('clin', 74)).toBe('74')
  })
})

describe('formatLeagueUpdatedAt — honestidad de frescura', () => {
  it('hoy (device local) → solo hora, sin fecha', () => {
    const now = new Date()
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    const out = formatLeagueUpdatedAt(todayNoon.toISOString(), 'es')
    expect(out?.date).toBeNull()
    expect(out?.time).toMatch(/^\d{1,2}:\d{2}( [AP]M)?$/)
  })

  it('NO hoy → fecha corta + hora (los valores del cohorte pueden tener días)', () => {
    const now = new Date()
    const threeDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 12, 0, 0)
    const out = formatLeagueUpdatedAt(threeDaysAgo.toISOString(), 'en')
    expect(out?.date).not.toBeNull()
    expect(out?.time).toMatch(/^\d{1,2}:\d{2}( [AP]M)?$/)
  })

  it('fecha inválida → null (el llamador omite el chip)', () => {
    expect(formatLeagueUpdatedAt('not-a-date', 'es')).toBeNull()
  })
})

describe('resolveLeagueViewState — state machine puro de la vista', () => {
  it('sin datos + isLoading → loading', () => {
    expect(resolve({ isLoading: true })).toBe('loading')
  })

  it('sin datos + sin error → loading', () => {
    expect(resolve({})).toBe('loading')
  })

  it('sin datos + error 404 NO_ACTIVE_ENROLLMENT → no-enrollment', () => {
    expect(
      resolve({ isError: true, error: { code: 'NO_ACTIVE_ENROLLMENT' } }),
    ).toBe('no-enrollment')
  })

  it('sin datos + error genérico → error', () => {
    expect(resolve({ isError: true, error: { code: 'INTERNAL' } })).toBe('error')
  })

  it('league presente + isLoading/refetch → data (los datos vencen al refetch)', () => {
    const league = makeLeague()
    expect(
      resolve({ league, activeCategory: league.categories.racha, isLoading: true }),
    ).toBe('data')
  })

  it('DISCRIMINACIÓN 1: league presente + isError → data (cache viejo > refetch fallido)', () => {
    const league = makeLeague()
    expect(
      resolve({ league, activeCategory: league.categories.racha, isError: true, error: { code: 'INTERNAL' } }),
    ).toBe('data')
  })

  it('DISCRIMINACIÓN 2: 404 sin datos → no-enrollment (no data)', () => {
    expect(resolve({ isError: true, error: { code: 'NO_ACTIVE_ENROLLMENT' } })).toBe('no-enrollment')
    expect(resolve({ isError: true, error: null })).toBe('error')
  })

  it('league presente + participants 0 → empty', () => {
    const league = makeLeague(0, 0)
    expect(resolve({ league, activeCategory: league.categories.racha })).toBe('empty')
  })

  it('league presente + categoría activa sin entries → empty', () => {
    const league = makeLeague(12, 0)
    expect(resolve({ league, activeCategory: league.categories.racha })).toBe('empty')
  })

  it('league presente + categoría activa ausente (R7.1, campo aditivo) → empty, no throw', () => {
    expect(resolve({ league: makeLeague(), activeCategory: null })).toBe('empty')
  })

  it('league presente + categoría con entries → data', () => {
    const league = makeLeague()
    expect(resolve({ league, activeCategory: league.categories.racha })).toBe('data')
  })
})

describe('isValidNickname — espejo del validador del backend', () => {
  it('apodos válidos (3-32, letras con acentos, números, espacios, guiones)', () => {
    expect(isValidNickname('Maratonista')).toBe(true)
    expect(isValidNickname('José María')).toBe(true)
    expect(isValidNickname('A1')).toBe(false) // muy corto
    expect(isValidNickname('12')).toBe(false)
    expect(isValidNickname('  ab  ')).toBe(false) // 2 chars tras trim
    expect(isValidNickname('el-nutricionista_42')).toBe(true)
  })

  it('recorta espacios y valida 3-32 sobre el trim', () => {
    expect(isValidNickname('  Ana  ')).toBe(true) // "Ana" tras trim
    expect(isValidNickname('x'.repeat(32))).toBe(true)
    expect(isValidNickname('x'.repeat(33))).toBe(false)
  })

  it('rechaza símbolos y emojis (charset acotado)', () => {
    expect(isValidNickname('Ana!')).toBe(false)
    expect(isValidNickname('🔥Fénix')).toBe(false)
    expect(isValidNickname('a.b')).toBe(false)
  })
})
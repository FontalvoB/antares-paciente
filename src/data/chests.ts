export type ChestTone = 'teal' | 'blue' | 'pur' | 'org' | 'ice' | 'gold'
export type ChestKind = 'streak' | 'clinical'
export type ChestStatus = 'claimed' | 'ready' | 'locked'

export interface StreakChest {
  id: string
  kind: 'streak'
  days: number
  xp: number
  title: string
  hint: string
  tone: ChestTone
}

export interface ClinicalChest {
  id: string
  kind: 'clinical'
  xp: number
  title: string
  hint: string
  tone: ChestTone
  progress: number
  goal: number
  unit: string
}

export type ProgramChest = StreakChest | ClinicalChest

export const STREAK_CHESTS: StreakChest[] = [
  {
    id: 'streak-7',
    kind: 'streak',
    days: 7,
    xp: 300,
    title: 'Cofre de arranque',
    hint: '7 días seguidos protegiendo el protocolo',
    tone: 'teal',
  },
  {
    id: 'streak-14',
    kind: 'streak',
    days: 14,
    xp: 600,
    title: 'Cofre de constancia',
    hint: 'Dos semanas de fuego intacto',
    tone: 'blue',
  },
  {
    id: 'streak-21',
    kind: 'streak',
    days: 21,
    xp: 900,
    title: 'Cofre de hábito',
    hint: 'Tres semanas. El cuerpo ya te reconoce',
    tone: 'pur',
  },
  {
    id: 'streak-30',
    kind: 'streak',
    days: 30,
    xp: 1500,
    title: 'Cofre de mes',
    hint: 'Un mes completo de transformación',
    tone: 'org',
  },
  {
    id: 'streak-50',
    kind: 'streak',
    days: 50,
    xp: 2500,
    title: 'Cofre de permanencia',
    hint: '50 días. Elite del protocolo',
    tone: 'ice',
  },
  {
    id: 'streak-75',
    kind: 'streak',
    days: 75,
    xp: 4000,
    title: 'Cofre de maestría',
    hint: 'Tres cuartos del camino hacia 100',
    tone: 'gold',
  },
  {
    id: 'streak-100',
    kind: 'streak',
    days: 100,
    xp: 8000,
    title: 'Cofre legendario',
    hint: '100 días. El hito que casi nadie alcanza',
    tone: 'gold',
  },
]

export const CLINICAL_CHESTS: ClinicalChest[] = [
  {
    id: 'clin-3ind',
    kind: 'clinical',
    xp: 800,
    title: 'Mejorar en 3 indicadores clínicos',
    hint: 'IMC, glucosa y % de grasa en tendencia positiva',
    tone: 'teal',
    progress: 3,
    goal: 3,
    unit: 'indicadores',
  },
  {
    id: 'clin-adh',
    kind: 'clinical',
    xp: 1200,
    title: 'Adherencia > 85% durante 2 semanas',
    hint: 'Mantén el plan nutricional por 14 días seguidos',
    tone: 'blue',
    progress: 1,
    goal: 2,
    unit: 'semanas',
  },
  {
    id: 'clin-kg',
    kind: 'clinical',
    xp: 1000,
    title: 'Bajar 5 kg desde tu línea base',
    hint: 'Peso inicial 92 kg · actual 87.8 kg',
    tone: 'org',
    progress: 4.2,
    goal: 5,
    unit: 'kg',
  },
  {
    id: 'clin-w12',
    kind: 'clinical',
    xp: 700,
    title: 'Completar 12 semanas de protocolo',
    hint: 'Un trimestre de COPP-ADRESD cerrado',
    tone: 'pur',
    progress: 12,
    goal: 12,
    unit: 'semanas',
  },
  {
    id: 'clin-hs',
    kind: 'clinical',
    xp: 1500,
    title: 'Health Score ≥ 90',
    hint: 'Hoy estás en 86. Faltan 4 puntos de excelencia',
    tone: 'ice',
    progress: 86,
    goal: 90,
    unit: 'pts',
  },
  {
    id: 'clin-hba1c',
    kind: 'clinical',
    xp: 2000,
    title: 'Llevar HbA1c por debajo de 5.7%',
    hint: 'Meta ADA · valor actual 5.9%',
    tone: 'gold',
    progress: 0,
    goal: 1,
    unit: 'meta',
  },
]

export const ALL_CHESTS: ProgramChest[] = [...STREAK_CHESTS, ...CLINICAL_CHESTS]

/**
 * FALLBACK ONLY (chests module): streak chest definitions used when the
 * backend snapshot does not provide `streakChests` (old deploy / offline
 * first load). The server catalog (xp_rules STREAK_*) is the source of truth
 * for days and XP once the field is present.
 */
export const FALLBACK_STREAK_CHESTS = STREAK_CHESTS

/**
 * Nutribiótico chest definitions (backend NB_STREAK_7/14/30/60/90, SPEC §19).
 * Per-run milestones: unlike streak chests, they re-award on every completed
 * run, so "earned this run" is correctly derivable from `nbStreak >= days`.
 * Static defs are an accepted drift risk (documented in the chests design).
 */
export const NB_STREAK_DEFS: { days: number; xp: number; tone: ChestTone }[] = [
  { days: 7, xp: 50, tone: 'teal' },
  { days: 14, xp: 100, tone: 'blue' },
  { days: 30, xp: 250, tone: 'pur' },
  { days: 60, xp: 500, tone: 'org' },
  { days: 90, xp: 1000, tone: 'gold' },
]

export const SEED_CLAIMED_CHESTS = ['streak-7'] as const

export function findChest(id: string): ProgramChest | undefined {
  return ALL_CHESTS.find((c) => c.id === id)
}

export function chestStatus(chest: ProgramChest, streak: number, claimed: string[]): ChestStatus {
  if (claimed.includes(chest.id)) return 'claimed'
  if (chest.kind === 'streak') return streak >= chest.days ? 'ready' : 'locked'
  return chest.progress >= chest.goal ? 'ready' : 'locked'
}

export function nextStreakChest(streak: number, claimed: string[]): StreakChest | undefined {
  return STREAK_CHESTS.find((c) => chestStatus(c, streak, claimed) !== 'claimed' && streak < c.days)
}

export function readyChests(streak: number, claimed: string[]): ProgramChest[] {
  return ALL_CHESTS.filter((c) => chestStatus(c, streak, claimed) === 'ready')
}

export function readyXp(streak: number, claimed: string[]): number {
  return readyChests(streak, claimed).reduce((sum, c) => sum + c.xp, 0)
}

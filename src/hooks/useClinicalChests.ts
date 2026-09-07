/**
 * useClinicalChests — clinical chest read-only progress (chests module, T9).
 *
 * Clinical chests are NOT claimable and NEVER award client XP: they visualize
 * real clinical progress against the server-computed scores (GET /program/scores)
 * and the current program week. The XP label references the CLINICAL_* grants
 * the backend may award when scores are calculated — display only (spec R3.4).
 *
 * Progress resolution per chest:
 * - clin-hs   → health score current value vs goal 90.
 * - clin-kg   → weight loss vs baseline (transformation detail `weight`/`peso`).
 * - clin-3ind → count of indicators with `favorable === true` (direction
 *               NORMALIZED by the backend) vs goal 3. Raw signed deltas
 *               (delta_pct > 0) would count a glucose RISE as improvement
 *               for down-favorable metrics — never used. Payloads without the
 *               additive `favorable` field → requires-data, no guessing.
 * - clin-adh  → adherence dimension vs goal 85% (single-window approximation).
 * - clin-w12  → current program week vs week 12 (snapshot, not scores).
 * - clin-hba1c → HbA1c current value below the 5.7% ADA goal. 5.7 is an
 *               HbA1c-% threshold — glucose (mg/dL) is NEVER substituted.
 *
 * When the underlying data is missing the chest renders a neutral
 * `requires-data` state — never a fake progress (spec S4).
 *
 * `resolveClinicalChests` is pure and exported for unit tests; the hook only
 * memoizes it.
 *
 * verbatimModuleSyntax: all type imports use `import type`.
 */

import { useMemo } from 'react'

import { CLINICAL_CHESTS, type ChestTone } from '../data/chests'

import type {
  ScoresResponseDto,
  TransformationDetailDto,
} from '../services/program/types'

export interface ClinicalChestView {
  id: string
  title: string
  hint: string
  tone: ChestTone
  xp: number
  goal: number
  unit: string
  /** null = cannot be computed from available data (neutral state). */
  progress: number | null
  status: 'achieved' | 'progress' | 'requires-data'
}

type DetailMap = Record<string, TransformationDetailDto> | null | undefined

function resolveScores(scores: ScoresResponseDto | undefined) {
  // The API may emit snake_case or camelCase variants (see RankingView usage).
  const health = scores?.health_score ?? scores?.healthScore
  const transformation = scores?.transformation_score ?? scores?.transformationScore
  return { health, transformation }
}

function detailFor(
  detail: DetailMap,
  keys: string[],
): TransformationDetailDto | undefined {
  if (!detail) return undefined
  for (const key of keys) {
    const entry = detail[key]
    if (entry) return entry
  }
  return undefined
}

function statusOf(progress: number | null, goal: number): ClinicalChestView['status'] {
  if (progress === null) return 'requires-data'
  return progress >= goal ? 'achieved' : 'progress'
}

export function resolveClinicalChests(
  scores: ScoresResponseDto | undefined,
  currentWeekNumber?: number,
): ClinicalChestView[] {
  const { health, transformation } = resolveScores(scores)
  const detail = transformation?.detail

  const byId: Record<string, { progress: number | null; goal: number }> = {
    'clin-hs': {
      progress: health?.current ?? health?.score ?? null,
      goal: 90,
    },
    'clin-kg': (() => {
      const weight = detailFor(detail, ['weight', 'peso'])
      return {
        progress: weight ? Math.max(0, weight.baseline - weight.current) : null,
        goal: 5,
      }
    })(),
    'clin-3ind': (() => {
      if (!detail || Object.keys(detail).length === 0) {
        return { progress: null, goal: 3 }
      }
      const values = Object.values(detail)
      // Direccionalidad NORMALIZADA por el backend (`favorable`): un delta
      // crudo firmado contaría una subida de glucosa como mejora en métricas
      // down-favorable. Payload previo sin `favorable` → requires-data, no adivinar.
      if (values.some((d) => d.favorable === undefined)) {
        return { progress: null, goal: 3 }
      }
      const improving = values.filter((d) => d.favorable === true).length
      return { progress: improving, goal: 3 }
    })(),
    'clin-adh': {
      progress: health?.dimensions?.adherence ?? null,
      goal: 85,
    },
    'clin-w12': {
      progress: currentWeekNumber ?? null,
      goal: 12,
    },
    'clin-hba1c': (() => {
      // 5.7 es un umbral de HbA1c en % — la glucosa (mg/dL) NO se sustituye.
      const entry = detailFor(detail, ['hba1c', 'HbA1c'])
      if (!entry || entry.current == null) return { progress: null, goal: 1 }
      return { progress: entry.current < 5.7 ? 1 : 0, goal: 1 }
    })(),
  }

  return CLINICAL_CHESTS.map((chest) => {
    const resolved = byId[chest.id] ?? { progress: null, goal: chest.goal }
    return {
      id: chest.id,
      title: chest.title,
      hint: chest.hint,
      tone: chest.tone,
      xp: chest.xp,
      goal: resolved.goal,
      unit: chest.unit,
      progress: resolved.progress,
      status: statusOf(resolved.progress, resolved.goal),
    }
  })
}

export function useClinicalChests(
  scores: ScoresResponseDto | undefined,
  currentWeekNumber?: number,
): ClinicalChestView[] {
  return useMemo(
    () => resolveClinicalChests(scores, currentWeekNumber),
    [scores, currentWeekNumber],
  )
}
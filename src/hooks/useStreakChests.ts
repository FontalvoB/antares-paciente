/**
 * useStreakChests — streak chest trail data (chests module, task T8).
 *
 * Resolves the UI chest list from the server truth: `snapshot.streakChests`
 * carries the active STREAK_* catalog definitions crossed with the REAL grant
 * state from the XP ledger (once-per-enrollment). Claim state must never be
 * derived client-side from `streak.current` — a broken + regrown streak would
 * resurrect already-paid chests (spec S3).
 *
 * When the field is absent (old backend deploy / offline first load) it falls
 * back to the static seed defs marked granted:false so the view never breaks
 * (R5.2 pattern / spec S6). `isFallback` flags the degraded mode.
 *
 * verbatimModuleSyntax: all type imports use `import type`.
 */

import { useProgram } from './useProgram'
import { FALLBACK_STREAK_CHESTS } from '../data/chests'

import type { StreakChestDto } from '../services/program/types'

export interface UseStreakChestsResult {
  /** Server chest defs, or static fallback defs (all locked) when absent. */
  chests: StreakChestDto[]
  /** True when serving static fallback defs (no server truth available). */
  isFallback: boolean
}

export function useStreakChests(): UseStreakChestsResult {
  const { snapshot } = useProgram()

  const serverChests = snapshot?.streakChests
  if (!serverChests || serverChests.length === 0) {
    return {
      chests: FALLBACK_STREAK_CHESTS.map((chest) => ({
        days: chest.days,
        xp: chest.xp,
        granted: false,
      })),
      isFallback: true,
    }
  }

  return { chests: serverChests, isFallback: false }
}

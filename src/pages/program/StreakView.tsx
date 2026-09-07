import { IonIcon, IonProgressBar } from '@ionic/react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { flame, flash, shieldCheckmark, trophy } from 'ionicons/icons'
import { NB_STREAK_DEFS } from '../../data/chests'
import { useI18n } from '../../i18n/I18nContext'
import {
  CAL_DAY_LABELS,
  PROGRAM_WEEKS,
  WEEK_LABELS,
} from '../../data/program'
import { ClinicalChestCard, NextChestGoal, StreakChestsTrail } from './ChestsPanel'
import { CountUp } from './visuals'
import type { StreakChestDto, NbNextMilestoneDto } from '../../services/program/types'
import type { ClinicalChestView } from '../../hooks/useClinicalChests'
import type { WeekStripCell } from '../../utils/weekStrip'

export function StreakView({
  streak,
  longestStreak,
  freezesRemaining = 1,
  weekCheckins,
  weekCells,
  todayIdx,
  cells,
  weekPct,
  programWeek,
  programWeeks = PROGRAM_WEEKS,
  chests,
  clinicalChests,
  nbStreak,
  nbNextMilestone,
  multiplierActive,
  multiplierRemainingHours,
}: {
  streak: number
  /** Máxima racha REAL (server); null → sin chip (nada inventado). */
  longestStreak?: number | null
  freezesRemaining?: number
  /** Fallback legado (device behavior) cuando no hay celdas del servidor. */
  weekCheckins: boolean[]
  /** Celdas de la semana del PROGRAMA resueltas por el server (7 ítems). */
  weekCells?: WeekStripCell[] | null
  todayIdx: number
  cells: { d: number | null; kind: string }[]
  weekPct: number
  programWeek: number
  programWeeks?: number
  /** Streak chest trail: server truth (or static fallback), already resolved. */
  chests: StreakChestDto[]
  /** Clinical chests: read-only progress resolved from scores. */
  clinicalChests: ClinicalChestView[]
  /** Nutracéutico streak (per-run): earns NB chests when >= def.days. */
  nbStreak: number
  /** Server-computed next NB milestone (takes precedence when present). */
  nbNextMilestone?: NbNextMilestoneDto | null
  /** Multiplicador de XP activo (1.0 = inactivo; 2.0 = x2). */
  multiplierActive?: number
  /** Horas restantes del multiplicador (server). */
  multiplierRemainingHours?: number
}) {
  const { lang, t } = useI18n()
  const monthRaw = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' })
  const monthTitle = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)

  const nextStreakChest = chests.find((chest) => !chest.granted)
  const nbChests: StreakChestDto[] = NB_STREAK_DEFS.map((def) => ({
    days: def.days,
    xp: def.xp,
    // Per-run semantics (AC-39): each completed run re-earns its milestone,
    // so deriving from the current nbStreak is correct for NB chests.
    granted: nbStreak >= def.days,
  }))
  const nextNb = nbNextMilestone ?? nbChests.find((chest) => !chest.granted)

  return (
    <div className="pg-pane cpad">
      <motion.section
        className="pg-streak-hero"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pg-flame" aria-hidden="true">
          <span className="pg-flame-glow" />
          <span className="pg-flame-glow g2" />
          <IonIcon icon={flame} />
        </div>
        <div className="pg-streak-num">
          <CountUp to={streak} duration={1.05} />
        </div>
        <div className="pg-streak-lbl">{t('días seguidos')}</div>
        <p className="pg-streak-copy">{t('Cada día completo protege el fuego. No lo dejes apagar.')}</p>
        <div className="pg-streak-chips">
          {longestStreak != null && (
            <span>
              <IonIcon icon={trophy} /> {t('Máxima')} {longestStreak}
            </span>
          )}
          <span>
            <IonIcon icon={shieldCheckmark} /> {freezesRemaining} {t('rescate(s)')}
          </span>
          {multiplierActive != null && multiplierActive > 1 && (
            <span className="xp-multiplier">
              <IonIcon icon={flash} /> x{multiplierActive} XP
              {multiplierRemainingHours != null && ` · ${t('quedan {h} h', { h: String(Math.ceil(multiplierRemainingHours)) })}`}
            </span>
          )}
        </div>
      </motion.section>

      <div className="pg-week-card">
        <div className="pg-week-lbl">{t('Esta semana')}</div>
        <div className="pg-week">
          {/* Las semanas del programa arrancan en lunes (lógica de inscripción);
              las celdas ya vienen indexadas por weekday ISO 1=lunes..7=domingo. */}
          {WEEK_LABELS.map((label, i) => {
            const cell = weekCells?.[i]
            // Sin celdas del servidor → fallback legado (boolean[] device).
            const done = cell ? cell.done : Boolean(weekCheckins[i])
            const isToday = i === todayIdx
            return (
              <motion.div
                key={label}
                className={`pg-week-day ${done ? 'done' : ''} ${cell && !cell.hasData ? 'nodata' : ''} ${isToday ? 'today' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
              >
                <span>{label}</span>
                <b>{done ? '✓' : isToday ? '·' : ''}</b>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="pg-cal-v2">
        <div className="pg-cal-v2-head">
          <div>
            <h3>{monthTitle}</h3>
            <p>{t('Tu mapa de consistencia')}</p>
          </div>
          <div className="pg-cal-v2-stat">
            <b>{cells.filter((c) => c.kind.includes('ok')).length}</b>
            <span>{t('días ok')}</span>
          </div>
        </div>
        <div className="pg-cal-v2-lbls">
          {CAL_DAY_LABELS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="pg-cal-v2-grid">
          {cells.map((c, i) => (
            <button
              key={i}
              type="button"
              className={`pg-cal-orb ${c.kind}`}
              disabled={!c.d}
              aria-label={c.d ? `${t('Día')} ${c.d}` : undefined}
            >
              {c.d ?? ''}
            </button>
          ))}
        </div>
        <div className="pg-cal-v2-legend">
          <span>
            <i className="ok" /> {t('Completo')}
          </span>
          <span>
            <i className="partial" /> {t('Parcial')}
          </span>
          <span>
            <i className="missed" /> {t('Perdido')}
          </span>
          <span>
            <i className="today" /> {t('Hoy')}
          </span>
        </div>
      </div>

      <div className="stitle">{t('Cofres de racha')}</div>
      <p className="cx-lead">{t('Cada hito de días seguidos abre su cofre de experiencia automáticamente.')}</p>
      <StreakChestsTrail chests={chests} streak={streak} />
      {nextStreakChest && (
        <NextChestGoal
          days={nextStreakChest.days}
          xp={nextStreakChest.xp}
          streak={streak}
        />
      )}

      <div className="stitle">{t('Cofres de nutracéutico')}</div>
      <p className="cx-lead">{t('Cada corrida constante de nutracéutico desbloquea su propio premio.')}</p>
      <StreakChestsTrail chests={nbChests} streak={nbStreak} />
      {nextNb && <NextChestGoal days={nextNb.days} xp={nextNb.xp} streak={nbStreak} />}

      <div className="stitle">{t('Cofres clínicos')}</div>
      <p className="cx-lead">{t('Tu evolución real frente a la línea base. Sin reclamos: tu equipo valida la XP.')}</p>
      {clinicalChests.map((chest, i) => (
        <ClinicalChestCard key={chest.id} chest={chest} index={i} />
      ))}

      <div className="card pg-protocol">
        <div className="pg-protocol-top">
          <div className="cs">{t('Recorrido del protocolo')}</div>
          <strong>
            {t('Semana')} {programWeek}/{programWeeks}
          </strong>
        </div>
        <IonProgressBar
          value={weekPct}
          className="pb"
          style={
            {
              '--progress-background': 'linear-gradient(90deg,var(--cyan),var(--teal))',
            } as CSSProperties
          }
        />
      </div>
    </div>
  )
}

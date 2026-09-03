import { IonIcon, IonProgressBar } from '@ionic/react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { flame, shieldCheckmark, trophy } from 'ionicons/icons'
import { NB_STREAK_DEFS } from '../../data/chests'
import { useI18n } from '../../i18n/I18nContext'
import {
  CAL_DAY_LABELS,
  LONGEST_STREAK,
  PROGRAM_WEEKS,
  WEEK_LABELS,
} from '../../data/program'
import { ClinicalChestCard, NextChestGoal, StreakChestsTrail } from './ChestsPanel'
import { CountUp } from './visuals'
import type { StreakChestDto, NbNextMilestoneDto } from '../../services/program/types'
import type { ClinicalChestView } from '../../hooks/useClinicalChests'

export function StreakView({
  streak,
  longestStreak = LONGEST_STREAK,
  freezesRemaining = 1,
  weekCheckins,
  todayIdx,
  cells,
  weekPct,
  programWeek,
  programWeeks = PROGRAM_WEEKS,
  chests,
  clinicalChests,
  nbStreak,
  nbNextMilestone,
}: {
  streak: number
  longestStreak?: number
  freezesRemaining?: number
  weekCheckins: boolean[]
  todayIdx: number
  cells: { d: number | null; kind: string }[]
  weekPct: number
  programWeek: number
  programWeeks?: number
  /** Streak chest trail: server truth (or static fallback), already resolved. */
  chests: StreakChestDto[]
  /** Clinical chests: read-only progress resolved from scores. */
  clinicalChests: ClinicalChestView[]
  /** Nutribiótico streak (per-run): earns NB chests when >= def.days. */
  nbStreak: number
  /** Server-computed next NB milestone (takes precedence when present). */
  nbNextMilestone?: NbNextMilestoneDto | null
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
          <span>
            <IonIcon icon={trophy} /> {t('Máxima')} {longestStreak}
          </span>
          <span>
            <IonIcon icon={shieldCheckmark} /> {freezesRemaining} {t('rescate(s)')}
          </span>
        </div>
      </motion.section>

      <div className="pg-week-card">
        <div className="pg-week-lbl">{t('Esta semana')}</div>
        <div className="pg-week">
          {WEEK_LABELS.map((label, i) => {
            const done = weekCheckins[i]
            const isToday = i === todayIdx
            return (
              <motion.div
                key={label}
                className={`pg-week-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}`}
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
            <i className="today" /> {t('Hoy')}
          </span>
          <span>
            <i className="mile" /> {t('Hito')}
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

      <div className="stitle">{t('Cofres de nutribiótico')}</div>
      <p className="cx-lead">{t('Cada corrida constante de nutribiótico desbloquea su propio premio.')}</p>
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

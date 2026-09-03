import { IonIcon, IonProgressBar } from '@ionic/react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { checkmarkCircle, gift, lockClosed } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import { useT } from '../../i18n/I18nContext'
import type { StreakChestDto } from '../../services/program/types'
import type { ClinicalChestView } from '../../hooks/useClinicalChests'

/**
 * ChestsPanel — chest visuals for the streak view (chests module, T10).
 *
 * Server-truth model: streak chests arrive as { days, xp, granted } from the
 * snapshot (catalog defs + XP ledger grant state). They are AUTO-GRANTED
 * server-side when the milestone is crossed, so there is NO claim action and
 * NO client XP mutation anywhere in this module (spec R3.2). Clinical chests
 * arrive as read-only ClinicalChestView progress (spec R3.4).
 */

/** Deterministic tone per position so server defs render with the usual palette. */
const TONE_CYCLE = ['teal', 'blue', 'pur', 'org', 'ice', 'gold']

function chestTone(index: number): string {
  return TONE_CYCLE[index % TONE_CYCLE.length]
}

function streakRemainLabel(
  days: number,
  streak: number,
  t: (s: string, p?: Record<string, string>) => string,
) {
  const left = Math.max(0, days - streak)
  if (left === 0) return t('Listo para abrir')
  return left === 1 ? t('1 día para el premio') : t('{n} días para el premio', { n: String(left) })
}

function ChestGlyph({ status, tone }: { status: string; tone: string }) {
  return (
    <div className={`cx-glyph tone-${tone} ${status}`}>
      <IonIcon icon={status === 'claimed' ? checkmarkCircle : status === 'locked' ? lockClosed : gift} />
    </div>
  )
}

export function StreakChestsTrail({
  chests,
  streak,
}: {
  chests: StreakChestDto[]
  streak: number
}) {
  const t = useT()
  return (
    <div className="cx-trail" role="list" aria-label={t('Cofres de racha')}>
      {chests.map((chest, i) => {
        // granted is the server ledger truth (once per enrollment); never
        // derived locally from the current streak (spec R1.3).
        const status = chest.granted ? 'claimed' : 'locked'
        const tone = chestTone(i)
        return (
          <motion.div
            key={chest.days}
            role="listitem"
            className={`cx-node ${status} tone-${tone}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.32 }}
            aria-label={`${t('{days} días', { days: String(chest.days) })}. ${
              chest.granted ? t('Abierto') : streakRemainLabel(chest.days, streak, t)
            }`}
          >
            <ChestGlyph status={status} tone={tone} />
            <b>{chest.days}d</b>
            <small>+{chest.xp.toLocaleString('es-ES')}</small>
          </motion.div>
        )
      })}
    </div>
  )
}

export function ClinicalChestCard({
  chest,
  index = 0,
}: {
  chest: ClinicalChestView
  index?: number
}) {
  const t = useT()
  const statusClass =
    chest.status === 'achieved' ? 'claimed' : chest.status === 'progress' ? 'ready' : 'locked'
  const pct =
    chest.progress === null ? 0 : Math.min(1, chest.progress / chest.goal)

  return (
    <motion.article
      className={`cx-card ${statusClass} tone-${chest.tone}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.35 }}
    >
      <div className="cx-card-top">
        <ChestGlyph status={statusClass} tone={chest.tone} />
        <div className="cx-card-copy">
          <div className="cx-card-kicker">{t('Cofre clínico')}</div>
          <h3>{t(chest.title)}</h3>
          <p>{t(chest.hint)}</p>
        </div>
        <div className="cx-xp">+{chest.xp.toLocaleString('es-ES')}</div>
      </div>

      {chest.status === 'requires-data' && (
        <div className="cx-meta">{t('Requiere datos clínicos de tu equipo')}</div>
      )}

      {chest.status === 'progress' && (
        <div className="cx-card-bar">
          <IonProgressBar
            className="pb"
            value={pct}
            style={
              {
                '--progress-background': 'linear-gradient(90deg,var(--cyan),var(--teal))',
              } as CSSProperties
            }
          />
          <span>
            {t('Progreso {cur} / {goal} {unit}', {
              cur: String(chest.progress),
              goal: String(chest.goal),
              unit: t(chest.unit),
            })}
          </span>
        </div>
      )}

      {chest.status === 'achieved' && (
        <div className="cx-claimed">
          <IonIcon icon={checkmarkCircle} /> {t('Logrado')}
        </div>
      )}
    </motion.article>
  )
}

export function NextChestGoal({
  days,
  xp,
  streak,
}: {
  days: number
  xp: number
  streak: number
}) {
  const t = useT()
  const pct = Math.min(1, streak / days)
  const remain = Math.max(0, days - streak)
  return (
    <div className="card chest-next pg-chest-goal">
      <div className="chest-next-row">
        <RingProgress
          value={pct}
          size={72}
          stroke={6}
          trackColor="rgba(255,255,255,0.14)"
          gradient={['#c4b5fd', '#7c3aed']}
        >
          <span className="pg-gift">
            <IonIcon icon={gift} />
          </span>
        </RingProgress>
        <div>
          <div className="ct">{t('Cofre de {days} días', { days: String(days) })}</div>
          <div className="cs">
            {remain === 0
              ? t('Listo para abrir')
              : remain === 1
                ? t('1 día para el premio')
                : t('{n} días para el premio', { n: String(remain) })}
          </div>
        </div>
      </div>
      <IonProgressBar
        value={pct}
        className="pb"
        style={
          {
            '--background': 'rgba(255,255,255,.12)',
            '--progress-background': 'linear-gradient(90deg,#c4b5fd,#7c3aed)',
          } as CSSProperties
        }
      />
      <div className="chest-next-meta">
        {streak} {t('de')} {days} · +{xp.toLocaleString('es-ES')} XP {t('al abrir')}
      </div>
    </div>
  )
}

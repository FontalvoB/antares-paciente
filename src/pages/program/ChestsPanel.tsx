import { IonButton, IonIcon, IonProgressBar } from '@ionic/react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { checkmarkCircle, gift, lockClosed } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import {
  chestStatus,
  type ClinicalChest,
  type ProgramChest,
  type StreakChest,
} from '../../data/chests'
import { useT } from '../../i18n/I18nContext'

function remainLabel(chest: ProgramChest, streak: number, t: (s: string, p?: Record<string, string>) => string) {
  if (chest.kind === 'streak') {
    const left = Math.max(0, chest.days - streak)
    if (left === 0) return t('Listo para abrir')
    return left === 1 ? t('1 día para el premio') : t('{n} días para el premio', { n: String(left) })
  }
  const left = Math.max(0, chest.goal - chest.progress)
  if (left <= 0) return t('Objetivo cumplido')
  return t('Progreso {cur} / {goal} {unit}', {
    cur: String(chest.progress),
    goal: String(chest.goal),
    unit: t(chest.unit),
  })
}

function progressOf(chest: ProgramChest, streak: number) {
  if (chest.kind === 'streak') return Math.min(1, streak / chest.days)
  return Math.min(1, chest.progress / chest.goal)
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
  claimed,
  onClaim,
}: {
  chests: StreakChest[]
  streak: number
  claimed: string[]
  onClaim: (id: string) => void
}) {
  const t = useT()
  return (
    <div className="cx-trail" role="list" aria-label={t('Cofres de racha')}>
      {chests.map((chest, i) => {
        const status = chestStatus(chest, streak, claimed)
        return (
          <motion.button
            key={chest.id}
            type="button"
            role="listitem"
            className={`cx-node ${status} tone-${chest.tone}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.32 }}
            onClick={() => status === 'ready' && onClaim(chest.id)}
            aria-label={`${t(chest.title)}. ${status === 'ready' ? t('Reclamar') : status === 'claimed' ? t('Reclamado') : remainLabel(chest, streak, t)}`}
          >
            <ChestGlyph status={status} tone={chest.tone} />
            <b>{chest.days}d</b>
            <small>+{chest.xp.toLocaleString('es-ES')}</small>
            {status === 'ready' && <span className="cx-node-glow" aria-hidden="true" />}
          </motion.button>
        )
      })}
    </div>
  )
}

export function ChestCard({
  chest,
  streak,
  claimed,
  onClaim,
  index = 0,
}: {
  chest: ProgramChest
  streak: number
  claimed: string[]
  onClaim: (id: string) => void
  index?: number
}) {
  const t = useT()
  const status = chestStatus(chest, streak, claimed)
  const pct = progressOf(chest, streak)
  const clinical = chest.kind === 'clinical' ? (chest as ClinicalChest) : null

  return (
    <motion.article
      className={`cx-card ${status} tone-${chest.tone}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.35 }}
    >
      <div className="cx-card-top">
        <ChestGlyph status={status} tone={chest.tone} />
        <div className="cx-card-copy">
          <div className="cx-card-kicker">
            {chest.kind === 'streak' ? t('Cofre de racha') : t('Cofre clínico')}
            {chest.kind === 'streak' ? ` · ${chest.days} ${t('días')}` : ''}
          </div>
          <h3>{t(chest.title)}</h3>
          <p>{t(chest.hint)}</p>
        </div>
        <div className="cx-xp">+{chest.xp.toLocaleString('es-ES')}</div>
      </div>

      {status !== 'claimed' && (
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
          <span>{remainLabel(chest, streak, t)}</span>
        </div>
      )}

      {clinical && status === 'locked' && (
        <div className="cx-meta">
          {clinical.progress.toLocaleString('es-ES')} / {clinical.goal.toLocaleString('es-ES')} {t(clinical.unit)}
        </div>
      )}

      {status === 'ready' && (
        <IonButton expand="block" className="bt bt-gold cx-claim" onClick={() => onClaim(chest.id)}>
          {t('Reclamar cofre')} · +{chest.xp.toLocaleString('es-ES')} XP
        </IonButton>
      )}
      {status === 'claimed' && (
        <div className="cx-claimed">
          <IonIcon icon={checkmarkCircle} /> {t('Reclamado')} · +{chest.xp.toLocaleString('es-ES')} XP
        </div>
      )}
    </motion.article>
  )
}

export function NextChestGoal({
  chest,
  streak,
}: {
  chest: StreakChest
  streak: number
}) {
  const t = useT()
  const pct = Math.min(1, streak / chest.days)
  const remain = Math.max(0, chest.days - streak)
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
          <div className="ct">{t(chest.title)}</div>
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
        {streak} {t('de')} {chest.days} · +{chest.xp.toLocaleString('es-ES')} XP {t('al abrir')}
      </div>
    </div>
  )
}

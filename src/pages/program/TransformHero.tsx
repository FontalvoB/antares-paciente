import type { CSSProperties } from 'react'
import { IonIcon, IonProgressBar } from '@ionic/react'
import { motion } from 'framer-motion'
import { chevronForward, flag, flame, gift, sparkles, trophy } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import { useT } from '../../i18n/I18nContext'
import { CountUp } from './visuals'

export function TransformHero({
  greeting,
  first,
  programWeek,
  programWeeks,
  level,
  levelName,
  levelPct,
  pointsTotal,
  xpToNext,
  nextLevelName,
  streak,
  healthScore,
  stateRank,
  stateName,
  readyChests,
  allDone,
  onOpenStreak,
  onOpenEvo,
  onOpenLiga,
  onOpenChests,
}: {
  greeting: string
  first: string
  programWeek: number
  programWeeks: number
  level: number
  levelName: string
  levelPct: number
  pointsTotal: number
  xpToNext: number
  nextLevelName: string
  streak: number
  healthScore: number
  stateRank: number
  stateName: string
  readyChests: number
  allDone: boolean
  onOpenStreak: () => void
  onOpenEvo: () => void
  onOpenLiga: () => void
  onOpenChests: () => void
}) {
  const t = useT()

  return (
    <header className="hero hero-cosmos tx-hero">
      <span className="tx-aurora a1" aria-hidden="true" />
      <span className="tx-aurora a2" aria-hidden="true" />
      <span className="tx-aurora a3" aria-hidden="true" />

      <div className="tx-top">
        <div className="tx-kicker">
          <IonIcon icon={sparkles} />
          {t('Mi transformación')}
        </div>
        <span className="tx-week">
          {t('Semana')} {programWeek}/{programWeeks}
        </span>
      </div>

      <div className="tx-identity">
        <button
          type="button"
          className="tx-orb-btn"
          onClick={onOpenEvo}
          aria-label={t('Ver evolución y Health Score')}
        >
          <RingProgress
            value={levelPct}
            size={92}
            stroke={7}
            trackColor="rgba(255,255,255,0.12)"
            gradient={['#62d8ff', '#1d9e75']}
            glow
          >
            <b className="tx-lvl-num">{level}</b>
            <small>{t('Nivel')}</small>
          </RingProgress>
        </button>
        <div className="tx-hello">
          <div className="tx-greet">
            {greeting}, {first}
          </div>
          <div className="tx-title">{t(levelName)}</div>
          <p className="tx-copy">{t('Cada día cuenta. Sigue el protocolo y reclama tus cofres.')}</p>
        </div>
      </div>

      <div className="tx-xp">
        <div className="tx-xp-row">
          <span>{pointsTotal.toLocaleString('es-ES')} XP</span>
          <span>
            {xpToNext > 0
              ? t('{xp} XP para {name}', { xp: xpToNext.toLocaleString('es-ES'), name: t(nextLevelName) })
              : t('Nivel máximo')}
          </span>
        </div>
        <IonProgressBar
          className="pb tx-xp-bar"
          value={levelPct}
          style={
            {
              '--background': 'rgba(255,255,255,.12)',
              '--progress-background': 'linear-gradient(90deg,#62d8ff,#1d9e75)',
            } as CSSProperties
          }
        />
      </div>

      <div className="tx-docks">
        <button type="button" className={`tx-dock streak ${allDone ? 'hot' : ''}`} onClick={onOpenStreak}>
          <span className="tx-dock-ico">
            <IonIcon icon={flame} />
          </span>
          <strong>
            <CountUp to={streak} duration={0.8} />
          </strong>
          <small>{t('Racha')}</small>
        </button>
        <button type="button" className="tx-dock health" onClick={onOpenEvo}>
          <span className="tx-dock-ico">
            <IonIcon icon={trophy} />
          </span>
          <strong>{healthScore}</strong>
          <small>Health</small>
        </button>
        <button type="button" className="tx-dock liga" onClick={onOpenLiga}>
          <span className="tx-dock-ico">
            <IonIcon icon={flag} />
          </span>
          <strong>#{stateRank}</strong>
          <small>{t(stateName)}</small>
        </button>
        <button type="button" className={`tx-dock chests ${readyChests > 0 ? 'ready' : ''}`} onClick={onOpenChests}>
          <span className="tx-dock-ico">
            <IonIcon icon={gift} />
          </span>
          <strong>{readyChests > 0 ? readyChests : '—'}</strong>
          <small>{readyChests > 0 ? t('Listos') : t('Cofres')}</small>
          {readyChests > 0 && <span className="tx-dock-pulse" aria-hidden="true" />}
        </button>
      </div>

      {readyChests > 0 && (
        <motion.button
          type="button"
          className="tx-claim-banner"
          onClick={onOpenChests}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <IonIcon icon={gift} />
          <span>
            {t('{n} cofres listos para reclamar', { n: String(readyChests) })}
          </span>
          <IonIcon icon={chevronForward} />
        </motion.button>
      )}
    </header>
  )
}

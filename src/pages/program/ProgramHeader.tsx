import { IonIcon, IonSegment, IonSegmentButton } from '@ionic/react'
import { motion } from 'framer-motion'
import { chevronForward, gift } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import { useT } from '../../i18n/I18nContext'
import { CountUp } from './visuals'
import type { ProgramTab } from './Lessons'

/**
 * Cabecera del módulo de protocolo diario: aviso de cofres, tarjeta de la
 * unidad del día y las cuatro secciones (Hoy / Racha / Liga / Evo).
 */
export function ProgramHeader({
  programWeek,
  doneCount,
  total,
  allDone,
  pointsToday,
  pointsMax,
  readyChests,
  tab,
  onTab,
  onOpenChests,
}: {
  programWeek: number
  doneCount: number
  total: number
  allDone: boolean
  pointsToday: number
  pointsMax: number
  readyChests: number
  tab: ProgramTab
  onTab: (tab: ProgramTab) => void
  onOpenChests: () => void
}) {
  const t = useT()

  return (
    <header className="pgh">
      {readyChests > 0 && (
        <motion.button
          type="button"
          className="pgh-banner"
          onClick={onOpenChests}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <IonIcon icon={gift} />
          <span>{t('{n} cofres listos para reclamar', { n: String(readyChests) })}</span>
          <IonIcon icon={chevronForward} className="pgh-banner-arrow" />
        </motion.button>
      )}

      <div className="pgh-unit">
        <RingProgress
          value={doneCount / total}
          size={58}
          stroke={4}
          trackColor="#e3e9f1"
          color="var(--brand-green)"
        >
          <b>
            <CountUp to={doneCount} duration={0.6} />
          </b>
          <small>/{total}</small>
        </RingProgress>
        <div className="pgh-unit-copy">
          <span className="pgh-unit-kicker">
            {t('Unidad')} {programWeek}
          </span>
          <strong>{allDone ? t('Día perfecto') : t('Protocolo de hoy')}</strong>
          <small>
            {allDone
              ? t('Racha protegida · cofre abierto')
              : `${pointsToday} / ${pointsMax} XP`}
          </small>
        </div>
      </div>

      <div className="pgh-tabs">
        <IonSegment value={tab} onIonChange={(e) => onTab((e.detail.value as ProgramTab) || 'hoy')}>
          <IonSegmentButton value="hoy">{t('Hoy')}</IonSegmentButton>
          <IonSegmentButton value="racha">{t('Racha')}</IonSegmentButton>
          <IonSegmentButton value="liga">{t('Liga')}</IonSegmentButton>
          <IonSegmentButton value="evo">{t('Evo')}</IonSegmentButton>
        </IonSegment>
      </div>
    </header>
  )
}

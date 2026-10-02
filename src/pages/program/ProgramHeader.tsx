import { useState } from 'react'
import { IonButton, IonIcon, IonItem, IonList, IonPopover, IonSegment, IonSegmentButton } from '@ionic/react'
import { motion } from 'framer-motion'
import { calendarOutline, chevronForward, flame, gift, menuOutline, notificationsOutline, star, trophyOutline, locateOutline } from 'ionicons/icons'
import logoIcon from '../../assets/LogoIndividual.png'
import { NotificationsModal } from '../../components/notifications/NotificationsModal'
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
  const [menuEvent, setMenuEvent] = useState<Event>()
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  return (
    <header className="pgh">
      <div className="pgh-topbar">
        <div className="hm-wordmark" aria-label="COPP-ADRESD">
          <img src={logoIcon} alt="" />
          <div><strong>COPP-ADRESD<sup>®</sup></strong><small>COMPREHENSIVE OBESITY<br />PREVENTION PROGRAM</small></div>
        </div>
        <div className="pgh-actions">
          <IonButton fill="clear" aria-label={t('Notificaciones')} onClick={() => setNotificationsOpen(true)}><IonIcon slot="icon-only" icon={notificationsOutline} /></IonButton>
          <IonButton fill="clear" aria-label={t('Menú')} onClick={(event) => setMenuEvent(event.nativeEvent)}><IonIcon slot="icon-only" icon={menuOutline} /></IonButton>
        </div>
      </div>
      <IonPopover isOpen={!!menuEvent} event={menuEvent} onDidDismiss={() => setMenuEvent(undefined)} dismissOnSelect>
        <IonList>
          <IonItem button onClick={() => onTab('hoy')}>{t('Hoy')}</IonItem>
          <IonItem button onClick={() => onTab('racha')}>{t('Racha')}</IonItem>
          <IonItem button onClick={() => onTab('liga')}>{t('Liga')}</IonItem>
          <IonItem button onClick={() => onTab('evo')}>{t('Evo')}</IonItem>
        </IonList>
      </IonPopover>
      {notificationsOpen && <NotificationsModal isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />}
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
          value={total > 0 ? doneCount / total : 0}
          size={68}
          stroke={6}
          trackColor="var(--home-sky)"
          gradient={['var(--home-aqua)', 'var(--brand-green-soft)']}
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
        <span className="pgh-progress-label"><IonIcon icon={locateOutline} aria-hidden="true" />{t('Tu progreso hoy')}</span>
      </div>

      <div className="pgh-tabs">
        <IonSegment value={tab} onIonChange={(e) => onTab((e.detail.value as ProgramTab) || 'hoy')}>
          <IonSegmentButton layout="icon-start" value="hoy"><IonIcon icon={calendarOutline} />{t('Hoy')}</IonSegmentButton>
          <IonSegmentButton layout="icon-start" value="racha"><IonIcon icon={flame} />{t('Racha')}</IonSegmentButton>
          <IonSegmentButton layout="icon-start" value="liga"><IonIcon icon={trophyOutline} />{t('Liga')}</IonSegmentButton>
          <IonSegmentButton layout="icon-start" value="evo"><IonIcon icon={star} />{t('Evo')}</IonSegmentButton>
        </IonSegment>
      </div>
    </header>
  )
}

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IonButton, IonIcon, IonModal } from '@ionic/react'
import { heartOutline, sparklesOutline } from 'ionicons/icons'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'
import { programKeys } from '../hooks/queryKeys'
import type { ProgramSnapshotDto } from '../services/program/types'
import { markProtocolReminderSeen, protocolReminderDelay, reminderKey } from '../utils/dailyProtocolReminder'

/** Observa la consulta existente: no inscribe ni consulta de nuevo al paciente. */
export function DailyProtocolReminder() {
  const { flow, screen, panicOpen, voiceOpen, realMode, user, navigate } = useApp()
  const t = useT()
  const { data: snapshot } = useQuery<ProgramSnapshotDto>({ queryKey: programKeys.snapshot, enabled: false })
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(document.visibilityState !== 'hidden')
  const pending = snapshot?.todayTasks.filter(task => task.status !== 'Completed').length ?? 0
  const key = snapshot ? reminderKey(snapshot.enrollmentId, snapshot.todayLocalDate) : null
  const eligible = realMode && flow === 'app' && screen === 'home' && !panicOpen && !voiceOpen && visible && pending > 0 && snapshot?.template.currentWeekStatus === 'Active'

  useEffect(() => {
    const change = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])
  useEffect(() => {
    if (!eligible || !key || open) return
    let timer: number
    const show = () => {
      // Otro tab puede haber mostrado el aviso mientras este temporizador esperaba.
      const remaining = protocolReminderDelay(key)
      if (remaining > 0) {
        timer = window.setTimeout(show, remaining)
        return
      }
      markProtocolReminderSeen(key)
      setOpen(true)
    }
    timer = window.setTimeout(show, Math.max(12_000, protocolReminderDelay(key)))
    return () => window.clearTimeout(timer)
  }, [eligible, key, pending, open])
  useEffect(() => {
    if (!eligible) setOpen(false)
  }, [eligible])

  return <IonModal isOpen={open && eligible} onDidDismiss={() => setOpen(false)} className="daily-protocol-reminder">
    <div className="daily-reminder-card"><div className="daily-reminder-art"><IonIcon icon={heartOutline} /><IonIcon icon={sparklesOutline} /></div><span className="protocol-eyebrow">{t('Un momento para tu bienestar')}</span><h2>{t('Tu salud te espera, {name}', { name: user.nombre.trim().split(' ')[0] || t('vamos') })}</h2><p>{t('Tienes {count} actividades pendientes en tu protocolo de hoy. Empieza con un paso pequeño.', { count: String(pending) })}</p><IonButton expand="block" className="bt bt-primary" onClick={() => { setOpen(false); navigate('prog') }}>{t('Empezar mi protocolo')}</IonButton><IonButton expand="block" fill="clear" onClick={() => setOpen(false)}>{t('Más tarde')}</IonButton></div>
  </IonModal>
}

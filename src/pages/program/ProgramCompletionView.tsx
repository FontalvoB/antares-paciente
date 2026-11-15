import { useRef, useState } from 'react'
import { IonButton, IonCard, IonCardContent, IonChip, IonIcon, IonModal, IonSpinner } from '@ionic/react'
import { calendarOutline, checkmarkOutline, checkmarkCircleOutline, flameOutline, sparklesOutline, trophyOutline } from 'ionicons/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../i18n/I18nContext'
import { enrollMe, getProgramCompletion } from '../../services/program/program-service'
import type { ProgramCompletionDto, ProgramEnrollmentDto } from '../../services/program/types'
import { programInvalidation, programKeys } from '../../hooks/queryKeys'
import { ApiError } from '../../utils/apiClient'
import { getAccessToken } from '../../utils/authApi'
import { sessionUserId } from '../../utils/sessionIdentity'
import { formatDateForDisplay } from '../../utils/dates'

/** Resumen de dominio: métricas del DTO 4.2, sin inferir indicadores clínicos. */
export function ProgramCompletionView({ completion, started, onStarted, onHome, onEvolution }: {
  completion: ProgramCompletionDto | null
  started: ProgramEnrollmentDto | null
  onStarted: (enrollment: ProgramEnrollmentDto) => void
  onHome: () => void
  onEvolution: () => void
}) {
  const { t, lang } = useI18n()
  const client = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [checkedCanStart, setCheckedCanStart] = useState<boolean | null>(null)
  const submitting = useRef(false)
  const confirmAccount = useRef<string | null>(null)
  const number = (value: number) => value.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES')
  const canStart = completion?.canStartNewProgram === true && checkedCanStart !== false

  const start = async () => {
    if (submitting.current || !completion || !canStart) return
    submitting.current = true
    setBusy(true)
    try {
      // Hoy en la zona del programa; nunca omitir fecha y volver al lunes por defecto.
      const startLocalDate = new Intl.DateTimeFormat('en-CA', { timeZone: completion.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const enrollment = await enrollMe(completion.timezone, startLocalDate, confirmAccount.current)
      setConfirm(false)
      onStarted(enrollment)
      void programInvalidation.afterEnrollment(client)
    } catch (error) {
      setConfirm(false)
      setFailure(error instanceof ApiError && error.status === 409
        ? 'Ya tienes otro programa activo o pendiente. Comprueba su estado para continuar.'
        : error instanceof ApiError && error.status === 422
          ? 'No hay un programa disponible para iniciar. Consulta con tu equipo de salud.'
          : error instanceof ApiError && error.status === 401
            ? 'Tu sesión ha cambiado o caducado. Vuelve a iniciar sesión.'
            : error instanceof ApiError && error.status === 403
              ? 'No tienes acceso para iniciar un programa nuevo. Consulta con tu equipo de salud.'
              : 'No pudimos confirmar el inicio. Comprueba el estado antes de volver a intentarlo.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const check = async () => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      const userId = sessionUserId(getAccessToken())
      const result = await client.fetchQuery({ queryKey: [...programKeys.completion, userId], queryFn: ({ signal }) => getProgramCompletion(signal, userId), staleTime: 0 })
      setCheckedCanStart(result.completion?.canStartNewProgram === true)
      setFailure(null)
      void client.invalidateQueries({ queryKey: programKeys.snapshot })
    } catch {
      setFailure('No pudimos comprobar el estado de tu programa. Vuelve a intentarlo.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (started) return <section className="program-completion program-completion-success" data-testid="program-new-started" role="status">
    <span className="program-completion-success-icon" aria-hidden="true"><IonIcon icon={checkmarkOutline} /></span>
    <h1>{t('Tu programa nuevo está en marcha')}</h1>
    <p>{t('Tu progreso anterior queda guardado. Puedes consultar tus indicadores en Evolución.')}</p>
    <IonCard><IonCardContent><IonIcon icon={calendarOutline} /><div><strong>{t('Un nuevo comienzo')}</strong><p>{started.status === 'PendingAssignment' ? t('Tu equipo de salud está preparando tu programa.') : t('Consulta tus actividades en el protocolo diario.')}</p></div></IonCardContent></IonCard>
    <IonButton expand="block" className="program-completion-primary" onClick={onHome}>{t('Ir al inicio')}</IonButton>
  </section>

  if (!completion) return null
  const metrics = [
    { icon: calendarOutline, value: t('{done} de {total}', { done: number(completion.perfectDays), total: number(completion.totalDays) }), label: 'Días con todas tus misiones' },
    { icon: flameOutline, value: t('{n} días', { n: number(completion.longestStreak) }), label: 'Tu mejor racha' },
    { icon: checkmarkCircleOutline, value: number(completion.tasksCompleted), label: 'Misiones completadas' },
    { icon: sparklesOutline, value: number(completion.xpEarned), label: 'Puntos de experiencia' },
  ]
  return <section className="program-completion" data-testid="program-completion">
    <header>
      <IonChip><IonIcon icon={checkmarkOutline} />{t('Programa completado')}</IonChip>
      <div className="program-completion-trophy" aria-hidden="true"><IonIcon icon={trophyOutline} /></div>
      <h1>{t('¡Terminaste tu programa!')}</h1>
      <p>{t('{weeks} semanas · {days} días de programa', { weeks: number(completion.completedWeeks), days: number(completion.totalDays) })}</p>
      <p className="program-completion-period">{completion.templateName}<br />{formatDateForDisplay(completion.startLocalDate)} – {formatDateForDisplay(completion.endLocalDate)}</p>
    </header>
    <div className="program-completion-metrics">{metrics.map(metric => <IonCard key={metric.label}><IonCardContent><IonIcon icon={metric.icon} aria-hidden="true" /><strong>{metric.value}</strong><span>{t(metric.label)}</span></IonCardContent></IonCard>)}</div>
    <p className="program-completion-activity">{t('{n} días con actividad registrada', { n: number(completion.daysWithActivity) })}</p>
    <footer>
      {failure ? <div className="program-completion-error" role="alert"><p>{t(failure)}</p><IonButton fill="outline" expand="block" disabled={busy} onClick={() => void check()}>{busy ? <IonSpinner name="crescent" /> : t('Comprobar estado')}</IonButton></div>
        : canStart ? <><p>{t('El programa nuevo no empieza solo: tú decides cuándo.')}</p><IonButton data-testid="program-new-open" expand="block" className="program-completion-primary" onClick={() => { confirmAccount.current = sessionUserId(getAccessToken()); setConfirm(true) }}><IonIcon slot="start" icon={trophyOutline} />{t('Iniciar programa nuevo')}</IonButton></>
          : <p role="status">{t('Ya tienes otro programa activo o pendiente. Puedes consultarlo desde Inicio.')}</p>}
      <IonButton fill="clear" expand="block" onClick={onEvolution}>{t('Ver mi evolución')}</IonButton>
      <IonButton fill="clear" expand="block" onClick={onHome}>{t('Volver a Inicio')}</IonButton>
    </footer>
    <IonModal isOpen={confirm} onDidDismiss={() => setConfirm(false)} canDismiss={!busy} className="program-completion-modal" aria-labelledby="program-new-title" aria-describedby="program-new-description">
      <div className="program-completion-confirm">
        <h2 id="program-new-title">{t('¿Iniciar un programa nuevo?')}</h2>
        <p id="program-new-description">{t('Al confirmar empiezas un programa nuevo desde la semana 1. Nada empieza sin que tú lo pidas. Tu progreso anterior queda guardado.')}</p>
        <IonButton data-testid="program-new-confirm" expand="block" className="program-completion-primary" disabled={busy || !canStart} onClick={() => void start()}>{busy ? <IonSpinner name="crescent" /> : t('Sí, iniciar programa nuevo')}</IonButton>
        <IonButton fill="clear" expand="block" disabled={busy} onClick={() => setConfirm(false)}>{t('Todavía no')}</IonButton>
      </div>
    </IonModal>
  </section>
}

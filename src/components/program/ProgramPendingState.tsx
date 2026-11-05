import { IonButton, IonCard, IonCardContent, IonChip, IonIcon, IonProgressBar, IonSkeletonText, IonSpinner } from '@ionic/react'
import { arrowBackOutline, checkmarkOutline, clipboardOutline, heartOutline, pauseOutline, refreshOutline, shieldCheckmarkOutline, sparklesOutline, timeOutline } from 'ionicons/icons'
import { useT } from '../../i18n/I18nContext'
import type { ProgramState } from '../../hooks/useProgram'
import vitaPortrait from '../../assets/vita-coach.png'

export function ProgramPendingState({ loading, state, message, onTests, onRetry, completedAssessments, onHome }: {
  loading: boolean
  state: ProgramState
  message: string | null
  onTests: () => void
  onRetry: () => void
  completedAssessments?: number | null
  onHome?: () => void
}) {
  const t = useT()
  const pendingTests = state === 'pending-tests'
  const pendingClinical = state === 'pending-assignment'
  const count = completedAssessments != null && Number.isFinite(completedAssessments) ? Math.max(0, Math.min(9, completedAssessments)) : null
  if (!loading && (pendingTests || pendingClinical)) return (
    <section className="program-setup" aria-live="polite">
      <header className="program-setup-top"><span>{t('Mi programa')}</span><IonChip>{pendingTests ? t('Plan pendiente') : t('Pendiente de confirmación clínica')}</IonChip></header>
      <div className="program-setup-hero">
        <div><h1>{pendingClinical ? t('Tus evaluaciones ya están completas') : t('Tu plan empieza contigo')}</h1><p>{pendingClinical ? t('El siguiente paso es preparar y confirmar tu plan. Aquí lo encontrarás cuando esté listo.') : t('Conocer tu salud y tus hábitos nos ayuda a construir un programa pensado para ti.')}</p></div>
        <div className="program-setup-portrait"><img src={vitaPortrait} alt="" /><span><IonIcon icon={sparklesOutline} />Vita</span></div>
      </div>
      <IonCard className="program-setup-progress"><IonCardContent>
        <div className="program-setup-progress-top"><span className="program-setup-icon"><IonIcon icon={pendingClinical ? checkmarkOutline : clipboardOutline} /></span><div><h2>{pendingClinical ? t('Tu punto de partida está listo') : t('Tu punto de partida')}</h2>{count !== null && <p>{t('{completed} de {total} evaluaciones', { completed: String(count), total: '9' })}</p>}</div></div>
        {pendingTests && count !== null && <IonProgressBar value={count / 9} aria-label={t('Progreso de tus evaluaciones')} />}
        <p className="program-setup-progress-copy">{pendingTests ? t('Cada evaluación suma una pieza de tu historia. Puedes avanzar paso a paso.') : t('Tus resultados orientarán las recomendaciones de tu equipo de salud.')}</p>
        {pendingTests && <IonButton expand="block" onClick={onTests}>{t('Completar mis evaluaciones')}</IonButton>}
      </IonCardContent></IonCard>
      <section className="program-setup-path"><h2>{t('Así construiremos tu plan')}</h2>
        <ol aria-label={t('Los pasos de tu programa')}>
          <li className={pendingClinical ? 'done' : 'current'}><span>{pendingClinical ? <IonIcon icon={checkmarkOutline} /> : '1'}</span><div><h3>{t('Completa tus evaluaciones')}</h3><p>{t('Tu salud, hábitos y bienestar en una sola batería.')}</p></div></li>
          <li className={pendingClinical ? 'current' : ''}><span><IonIcon icon={sparklesOutline} /></span><div><h3>{t('Preparamos tu propuesta')}</h3><p>{t('Tus resultados son la base de un plan personalizado.')}</p></div></li>
          <li><span><IonIcon icon={shieldCheckmarkOutline} /></span><div><h3>{t('Tu equipo confirma el plan')}</h3><p>{t('La revisión profesional va antes de activar tu programa.')}</p></div></li>
        </ol>
      </section>
      <aside className="program-setup-note"><IonIcon icon={heartOutline} /><div><strong>{t('Cada paso cuenta')}</strong><p>{t('Tus evaluaciones completadas quedan guardadas en tu perfil.')}</p></div></aside>
    </section>
  )
  const availability = state === 'paused'
    ? { title: 'Tu programa está en pausa', description: 'Tu equipo de salud debe confirmar cuándo retomar tus actividades.', icon: pauseOutline }
    : state === 'withdrawn'
      ? { title: 'Tu programa no está activo', description: 'Consulta con tu equipo de salud para conocer los siguientes pasos.', icon: shieldCheckmarkOutline }
      : state === 'no-template'
        ? { title: 'Tu programa aún no está disponible', description: 'Las actividades aparecerán aquí cuando tu equipo active el programa.', icon: timeOutline }
        : { title: 'Tu programa no cargó', description: message ?? 'No pudimos recuperar tus actividades ahora. Puedes reintentar o volver a Inicio.', icon: refreshOutline }
  return (
    <section className="program-state" data-program-state={loading ? 'loading' : state} role="status" aria-label={loading ? t('Cargando tu programa') : t('Estado de tu programa')} aria-live="polite" aria-busy={loading}>
      <header className="program-state-top">
        {onHome && <IonButton fill="clear" className="program-state-back" aria-label={t('Volver')} onClick={onHome}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton>}
        <span>{t('Mi programa')}</span>
      </header>
      <div className="program-state-body">
        <div className="program-state-art" aria-hidden="true"><span className="program-state-orbit" /><span className="program-state-symbol">{loading ? <IonSpinner name="crescent" /> : <IonIcon icon={availability.icon} />}</span><span className="program-state-spark"><IonIcon icon={sparklesOutline} /></span></div>
        <span className="program-state-eyebrow">{loading ? t('Un momento') : state === 'recoverable' ? t('Vamos paso a paso') : t('Tu bienestar, a tu ritmo')}</span>
        <h1>{loading ? t('Cargando tu programa') : t(availability.title)}</h1>
        <p className="program-state-description">{loading ? t('Estamos cargando tus actividades del día.') : t(availability.description)}</p>
        {loading ? <div className="program-state-skeletons" aria-hidden="true">{[0, 1, 2].map(index => <div key={index}><IonSkeletonText animated className="program-state-skeleton-icon" /><span><IonSkeletonText animated /><IonSkeletonText animated /></span></div>)}</div> : <div className="program-state-actions">
          {state === 'recoverable' && <IonButton expand="block" className="program-state-retry" onClick={onRetry}><IonIcon slot="start" icon={refreshOutline} />{t('Reintentar')}</IonButton>}
          {onHome && <IonButton expand="block" fill="outline" className="program-state-home" onClick={onHome}>{t('Volver a Inicio')}</IonButton>}
        </div>}
      </div>
      {!loading && <p className="program-state-footnote">{state === 'recoverable' ? t('Si el problema continúa, vuelve a intentarlo más tarde.') : t('Puedes regresar a esta pantalla desde tu protocolo diario.')}</p>}
    </section>
  )
}

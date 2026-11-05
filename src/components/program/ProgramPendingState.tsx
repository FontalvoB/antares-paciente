import { IonButton, IonCard, IonCardContent, IonChip, IonIcon, IonProgressBar, IonSkeletonText } from '@ionic/react'
import { checkmarkOutline, clipboardOutline, heartOutline, shieldCheckmarkOutline, sparklesOutline, timeOutline } from 'ionicons/icons'
import { useT } from '../../i18n/I18nContext'
import type { ProgramState } from '../../hooks/useProgram'
import vitaPortrait from '../../assets/vita-coach.png'

export function ProgramPendingState({ loading, state, message, onTests, onRetry, completedAssessments }: {
  loading: boolean
  state: ProgramState
  message: string | null
  onTests: () => void
  onRetry: () => void
  completedAssessments?: number | null
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
  return (
    <IonCard className="program-setup-fallback" style={{ borderRadius: 'var(--radius-md)', boxShadow: 'none', border: '1px solid var(--bd)' }}>
      <IonCardContent aria-live="polite" aria-busy={loading}>
        <p className="kicker">{t('Mi programa')}</p>
        {loading ? <>
          <IonSkeletonText animated style={{ width: '70%', height: 26 }} />
          <IonSkeletonText animated style={{ height: 64 }} />
        </> : <>
          <IonIcon aria-hidden="true" icon={timeOutline} style={{ fontSize: 32, color: 'var(--teal)', marginTop: 16 }} />
          <h1 className="h2" style={{ color: 'var(--tx)', margin: '12px 0' }}>
            {t('Tu programa')}
          </h1>
          <p style={{ color: 'var(--mu)', marginBottom: 16 }}>
            {t(message ?? 'No pudimos cargar tu programa en este momento. Intenta nuevamente.')}
          </p>
          {state === 'recoverable' && <IonButton expand="block" className="bt" onClick={onRetry}>{t('Reintentar')}</IonButton>}
        </>}
      </IonCardContent>
    </IonCard>
  )
}

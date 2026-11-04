import { IonButton, IonCard, IonCardContent, IonIcon, IonSkeletonText } from '@ionic/react'
import { clipboardOutline, timeOutline } from 'ionicons/icons'
import { useT } from '../../i18n/I18nContext'
import type { ProgramState } from '../../hooks/useProgram'

export function ProgramPendingState({ loading, state, message, onTests, onRetry }: {
  loading: boolean
  state: ProgramState
  message: string | null
  onTests: () => void
  onRetry: () => void
}) {
  const t = useT()
  const pendingTests = state === 'pending-tests'
  const pendingClinical = state === 'pending-assignment'
  return (
    <IonCard style={{ margin: 16, borderRadius: 'var(--radius-md)', boxShadow: 'none', border: '1px solid var(--bd)' }}>
      <IonCardContent aria-live="polite" aria-busy={loading}>
        <p className="kicker">{t('Mi programa')}</p>
        {loading ? <>
          <IonSkeletonText animated style={{ width: '70%', height: 26 }} />
          <IonSkeletonText animated style={{ height: 64 }} />
        </> : <>
          <IonIcon aria-hidden="true" icon={pendingTests ? clipboardOutline : timeOutline} style={{ fontSize: 32, color: 'var(--teal)', marginTop: 16 }} />
          <h1 className="h2" style={{ color: 'var(--tx)', margin: '12px 0' }}>
            {pendingTests ? t('Plan pendiente') : pendingClinical ? t('Pendiente de confirmación clínica') : t('Tu programa')}
          </h1>
          <p style={{ color: 'var(--mu)', marginBottom: 16 }}>
            {pendingTests
              ? t('Cada evaluación nos ayuda a conocerte mejor. Completa las 9 evaluaciones de la batería inicial para que tu equipo de salud prepare tu plan personalizado.')
              : pendingClinical
                ? t('Ya completaste tus 9 evaluaciones. Tu profesional está preparando tu plan personalizado. Aquí verás tus actividades cuando esté listo.')
                : t(message ?? 'No pudimos cargar tu programa en este momento. Intenta nuevamente.')}
          </p>
          {pendingTests && <IonButton expand="block" className="bt" onClick={onTests}>{t('Completar mis evaluaciones')}</IonButton>}
          {!pendingTests && !pendingClinical && state === 'recoverable' && <IonButton expand="block" className="bt" onClick={onRetry}>{t('Reintentar')}</IonButton>}
        </>}
      </IonCardContent>
    </IonCard>
  )
}

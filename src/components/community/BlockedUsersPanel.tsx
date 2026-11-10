import { useState } from 'react'
import { IonAlert, IonButton, IonItem, IonLabel, IonList, IonSpinner } from '@ionic/react'
import { banOutline } from 'ionicons/icons'
import type { BlockedProfile } from '../../graphql/community'
import { useI18n } from '../../i18n/I18nContext'
import { Avatar, EmptyState, ErrorCard, RowSkeleton } from './community'

/** Administración de los bloqueos salientes del usuario autenticado. */
export function BlockedUsersPanel({ profiles, loading, error, hasMore, onRetry, onLoadMore, onUnblock }: {
  profiles: BlockedProfile[]
  loading: boolean
  error: unknown
  hasMore: boolean
  onRetry: () => void
  onLoadMore: () => void
  onUnblock: (profileId: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [unblockError, setUnblockError] = useState(false)

  async function unblock(profileId: string) {
    if (busyId) return
    setBusyId(profileId)
    try { await onUnblock(profileId) }
    catch { setUnblockError(true) }
    finally { setBusyId(null) }
  }

  return <>
    <div style={{ padding: '0 14px 8px' }}>
      <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>{t('Usuarios bloqueados')}</h2>
      <p style={{ color: 'var(--mu)', fontSize: 13, margin: 0 }}>
        {t('Puedes desbloquear a estas personas en cualquier momento. Desbloquear no restablece el seguimiento entre ambos.')}
      </p>
    </div>
    {error ? <ErrorCard message={t('No se pudieron cargar los usuarios bloqueados.')} onRetry={onRetry} />
      : loading && profiles.length === 0 ? <RowSkeleton rows={3} />
        : profiles.length === 0 ? <EmptyState icon={banOutline} tone="pur" title={t('No tienes usuarios bloqueados.')} />
          : <IonList style={{ background: 'transparent' }}>
            {profiles.map(profile => <IonItem key={profile.profileId}>
              <Avatar name={profile.displayName} seedId={profile.profileId} src={profile.avatarUrl} size={38} />
              <IonLabel style={{ marginLeft: 10, whiteSpace: 'normal' }}>{profile.displayName}</IonLabel>
              <IonButton slot="end" fill="outline" disabled={busyId !== null} aria-label={t('Desbloquear a {name}', { name: profile.displayName })}
                onClick={() => { void unblock(profile.profileId) }} style={{ minHeight: 44 }}>
                {busyId === profile.profileId && <IonSpinner slot="start" name="crescent" />}
                {t('Desbloquear')}
              </IonButton>
            </IonItem>)}
          </IonList>}
    {!error && hasMore && <IonButton fill="clear" expand="block" disabled={loading} onClick={onLoadMore}>
      {loading ? <IonSpinner name="crescent" /> : t('Cargar más')}
    </IonButton>}
    <IonAlert isOpen={unblockError} header={t('No se pudo desbloquear al usuario.')}
      message={t('Revisa tu conexión e intenta de nuevo')} buttons={[t('Aceptar')]}
      onDidDismiss={() => setUnblockError(false)} />
  </>
}

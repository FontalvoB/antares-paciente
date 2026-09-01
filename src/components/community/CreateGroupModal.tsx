import { IonButton, IonCheckbox, IonIcon, IonInput, IonModal } from '@ionic/react'
import { close, people, personAddOutline } from 'ionicons/icons'
import { useState } from 'react'
import type { Profile } from '../../graphql/community'
import { useI18n } from '../../i18n/I18nContext'
import { Avatar } from './community'

/** Modal de creación de grupo: nombre + selección de amigos (mutual-friends). */
export function CreateGroupModal({
  isOpen,
  onClose,
  friends,
  onCreate,
  onToast,
  onOpenProfile,
  dark = false,
}: {
  isOpen: boolean
  onClose: () => void
  friends: Profile[]
  onCreate: (name: string, memberProfileIds: string[]) => Promise<unknown>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
  /** Click en el avatar del amigo → abre su perfil (sin seleccionarlo). */
  onOpenProfile?: (profileId: string) => void
  dark?: boolean
}) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const { t } = useI18n()

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function handleCreate() {
    if (name.trim().length < 3 || selected.length === 0 || creating) return
    setCreating(true)
    try {
      await onCreate(name.trim(), selected)
      onToast(t('Grupo creado'), 'ok')
      setName('')
      setSelected([])
      onClose()
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setCreating(false)
    }
  }

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className={dark ? 'com-dark-surface' : undefined}
    >
      <div className="com-detail" style={{ padding: 0 }}>
        <div className="com-banner" style={{ margin: '16px 16px 8px' }}>
          <div className="com-banner-main">
            <div className="com-banner-title">
              <IonIcon icon={people} /> {t('Nuevo grupo')}
            </div>
            <div className="com-banner-sub">
              <IonIcon icon={personAddOutline} /> {t('Elige a tus amigos para conversar')}
            </div>
          </div>
          <IonButton className="com-banner-close" onClick={onClose} aria-label={t('Cerrar')}>
            <IonIcon icon={close} />
          </IonButton>
        </div>
        <div style={{ padding: '12px 14px 4px' }}>
          <IonInput
            className="fld"
            label={t('Nombre del grupo')}
            labelPlacement="stacked"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? '')}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {friends.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 13, marginTop: 20, padding: '0 20px' }}>
              {t('No tienes amigos para añadir todavía.')}
            </div>
          ) : (
            friends.map((f) => (
              <div key={f.id} className="com-row" style={{ margin: '0 14px 8px', cursor: 'pointer' }} onClick={() => toggle(f.id)}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Avatar
                    name={f.displayName}
                    seedId={f.id}
                    size={38}
                    src={f.avatarUrl}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProfile?.(f.id)
                    }}
                  />                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="com-row-name">{f.displayName}</div>
                  </div>
                </div>
                <IonCheckbox checked={selected.includes(f.id)} onIonChange={() => toggle(f.id)} />
              </div>
            ))
          )}
        </div>
        <div
          style={{
            borderTop: '1px solid var(--g1)',
            padding: '10px 12px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <IonButton fill="outline" className="bt bt-mini" onClick={onClose}>
            {t('Cancelar')}
          </IonButton>
          <IonButton
            className="bt bt-pur bt-mini"
            disabled={name.trim().length < 3 || selected.length === 0 || creating}
            onClick={() => void handleCreate()}
          >
            {creating ? t('Creando…') : t('Crear grupo')}
          </IonButton>
        </div>
      </div>
    </IonModal>
  )
}

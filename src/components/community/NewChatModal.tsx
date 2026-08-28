import { IonButton, IonIcon, IonModal, IonSearchbar } from '@ionic/react'
import { arrowBack, chatbubbleEllipsesOutline, close, personAddOutline } from 'ionicons/icons'
import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../../graphql/community'
import { Avatar, EmptyState } from './community'

/** Modal "Nuevo chat": elige un amigo para iniciar una conversación directa.
 *  Con lista de filtro, ✕ y botón cancelar para volver a los chats. */
export function NewChatModal({
  open,
  onClose,
  friends,
  onPick,
  onOpenProfile,
  dark = false,
}: {
  open: boolean
  onClose: () => void
  friends: Profile[]
  onPick: (friend: Profile) => void
  /** Click en el avatar del amigo → abre su perfil (sin iniciar chat). */
  onOpenProfile?: (profileId: string) => void
  dark?: boolean
}) {
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return friends
    return friends.filter((f) => f.displayName.toLowerCase().includes(query))
  }, [friends, q])

  return (
    <IonModal
      isOpen={open}
      onDidDismiss={onClose}
      className={dark ? 'com-dark-surface' : undefined}
    >
      <div className="com-detail">
        <div className="com-banner">
          <div className="com-banner-main">
            <div className="com-banner-title">
              <IonIcon icon={personAddOutline} /> Nuevo chat
            </div>
            <div className="com-banner-sub">
              <IonIcon icon={chatbubbleEllipsesOutline} /> Elige un amigo para escribirle
            </div>
          </div>
          <IonButton className="com-banner-close" onClick={onClose} aria-label="Cerrar">
            <IonIcon icon={close} />
          </IonButton>
        </div>

        <div style={{ padding: '10px 2px 2px' }}>
          <IonSearchbar
            className="sbar"
            value={q}
            placeholder="Buscar amigo…"
            onIonInput={(e) => setQ(e.detail.value ?? '')}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 6 }}>
          {friends.length === 0 ? (
            <div style={{ paddingTop: 8 }}>
              <EmptyState
                icon={personAddOutline}
                tone="pur"
                title="No tienes amigos todavía"
                hint="Sigue a personas en Amigos para poder escribirles."
              />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={personAddOutline} tone="pur" title="Sin resultados" hint={`No encontramos a nadie para «${q}».`} />
          ) : (
            filtered.map((f) => (
              <div
                key={f.id}
                className="com-row"
                style={{ cursor: 'pointer' }}
                onClick={() => onPick(f)}
              >
                <div className="com-row-main">
                  <Avatar
                    name={f.displayName}
                    seedId={f.id}
                    size={40}
                    src={f.avatarUrl}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onOpenProfile?.(f.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="com-row-name">{f.displayName}</div>
                    <div className="com-row-sub">{f.bio?.trim() || 'Miembro ANTARES'}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="com-picker-foot">
          <IonButton fill="outline" className="bt bt-mini" onClick={onClose}>
            <IonIcon icon={arrowBack} style={{ marginRight: 4 }} /> Volver a Chats
          </IonButton>
        </div>
      </div>
    </IonModal>
  )
}

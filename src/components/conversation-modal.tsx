import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { IonAlert, IonButton, IonIcon, IonModal, IonSkeletonText, IonTextarea } from '@ionic/react'
import { arrowDown, close, people, personAddOutline, send } from 'ionicons/icons'
import { useQuery, useSubscription } from 'urql'
import {
  CONVERSATION_QUERY,
  GROUP_MEMBERS_QUERY,
  GROUP_MESSAGE_ADDED,
  GROUP_QUERY,
  MESSAGE_ADDED,
  conversationKey,
  type ChatGroup,
  type ConversationResult,
  type GroupHistoryResult,
  type GroupMembersResult,
  type GroupMessageAddedResult,
  type Message,
  type MessageAddedResult,
  type Profile,
} from '../graphql/community'

const AVATAR_GRADS = [
  'linear-gradient(135deg,#1B6CA8,#0A1F36)',
  'linear-gradient(135deg,#D4537E,#9B2D5A)',
  'linear-gradient(135deg,#E87B2B,#C05A0A)',
  'linear-gradient(135deg,#059669,#047857)',
]

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function byCreatedAsc(a: Message, b: Message): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function bubbleStyle(mine: boolean): CSSProperties {
  return {
    background: mine ? 'var(--teal)' : 'var(--wh)',
    color: mine ? '#fff' : 'var(--tx)',
    border: mine ? 'none' : '1px solid var(--bd)',
    borderRadius: 14,
    maxWidth: '78%',
    padding: '7px 11px',
    fontSize: 13,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
}

// Distancia al fondo (px) bajo la cual se considera que el usuario está
// "al día" y se hace scroll automático al mensaje nuevo.
const BOTTOM_THRESHOLD = 60

export function ConversationModal({
  peer,
  group,
  friends,
  me,
  open,
  onClose,
  onSend,
  onToast,
  onRemoveMember,
  onRenameGroup,
  onAddMember,
  onLeaveGroup,
}: {
  peer?: Profile
  group?: ChatGroup
  friends?: Profile[]
  me: Profile
  open: boolean
  onClose: () => void
  onSend: (body: string) => Promise<Message | null | undefined>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
  onRemoveMember?: (groupId: string, profileId: string) => Promise<unknown>
  onRenameGroup?: (groupId: string, name: string) => Promise<unknown>
  onAddMember?: (groupId: string, profileId: string) => Promise<unknown>
  onLeaveGroup?: (groupId: string) => Promise<unknown>
}) {
  const isGroup = !!group
  const key = peer ? conversationKey(me.id, peer.id) : (group?.id ?? '')

  const [query] = useQuery<ConversationResult>({
    query: CONVERSATION_QUERY,
    variables: { peerId: peer?.id ?? '', take: 50, skip: 0 },
    pause: !peer,
  })
  const [sub] = useSubscription<MessageAddedResult>({
    query: MESSAGE_ADDED,
    variables: { conversationKey: key },
    pause: !peer,
  })
  const [groupQuery] = useQuery<GroupHistoryResult>({
    query: GROUP_QUERY,
    variables: { groupId: group?.id ?? '', take: 50, skip: 0 },
    pause: !group,
  })
  const [groupSub] = useSubscription<GroupMessageAddedResult>({
    query: GROUP_MESSAGE_ADDED,
    variables: { groupId: group?.id ?? '' },
    pause: !group,
  })
  const [membersQuery] = useQuery<GroupMembersResult>({
    query: GROUP_MEMBERS_QUERY,
    variables: { groupId: group?.id ?? '' },
    pause: !group,
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  // Panel de miembros (solo modo grupo).
  const [membersOpen, setMembersOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const members = group ? (membersQuery.data?.groupMembers ?? []) : []
  const memberMap = new Map<string, Profile>(members.map((m) => [m.id, m]))
  const friendsToAdd = (friends ?? []).filter((f) => !memberMap.has(f.id))

  // Scroll inteligente: si el usuario está al fondo se baja solo al recibir un
  // mensaje; si subió a leer el historial, no se mueve y se muestra un badge
  // con el contador de mensajes nuevos (click → salta al fondo).
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const prevCountRef = useRef(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    nearBottomRef.current = true
    setUnreadCount(0)
  }, [])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD
    nearBottomRef.current = near
    if (near) setUnreadCount(0)
  }

  // Tras abrir el teclado / cambiar el tamaño de la ventana el área de
  // mensajes se reduce: si el usuario estaba al fondo, lo re-anclamos al
  // fondo para que siga viendo el último mensaje. Si subió a leer el
  // historial (fuera del umbral), no se mueve nada.
  const rePinAfterLayout = useCallback(() => {
    if (!nearBottomRef.current) return
    setTimeout(() => {
      if (nearBottomRef.current) scrollToBottom()
    }, 150)
  }, [scrollToBottom])

  // Inicializar desde la query (1:1) y fusionar sin duplicados.
  useEffect(() => {
    if (!query.data?.conversation) return
    const incoming = [...query.data.conversation].sort(byCreatedAsc)
    setMessages((prev) => {
      const merged = [...prev]
      for (const m of incoming) {
        if (!merged.some((x) => x.id === m.id)) merged.push(m)
      }
      return merged.sort(byCreatedAsc)
    })
  }, [query.data])

  // Inicializar desde la query (grupo) y fusionar sin duplicados.
  useEffect(() => {
    if (!groupQuery.data?.group) return
    const incoming = [...groupQuery.data.group].sort(byCreatedAsc)
    setMessages((prev) => {
      const merged = [...prev]
      for (const m of incoming) {
        if (!merged.some((x) => x.id === m.id)) merged.push(m)
      }
      return merged.sort(byCreatedAsc)
    })
  }, [groupQuery.data])

  // Mensajes en vivo por suscripción (1:1).
  useEffect(() => {
    const m = sub.data?.messageAdded
    if (!m) return
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort(byCreatedAsc)))
  }, [sub.data])

  // Mensajes en vivo por suscripción (grupo).
  useEffect(() => {
    const m = groupSub.data?.groupMessageAdded
    if (!m) return
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort(byCreatedAsc)))
  }, [groupSub.data])

  // Al abrir el modal: baja al fondo y resetea el contador de no leídos.
  useEffect(() => {
    if (!open) return
    prevCountRef.current = messages.length
    nearBottomRef.current = true
    setUnreadCount(0)
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Teclado / resize: al reducirse el viewport (teclado móvil, rotación)
  // re-anclamos al fondo solo si el usuario estaba al día.
  useEffect(() => {
    if (!open) return
    const onViewportChange = () => rePinAfterLayout()
    window.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('resize', onViewportChange)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('resize', onViewportChange)
    }
  }, [open, rePinAfterLayout])

  // Ante un mensaje nuevo: si el último es propio, bajar siempre; si es
  // entrante, bajar solo si el usuario está al fondo (si no, contar).
  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = messages.length
    if (messages.length <= prev || messages.length === 0 || loading) return
    const newest = messages[messages.length - 1]
    if (newest.senderProfileId === me.id) {
      scrollToBottom()
    } else if (nearBottomRef.current) {
      scrollToBottom()
    } else {
      setUnreadCount((c) => c + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, me.id])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      // El backend reproduce el mensaje por WebSocket, pero lo anexamos ya
      // para que el remitente lo vea de inmediato (sin esperar el eco).
      const sent = await onSend(text)
      if (sent) {
        setMessages((prev) =>
          prev.some((x) => x.id === sent.id) ? prev : [...prev, sent].sort(byCreatedAsc),
        )
      }
      setDraft('')
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setSending(false)
    }
  }

  // --- Acciones de miembros (solo modo grupo) ---

  async function handleAddMember(profileId: string) {
    if (!group || !onAddMember) return
    try {
      await onAddMember(group.id, profileId)
      onToast('Miembro añadido', 'ok')
    } catch (e) {
      onToast((e as Error).message, 'err')
    }
  }

  async function handleRemoveMember(m: Profile) {
    if (!group || !onRemoveMember) return
    try {
      await onRemoveMember(group.id, m.id)
      onToast('Miembro quitado', 'ok')
      setMembersOpen(false)
    } catch (e) {
      onToast((e as Error).message, 'err')
    }
  }

  async function handleRename(name: string) {
    if (!group || !onRenameGroup) return
    const trimmed = name.trim()
    if (trimmed.length < 1) return
    try {
      await onRenameGroup(group.id, trimmed)
      onToast('Grupo renombrado', 'ok')
    } catch (e) {
      onToast((e as Error).message, 'err')
    }
  }

  async function handleLeave() {
    if (!group || !onLeaveGroup) return
    try {
      await onLeaveGroup(group.id)
      onToast('Saliste del grupo', 'ok')
      setMembersOpen(false)
      onClose()
    } catch (e) {
      onToast((e as Error).message, 'err')
    }
  }

  const grad = isGroup
    ? AVATAR_GRADS[group!.name.charCodeAt(0) % AVATAR_GRADS.length]
    : AVATAR_GRADS[peer!.id.charCodeAt(0) % AVATAR_GRADS.length]
  const loading = (isGroup ? groupQuery.fetching : query.fetching) && messages.length === 0

  return (
    <>
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wh)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid var(--g1)' }}>
          <div className="avatar" style={{ width: 38, height: 38, background: grad, fontSize: 13 }}>
            {isGroup ? initialsOf(group!.name) : initialsOf(peer!.displayName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isGroup ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{group!.name}</div>
                <div
                  style={{ fontSize: 11, color: 'var(--mu)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => setMembersOpen(true)}
                >
                  <IonIcon icon={people} style={{ fontSize: 12 }} />
                  {`${group!.memberCount} ${group!.memberCount === 1 ? 'miembro' : 'miembros'}`}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{peer!.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>Amigos en la comunidad</div>
              </>
            )}
          </div>
          <IonButton fill="clear" size="small" onClick={onClose}><IonIcon icon={close} /></IonButton>
        </div>

        <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--g1)', padding: 12 }}>
          {loading ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end', marginBottom: 6 }}>
                  <IonSkeletonText style={{ width: '55%', height: 30, borderRadius: 14 }} animated />
                </div>
              ))}
            </>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 13, marginTop: 30 }}>
              Sin mensajes todavía. ¡Saluda!
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.senderProfileId === me.id
              if (isGroup) {
                const prev = messages[i - 1]
                const showName = !mine && (i === 0 || prev?.senderProfileId !== m.senderProfileId)
                const senderName = showName ? (memberMap.get(m.senderProfileId)?.displayName ?? '') : ''
                return (
                  <div
                    key={m.id}
                    style={{ display: 'flex', flexWrap: 'wrap', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 6 }}
                  >
                    {showName && senderName && (
                      <div style={{ width: '100%', fontSize: 11, color: 'var(--mu)', marginBottom: 2, paddingLeft: 2 }}>
                        {senderName}
                      </div>
                    )}
                    <div style={bubbleStyle(mine)}>{m.body}</div>
                  </div>
                )
              }
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                  <div style={bubbleStyle(mine)}>
                    {m.body}
                  </div>
                </div>
              )
            })
          )}
          </div>
          {unreadCount > 0 && (
            <IonButton
              shape="round"
              onClick={() => scrollToBottom(true)}
              style={
                {
                  position: 'absolute',
                  bottom: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 2,
                  '--background': 'var(--teal)',
                  '--color': '#fff',
                  '--box-shadow': '0 2px 8px rgba(20,33,59,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                } as CSSProperties
              }
              aria-label="Ir al último mensaje"
            >
              <IonIcon icon={arrowDown} />
              <span>{unreadCount}</span>
            </IonButton>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--g1)', padding: '10px 12px' }}>
          <IonTextarea
            className="fld draft-tx"
            value={draft}
            placeholder="Escribe un mensaje…"
            onIonInput={(e) => {
              setDraft(e.detail.value ?? '')
              rePinAfterLayout()
            }}
            onIonFocus={() => rePinAfterLayout()}
            autoGrow
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <IonButton className="bt bt-pur bt-mini" disabled={!draft.trim() || sending} onClick={() => void handleSend()}>
              {sending ? 'Enviando…' : (
                <>
                  <IonIcon icon={send} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Enviar
                </>
              )}
            </IonButton>
          </div>
        </div>
      </div>
    </IonModal>

    {/* Panel de miembros (solo modo grupo) */}
    <IonModal isOpen={membersOpen} onDidDismiss={() => setMembersOpen(false)}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wh)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid var(--g1)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Miembros</div>
          <IonButton fill="clear" size="small" onClick={() => setMembersOpen(false)}><IonIcon icon={close} /></IonButton>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 13, marginTop: 20 }}>
              Cargando miembros…
            </div>
          ) : (
            members.map((m) => {
              const isCreator = m.id === group?.createdByProfileId
              const isMe = m.id === me.id
              const canRemove = !isCreator && !isMe
              return (
                <div
                  key={m.id}
                  className="row-card"
                  style={canRemove ? { cursor: 'pointer' } : {}}
                  onClick={() => {
                    if (canRemove) setRemoveTarget(m)
                  }}
                >
                  <div
                    className="avatar"
                    style={{ width: 38, height: 38, fontSize: 13, background: AVATAR_GRADS[m.id.charCodeAt(0) % AVATAR_GRADS.length] }}
                  >
                    {initialsOf(m.displayName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{m.displayName}</div>
                  </div>
                  {isCreator && (
                    <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--teal)', border: '1px solid var(--teal-l)', borderRadius: 999, padding: '2px 8px', display: 'inline-flex', alignItems: 'center' }}>Creador</span>
                  )}
                  {isMe && (
                    <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--mu)', background: 'var(--g1)', borderRadius: 999, padding: '2px 8px', display: 'inline-flex', alignItems: 'center' }}>Tú</span>
                  )}
                </div>
              )
            })
          )}
        </div>
        <div style={{ borderTop: '1px solid var(--g1)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <IonButton className="bt bt-outline bt-mini" onClick={() => setAddOpen(true)}>
            <IonIcon icon={personAddOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Añadir miembro
          </IonButton>
          <IonButton className="bt bt-outline bt-mini" onClick={() => setRenameOpen(true)}>Renombrar grupo</IonButton>
          <IonButton
            fill="outline"
            className="bt bt-mini"
            style={{ '--color': 'var(--red)', borderColor: 'var(--red)' } as CSSProperties}
            onClick={() => setLeaveOpen(true)}
          >
            Salir del grupo
          </IonButton>
        </div>
      </div>
    </IonModal>

    {/* Selector para añadir miembro */}
    <IonModal isOpen={addOpen} onDidDismiss={() => setAddOpen(false)}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wh)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid var(--g1)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Añadir miembro</div>
          <IonButton fill="clear" size="small" onClick={() => setAddOpen(false)}><IonIcon icon={close} /></IonButton>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {friendsToAdd.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 13, marginTop: 20, padding: '0 20px' }}>
              Todos tus amigos ya están en el grupo.
            </div>
          ) : (
            friendsToAdd.map((f) => (
              <div
                key={f.id}
                className="row-card"
                style={{ cursor: 'pointer' }}
                onClick={() => void handleAddMember(f.id)}
              >
                <div
                  className="avatar"
                  style={{ width: 38, height: 38, fontSize: 13, background: AVATAR_GRADS[f.id.charCodeAt(0) % AVATAR_GRADS.length] }}
                >
                  {initialsOf(f.displayName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{f.displayName}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IonIcon icon={personAddOutline} style={{ fontSize: 14 }} /> Añadir
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </IonModal>

    {/* Confirmar quitar miembro */}
    <IonAlert
      isOpen={!!removeTarget}
      header="Quitar miembro"
      message={removeTarget ? `¿Quitar a ${removeTarget.displayName} del grupo?` : ''}
      buttons={[
        'Cancelar',
        {
          text: 'Quitar',
          role: 'destructive',
          handler: () => {
            if (removeTarget) void handleRemoveMember(removeTarget)
          },
        },
      ]}
      onDidDismiss={() => setRemoveTarget(null)}
    />

    {/* Renombrar grupo */}
    <IonAlert
      isOpen={renameOpen}
      header="Renombrar grupo"
      inputs={[{ name: 'name', type: 'text', placeholder: 'Nombre del grupo', value: group?.name ?? '' }]}
      buttons={[
        'Cancelar',
        {
          text: 'Guardar',
          handler: (values: { name?: string }) => {
            void handleRename(values.name ?? '')
          },
        },
      ]}
      onDidDismiss={() => setRenameOpen(false)}
    />

    {/* Salir del grupo */}
    <IonAlert
      isOpen={leaveOpen}
      header="Salir del grupo"
      message="¿Seguro que quieres salir de este grupo?"
      buttons={[
        'Cancelar',
        {
          text: 'Salir',
          role: 'destructive',
          handler: () => {
            void handleLeave()
          },
        },
      ]}
      onDidDismiss={() => setLeaveOpen(false)}
    />
    </>
  )
}

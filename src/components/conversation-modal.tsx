import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { IonAlert, IonButton, IonIcon, IonModal, IonSkeletonText, IonTextarea } from '@ionic/react'
import { arrowDown, close, people, personAddOutline, personRemoveOutline, send } from 'ionicons/icons'
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
import { Avatar, initialsOf } from './community/community'

function byCreatedAsc(a: Message, b: Message): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

/** Color del autor en grupos (paleta de marca, determinista por id). */
const SENDER_COLORS = ['var(--teal)', 'var(--blue)', 'var(--org)', 'var(--pur)', '#b45309']

function senderColor(id: string): string {
  return SENDER_COLORS[id.charCodeAt(0) % SENDER_COLORS.length]
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/** Etiqueta de separador de fecha estilo Telegram. */
function dayLabel(d: Date): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(d, today)) return 'Hoy'
  if (sameDay(d, yesterday)) return 'Ayer'
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

interface MessageMeta {
  mine: boolean
  /** Continúa el remitente anterior (mismo día): la burbuja se pega arriba. */
  groupedAbove: boolean
  /** El siguiente es del mismo remitente (mismo día): la burbuja se pega abajo. */
  groupedBelow: boolean
  dayChanged: boolean
  senderName: string
}

function buildMeta(messages: Message[], meId: string, isGroup: boolean, memberMap: Map<string, Profile>): MessageMeta[] {
  return messages.map((m, i) => {
    const mine = m.senderProfileId === meId
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const curDate = new Date(m.createdAt)
    const prevDate = prev ? new Date(prev.createdAt) : null
    const nextDate = next ? new Date(next.createdAt) : null
    const groupedAbove =
      !!prev && prev.senderProfileId === m.senderProfileId && prevDate !== null && sameDay(prevDate, curDate)
    const groupedBelow =
      !!next && next.senderProfileId === m.senderProfileId && nextDate !== null && sameDay(nextDate, curDate)
    const dayChanged = !prevDate || !sameDay(prevDate, curDate)
    const senderName = !mine && isGroup ? (memberMap.get(m.senderProfileId)?.displayName ?? '') : ''
    return { mine, groupedAbove, groupedBelow, dayChanged, senderName }
  })
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
  onOpenProfile,
  dark = false,
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
  /** Abre el perfil de un miembro (avatares clicables). */
  onOpenProfile?: (profileId: string) => void
  dark?: boolean
}) {
  // El modal conserva el último peer/grupo abierto mientras se anima el
  // cierre (mismo patrón que PostDetailModal): el componente queda montado y
  // solo cambia modalOpen, así Ionic reproduce la animación de dismiss en vez
  // de desmontarse de golpe.
  const [view, setView] = useState<{ peer: Profile | null; group: ChatGroup | null }>({
    peer: peer ?? null,
    group: group ?? null,
  })
  const [modalOpen, setModalOpen] = useState(!!(peer || group))

  useEffect(() => {
    if (!open) return
    setView((v) => ({ peer: peer ?? v.peer, group: group ?? v.group }))
    setModalOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, peer?.id, group?.id])

  // Al quitar el peer/grupo (✕ o backdrop) cierra con animación nativa.
  useEffect(() => {
    if (!open && (view.peer || view.group)) setModalOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const activePeer = view.peer ?? peer ?? null
  const activeGroup = view.group ?? group ?? null
  const isGroup = !!activeGroup
  const key = activePeer ? conversationKey(me.id, activePeer.id) : (activeGroup?.id ?? '')

  const handleDidDismiss = () => {
    setModalOpen(false)
    setView({ peer: null, group: null })
    onClose()
  }

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

  const loading = (isGroup ? groupQuery.fetching : query.fetching) && messages.length === 0

  // Sin datos no hay modal que renderizar (todos los hooks ya corrieron
  // arriba, incondicionales — no romper el orden de hooks).
  if (activePeer == null && activeGroup == null) return <></>

  return (
    <>
    <IonModal
      isOpen={modalOpen}
      onDidDismiss={handleDidDismiss}
      className={dark ? 'com-dark-surface' : undefined}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wh)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid var(--g1)' }}>
          {isGroup ? (
            <Avatar name={activeGroup!.name} seedId={activeGroup!.id} size={38} />
          ) : (
            <Avatar
              name={activePeer!.displayName}
              seedId={activePeer!.id}
              size={38}
              src={activePeer!.avatarUrl}
              style={{ cursor: 'pointer' }}
              onClick={() => onOpenProfile?.(activePeer!.id)}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isGroup ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{activeGroup!.name}</div>
                <div
                  style={{ fontSize: 11, color: 'var(--mu)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => setMembersOpen(true)}
                >
                  <IonIcon icon={people} style={{ fontSize: 12 }} />
                  {`${activeGroup!.memberCount} ${activeGroup!.memberCount === 1 ? 'miembro' : 'miembros'}`}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{activePeer!.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>Amigos en la comunidad</div>
              </>
            )}
          </div>
          <IonButton fill="clear" size="small" onClick={handleDidDismiss}><IonIcon icon={close} /></IonButton>
        </div>

        <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={scrollRef} onScroll={handleScroll} className="tg-bg" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
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
            (() => {
              const metas = buildMeta(messages, me.id, isGroup, memberMap)
              return metas.map((meta, i) => {
                const m = messages[i]
                return (
                  <div key={m.id} className="tg-day">
                    {meta.dayChanged && (
                      <div className="tg-sep">
                        <span>{dayLabel(new Date(m.createdAt))}</span>
                      </div>
                    )}
                    <div
                      className={`tg-row ${meta.mine ? 'mine' : ''}`}
                      style={{
                        marginTop: meta.groupedAbove ? 1 : 8,
                        marginBottom: meta.groupedBelow ? 0 : 8,
                      }}
                    >
                      <div
                        className={`tg-bubble ${meta.mine ? 'mine' : ''} ${meta.groupedAbove ? 'g-up' : ''} ${
                          meta.groupedBelow ? 'g-down' : ''
                        }`}
                      >
                        {!meta.mine && meta.senderName && (
                          <div className="tg-author" style={{ color: senderColor(m.senderProfileId) }}>
                            {meta.senderName}
                          </div>
                        )}
                        <div className="tg-text">{m.body}</div>
                        <div className="tg-time">{timeShort(m.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                )
              })
            })()
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

        <div style={{ borderTop: '1px solid var(--g1)', padding: '8px 12px 10px' }}>
          <div className="tg-input-row">
            <IonTextarea
              className="fld draft-tx tg-input"
              value={draft}
              placeholder="Escribe un mensaje…"
              onIonInput={(e) => {
                setDraft(e.detail.value ?? '')
                rePinAfterLayout()
              }}
              onIonFocus={() => rePinAfterLayout()}
              autoGrow
              rows={1}
            />
            <IonButton
              className={`tg-input-send ${draft.trim() ? 'bt-pur' : ''}`}
              disabled={!draft.trim() || sending}
              onClick={() => void handleSend()}
              aria-label="Enviar mensaje"
            >
              {sending ? (
                '…'
              ) : (
                <IonIcon icon={send} />
              )}
            </IonButton>
          </div>
        </div>
      </div>
    </IonModal>

    {/* Panel de miembros (solo modo grupo) */}
    <IonModal
      isOpen={membersOpen}
      onDidDismiss={() => setMembersOpen(false)}
      className={dark ? 'com-dark-surface' : undefined}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wh)' }}>
        <div className="gm-hero">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="gm-hero-main">
              <IonIcon icon={people} className="gm-hero-ico" /> Miembros
            </div>
            <div className="gm-hero-sub">
              {members.length} {members.length === 1 ? 'miembro' : 'miembros'} · {activeGroup?.name}
            </div>
          </div>
          <IonButton className="gm-close" onClick={() => setMembersOpen(false)} aria-label="Cerrar miembros">
            <IonIcon icon={close} />
          </IonButton>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 13, marginTop: 20 }}>
              Cargando miembros…
            </div>
          ) : (
            members.map((m) => {
              const isCreator = m.id === activeGroup?.createdByProfileId
              const isMe = m.id === me.id
              const canRemove = !isCreator && !isMe
              return (
                <button
                  key={m.id}
                  type="button"
                  className="gm-row"
                  onClick={() => {
                    if (canRemove) setRemoveTarget(m)
                    else onOpenProfile?.(m.id)
                  }}
                >
                  <span
                    className="gm-av"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      onOpenProfile?.(m.id)
                    }}
                    role="button"
                    aria-label={`Ver perfil de ${m.displayName}`}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.displayName} />
                    ) : (
                      initialsOf(m.displayName)
                    )}
                  </span>
                  <span className="gm-main">
                    <span className="gm-name">{m.displayName}</span>
                    <span className="gm-sub">
                      {isCreator
                        ? 'Creador del grupo'
                        : isMe
                          ? 'Eres tú'
                          : canRemove
                            ? 'Toques para quitar del grupo'
                            : 'Miembro del grupo'}
                    </span>
                  </span>
                  {isCreator && <span className="gm-badge creator">Creador</span>}
                  {isMe && <span className="gm-badge">Tú</span>}
                  {canRemove && (
                    <span className="gm-remove" aria-hidden>
                      <IonIcon icon={personRemoveOutline} />
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
        <div className="gm-foot">
          <IonButton className="gm-btn primary" onClick={() => setAddOpen(true)}>
            <IonIcon icon={personAddOutline} style={{ marginRight: 5 }} /> Añadir miembro
          </IonButton>
          <IonButton className="gm-btn" onClick={() => setRenameOpen(true)}>Renombrar grupo</IonButton>
          <IonButton
            className="gm-btn danger"
            onClick={() => setLeaveOpen(true)}
          >
            Salir del grupo
          </IonButton>
        </div>
      </div>
    </IonModal>

    {/* Selector para añadir miembro */}
    <IonModal
      isOpen={addOpen}
      onDidDismiss={() => setAddOpen(false)}
      className={dark ? 'com-dark-surface' : undefined}
    >
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
                className="com-row"
                style={{ cursor: 'pointer' }}
                onClick={() => void handleAddMember(f.id)}
              >
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
                />
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

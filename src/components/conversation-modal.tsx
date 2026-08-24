import { useEffect, useState } from 'react'
import { IonButton, IonIcon, IonModal, IonSkeletonText, IonTextarea } from '@ionic/react'
import { close, send } from 'ionicons/icons'
import { useQuery, useSubscription } from 'urql'
import {
  CONVERSATION_QUERY,
  MESSAGE_ADDED,
  conversationKey,
  type ConversationResult,
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

export function ConversationModal({
  peer,
  me,
  open,
  onClose,
  onSend,
  onToast,
}: {
  peer: Profile
  me: Profile
  open: boolean
  onClose: () => void
  onSend: (body: string) => Promise<void>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  const key = conversationKey(me.id, peer.id)

  const [query] = useQuery<ConversationResult>({
    query: CONVERSATION_QUERY,
    variables: { peerId: peer.id, take: 50, skip: 0 },
  })
  const [sub] = useSubscription<MessageAddedResult>({
    query: MESSAGE_ADDED,
    variables: { conversationKey: key },
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  // Inicializar desde la query y fusionar sin duplicados.
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

  // Mensajes en vivo por suscripción.
  useEffect(() => {
    const m = sub.data?.messageAdded
    if (!m) return
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort(byCreatedAsc)))
  }, [sub.data])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await onSend(text)
      setDraft('')
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setSending(false)
    }
  }

  const grad = AVATAR_GRADS[peer.id.charCodeAt(0) % AVATAR_GRADS.length]
  const loading = query.fetching && messages.length === 0

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wh)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid var(--g1)' }}>
          <div className="avatar" style={{ width: 38, height: 38, background: grad, fontSize: 13 }}>
            {initialsOf(peer.displayName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{peer.displayName}</div>
            <div style={{ fontSize: 11, color: 'var(--mu)' }}>Amigos en la comunidad</div>
          </div>
          <IonButton fill="clear" size="small" onClick={onClose}><IonIcon icon={close} /></IonButton>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--g1)', padding: 12 }}>
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
            messages.map((m) => {
              const mine = m.senderProfileId === me.id
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                  <div
                    style={{
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
                    }}
                  >
                    {m.body}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--g1)', padding: '10px 12px' }}>
          <IonTextarea
            className="fld draft-tx"
            value={draft}
            placeholder="Escribe un mensaje…"
            onIonInput={(e) => setDraft(e.detail.value ?? '')}
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
  )
}

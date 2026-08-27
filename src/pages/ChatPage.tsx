import { IonButton, IonIcon, IonInput } from '@ionic/react'
import { medkit, mic, send as sendIcon } from 'ionicons/icons'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Screen } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { fetchThreadState } from '../utils/threadApi'

const quick = [
  ['¿Qué comer?', '¿Qué debo comer hoy según mi plan?'],
  ['Síntomas', 'Tengo dolor en el pecho, ¿qué hago?'],
  ['Agendar', 'Agenda una cita con el médico para hoy'],
  ['Progreso', '¿Cómo va mi progreso esta semana?'],
  ['Meditar', 'Quiero meditar y calmar mi ansiedad'],
]

export function ChatPage() {
  const { chat, sendChat, openPanic, openVoice, threadId, user, hydrateChat } = useApp()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  // Al abrir el chat se intenta cargar el historial del thread estable: si el
  // backend inyectó un mensaje del bot (push proactivo), se muestra al inicio.
  const historyLoaded = useRef<string | null>(null)
  useEffect(() => {
    if (historyLoaded.current === threadId) return
    historyLoaded.current = threadId
    const userId = (user.id || user.cedula || user.email || '').trim()
    if (!userId) return
    let cancelled = false
    void fetchThreadState(threadId, userId).then((state) => {
      if (cancelled || !state?.lastMessage) return
      hydrateChat([{ text: state.lastMessage }])
    })
    return () => {
      cancelled = true
    }
  }, [threadId, user.id, user.cedula, user.email, hydrateChat])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length])

  const send = (t = text) => {
    const v = t.trim()
    if (!v) return
    sendChat(v)
    setText('')
  }

  return (
    <Screen>
      <PageHeader
        title="Chat"
        sub="ANTARES AI · en línea 24/7"
        trailing={
          <IonButton
            className="bt bt-round"
            style={{ '--background': 'var(--red-l)', '--color': 'var(--panic)' } as CSSProperties}
            aria-label="Botón de pánico"
            onClick={openPanic}
          >
            <IonIcon icon={medkit} />
          </IonButton>
        }
      />
      <div className="chip-scroll">
        {quick.map(([l, q]) => (
          <button key={l} type="button" className="qrchip" onClick={() => send(q)}>
            {l}
          </button>
        ))}
      </div>
      <div className="screen-scroll" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chat.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role !== 'user' && (
              <div
                className="avatar"
                style={{
                  width: 28,
                  height: 28,
                  fontSize: 11,
                  background: m.role === 'alert' ? 'var(--panic)' : 'linear-gradient(145deg,#1a6ad8,#20c8ff)',
                }}
              >
                {m.role === 'alert' ? '!' : 'AI'}
              </div>
            )}
            <div>
              <div className={`bub ${m.role === 'user' ? 'bub-usr' : m.role === 'alert' ? 'bub-alert' : 'bub-bot'}`} style={{ whiteSpace: 'pre-wrap' }}>
                {m.text}
              </div>
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.time}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="composer">
        <IonButton
          className="bt bt-round"
          style={{ '--background': 'var(--blue-l)', '--color': 'var(--blue)' } as CSSProperties}
          aria-label="Agente de voz"
          onClick={openVoice}
        >
          <IonIcon icon={mic} style={{ fontSize: 20 }} />
        </IonButton>
        <IonInput
          className="chat-inp"
          value={text}
          onIonInput={(e) => setText(e.detail.value ?? '')}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escribe un mensaje…"
        />
        <IonButton
          className="bt bt-round"
          style={{ '--background': 'var(--navy)', '--color': '#fff' } as CSSProperties}
          aria-label="Enviar"
          onClick={() => send()}
        >
          <IonIcon icon={sendIcon} style={{ fontSize: 20 }} />
        </IonButton>
      </div>
    </Screen>
  )
}

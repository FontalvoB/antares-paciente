import { IonButton, IonIcon, IonInput, IonSpinner } from '@ionic/react'
import { medkit, mic, send as sendIcon } from 'ionicons/icons'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MarkdownBubble } from '../components/MarkdownBubble'
import { PageHeader } from '../components/PageHeader'
import { Screen } from '../components/Screen'
import { useApp } from '../context/AppContext'

const quick = [
  ['🥗 ¿Qué comer?', '¿Qué debo comer hoy según mi plan?'],
  ['🚨 Síntomas', 'Tengo dolor en el pecho, ¿qué hago?'],
  ['📅 Agendar', 'Agenda una cita con el médico para hoy'],
  ['📊 Progreso', '¿Cómo va mi progreso esta semana?'],
  ['🧘 Meditar', 'Quiero meditar y calmar mi ansiedad'],
  ['∞ INFINITO', '¿Cuáles son los SUMMIT de INFINITO?'],
]

// Etiqueta legible por perfil de agente (coincide con las claves del ai-service).
const AGENT_LABELS: Record<string, string> = {
  base: 'CoppAI',
  nutrition: 'Nutrición',
  medical: 'Salud',
  psychology: 'Salud Mental',
}

export function ChatPage() {
  const { chat, chatLoading, sendChat, openPanic, openVoice } = useApp()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length, chatLoading])

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
              <div className={`bub ${m.role === 'user' ? 'bub-usr' : m.role === 'alert' ? 'bub-alert' : 'bub-bot'}`}
                style={m.role === 'bot' ? undefined : { whiteSpace: 'pre-wrap' }}
              >
                {m.role === 'bot' ? <MarkdownBubble content={m.text} /> : m.text}
              </div>
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                {m.role === 'bot' && m.agent ? (
                  <span style={{ fontWeight: 700, color: 'var(--pur)' }}>{AGENT_LABELS[m.agent] ?? m.agent}</span>
                ) : null}
                {m.role === 'bot' && m.agent ? ' · ' : null}
                {m.time}
              </div>
            </div>
          </div>
        ))}
        {chatLoading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: 'linear-gradient(135deg,var(--pur),#5B21B6)' }}>
              AI
            </div>
            <div className="bub bub-bot" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IonSpinner name="dots" style={{ width: 16, height: 16 }} />
              Escribiendo…
            </div>
          </div>
        )}
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
          disabled={chatLoading}
        >
          <IonIcon icon={sendIcon} style={{ fontSize: 20 }} />
        </IonButton>
      </div>
    </Screen>
  )
}

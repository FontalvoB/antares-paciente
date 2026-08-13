import { IonIcon } from '@ionic/react'
import { mic, send as sendIcon } from 'ionicons/icons'
import { useEffect, useRef, useState } from 'react'
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

export function ChatPage() {
  const { chat, sendChat, openPanic, openVoice } = useApp()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

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
      <div className="hero hero-navy" style={{ paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="avatar" style={{ width: 42, height: 42, background: 'linear-gradient(135deg,var(--pur),#5B21B6)' }}>
            🤖
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>ANTARES AI · Agente de salud</div>
            <div className="sub">COPP-ADRESD + INFINITO · 24/7</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ADE80', fontSize: 11, marginTop: 2 }}>
              <span className="dot" /> En línea
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 12px', background: '#fff' }}>
        {quick.map(([l, q]) => (
          <button key={l} className="qrchip" onClick={() => send(q)}>
            {l}
          </button>
        ))}
      </div>
      <div className="screen-scroll" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {chat.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div
              className="avatar"
              style={{
                width: 28,
                height: 28,
                fontSize: 12,
                background: m.role === 'alert' ? 'var(--panic)' : m.role === 'user' ? 'var(--navy)' : 'linear-gradient(135deg,var(--pur),#5B21B6)',
              }}
            >
              {m.role === 'user' ? 'MG' : m.role === 'alert' ? '🚨' : 'AI'}
            </div>
            <div>
              <div className={`bub ${m.role === 'user' ? 'bub-usr' : m.role === 'alert' ? 'bub-alert' : 'bub-bot'}`} style={{ whiteSpace: 'pre-wrap' }}>
                {m.text}
              </div>
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.time}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div style={{ padding: '6px 12px 0', background: '#fff' }}>
        <button className="btn btn-panic" style={{ minHeight: 42, fontSize: 13 }} onClick={openPanic}>
          🆘 Activar botón de pánico
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px calc(8px)',
          background: '#fff',
          borderTop: '1px solid var(--bd)',
          marginBottom: 'var(--nav-h)',
        }}
      >
        <button
          onClick={openVoice}
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--pur),#5B21B6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IonIcon icon={mic} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Habla con ANTARES AI…"
          style={{ flex: 1, border: '1.5px solid var(--bd)', borderRadius: 22, padding: '10px 14px', fontSize: 14, outline: 'none' }}
        />
        <button
          onClick={() => send()}
          style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IonIcon icon={sendIcon} />
        </button>
      </div>
    </Screen>
  )
}

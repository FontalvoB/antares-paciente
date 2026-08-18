import { type CSSProperties } from 'react'
import { IonIcon, IonProgressBar } from '@ionic/react'
import {
  bluetooth,
  calendar,
  chatbubbleEllipses,
  clipboard,
  infinite,
  leaf,
  medkit,
  people,
  person,
  school,
  sparklesOutline,
  mic,
} from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import type { Screen as ScreenId } from '../types'

const moreModules: { id: ScreenId; title: string; sub: string; icon: string }[] = [
  { id: 'hc', title: 'Historia clínica', sub: 'Diagnósticos, lab y medicamentos', icon: clipboard },
  { id: 'edu', title: 'Academia BIO', sub: 'Módulo 5 · 68% completado', icon: school },
  { id: 'infinito', title: 'INFINITO', sub: 'Consciencia y bienestar', icon: infinite },
  { id: 'com', title: 'Comunidad', sub: '10,847 miembros activos', icon: people },
  { id: 'prof', title: 'Mi perfil', sub: 'Seguros, equipo y ajustes', icon: person },
]

export function HomePage() {
  const { user, navigate, openPanic, openVoice, pointsTotal, watchConnected } = useApp()
  const first = user.nombre.split(' ')[0]
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Screen>
      <Scroll>
        <header className="home-head">
          <div className="home-head-top">
            <div>
              <div className="home-head-date">{today}</div>
              <h1 className="home-head-name">Hola, {first}</h1>
            </div>
            <button type="button" className="home-avatar" onClick={() => navigate('prof')} aria-label="Abrir perfil">
              MG
            </button>
          </div>
          <div className="home-head-chips">
            <span className="chip chip-glass">
              <span className="dot" /> Riesgo bajo
            </span>
            <span className="chip chip-glass">Semana 12 de 24</span>
          </div>
        </header>

        <div className="metric-scroll" aria-label="Indicadores de salud">
          {[
            ['IMC', '26.4', '−1.2 este mes', 'var(--teal)'],
            ['HbA1c', '5.9%', 'Mejorando', 'var(--blue)'],
            ['Adherencia', '88%', 'Esta semana', 'var(--cyan)'],
            ['Puntos', String(pointsTotal), 'Hoy', 'var(--org)'],
          ].map(([l, v, s, c]) => (
            <article key={l} className="metric-card">
              <div className="metric-card-lbl">{l}</div>
              <div className="metric-card-val" style={{ color: String(c) }}>{v}</div>
              <div className="metric-card-sub">{s}</div>
            </article>
          ))}
        </div>

        <button type="button" className="today-card" onClick={() => navigate('prog')}>
          <div className="today-card-top">
            <span className="today-card-ico">
              <IonIcon icon={sparklesOutline} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="today-card-kicker">Programa de hoy</div>
              <div className="today-card-title">2 de 5 pasos listos</div>
            </div>
            <span className="cta-banner-chevron">›</span>
          </div>
          <div className="today-dots" aria-hidden="true">
            <span className="on" />
            <span className="on" />
            <span />
            <span />
            <span />
          </div>
          <div className="today-card-sub">Vitales · Nutrición · Ejercicio · hasta 700 pts</div>
        </button>

        <button type="button" className="next-appt" onClick={() => navigate('book')}>
          <div className="next-appt-time">
            <strong>15:00</strong>
            <span>Hoy</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="next-appt-name">Dr. Carlos Ramírez</div>
            <div className="next-appt-meta">Telemedicina · Control semana 12</div>
          </div>
          <span className="chip chip-teal">Unirse</span>
        </button>

        <div className="quick-row">
          {[
            { id: 'chat' as const, label: 'Chat IA', icon: chatbubbleEllipses, fn: () => navigate('chat') },
            { id: 'voice' as const, label: 'Voz', icon: mic, fn: openVoice },
            { id: 'bt' as const, label: watchConnected ? 'Reloj' : 'Conectar', icon: bluetooth, fn: () => navigate('bt') },
            { id: 'sos' as const, label: 'SOS', icon: medkit, fn: openPanic, panic: true },
          ].map((a) => (
            <button key={a.id} type="button" className={`quick-btn ${a.panic ? 'panic' : ''}`} onClick={a.fn}>
              <span className="quick-btn-ico">
                <IonIcon icon={a.icon} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <div className="sec">Accesos</div>
        <div className="grid-2" style={{ marginBottom: 8 }}>
          {[
            { id: 'book' as ScreenId, title: 'Citas', sub: 'Hoy 3:00 PM', icon: calendar, bg: 'var(--teal-l)', color: 'var(--teal)' },
            { id: 'nut' as ScreenId, title: 'Nutrición', sub: '1,650 / 1,800 kcal', icon: leaf, bg: 'var(--ice-l)', color: 'var(--teal-d)' },
          ].map((m) => (
            <button key={m.id} type="button" className="card widget-card" onClick={() => navigate(m.id)}>
              <div className="ico" style={{ background: m.bg, color: m.color }}>
                <IonIcon icon={m.icon} />
              </div>
              <div className="ct">{m.title}</div>
              <div className="cs">{m.sub}</div>
            </button>
          ))}
        </div>

        <div className="group-list">
          {moreModules.map((m) => (
            <button
              key={m.title}
              type="button"
              className="group-row"
              onClick={() => navigate(m.id)}
            >
              <span className="group-row-ico">
                <IonIcon icon={m.icon} />
              </span>
              <span className="group-row-body">
                <strong>{m.title}</strong>
                <small>{m.sub}</small>
              </span>
              <span className="group-row-chevron">›</span>
            </button>
          ))}
        </div>

        <div className="sec">Progreso semanal</div>
        <div className="card" style={{ margin: '0 16px 20px' }}>
          {[
            ['Hidratación', '7/8 vasos', 87, 'var(--teal)'],
            ['Pasos', '6,240 / 8,000', 78, 'var(--blue)'],
            ['Calorías', '1,650 / 1,800', 91, 'var(--org)'],
            ['Academia', 'Módulo 5', 68, 'var(--cyan)'],
          ].map(([l, r, w, c]) => (
            <div key={String(l)} className="progress-row">
              <div className="progress-row-top">
                <span>{l}</span>
                <span>{r}</span>
              </div>
              <IonProgressBar
                className="pb"
                style={{ '--progress-background': String(c) } as CSSProperties}
                value={Number(w) / 100}
              />
            </div>
          ))}
        </div>
      </Scroll>
    </Screen>
  )
}

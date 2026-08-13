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
} from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import type { Screen as ScreenId } from '../types'

const modules: { id: ScreenId | 'panic'; title: string; sub: string; icon: string; tone: string; bg: string; color: string }[] = [
  { id: 'book', title: 'Mis citas', sub: 'Próximas citas del equipo médico', icon: calendar, tone: 'ac-teal', bg: 'var(--teal-l)', color: 'var(--teal)' },
  { id: 'hc', title: 'Historia clínica', sub: 'Diagnósticos, lab, medicamentos', icon: clipboard, tone: 'ac-blue', bg: 'var(--blue-l)', color: 'var(--blue)' },
  { id: 'nut', title: 'Plan nutricional', sub: 'USDA · ADA 2026 · Mediterránea', icon: leaf, tone: 'ac-teal', bg: 'var(--teal-l)', color: 'var(--teal)' },
  { id: 'edu', title: 'Academia BIO', sub: 'Formación ABOM · CDR · NBHWC', icon: school, tone: 'ac-gold', bg: 'var(--gold-l)', color: 'var(--gold-d)' },
  { id: 'infinito', title: 'INFINITO B2C', sub: 'Consciencia · Bienestar', icon: infinite, tone: 'ac-pur', bg: 'var(--pur-l)', color: 'var(--pur)' },
  { id: 'panic', title: 'Pánico / SOS', sub: 'Ambulancia + familia + médico', icon: medkit, tone: 'ac-panic', bg: 'var(--red-l)', color: 'var(--panic)' },
  { id: 'bt', title: 'Reloj inteligente', sub: 'Sueño · FC · TA · ECG · SpO2', icon: bluetooth, tone: 'ac-ind', bg: '#EEF2FF', color: '#6366F1' },
  { id: 'chat', title: 'Chat IA', sub: 'Asistente de salud 24/7', icon: chatbubbleEllipses, tone: 'ac-org', bg: 'var(--org-l)', color: 'var(--org)' },
  { id: 'prof', title: 'Mi perfil', sub: 'Configuración · Seguros · Equipo', icon: person, tone: 'ac-blue', bg: 'var(--blue-l)', color: 'var(--blue)' },
  { id: 'com', title: 'Comunidad', sub: 'Feed · Amigos · Redes', icon: people, tone: 'ac-pur', bg: 'var(--pur-l)', color: 'var(--pur)' },
]

export function HomePage() {
  const { user, navigate, openPanic, openVoice, pointsTotal } = useApp()
  const first = user.nombre.split(' ')[0]

  return (
    <Screen darkNav>
      <Scroll>
        <div className="hero hero-cosmos">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'relative', zIndex: 1 }}>
            <div className="logo-mark">⭐</div>
            <div>
              <div className="display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>
                ANTARES BIOHACKING
              </div>
              <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>
                COPP-ADRESD · B2B Institucional
              </div>
            </div>
          </div>
          <div className="sub" style={{ position: 'relative' }}>
            Buenos días,
          </div>
          <div className="h1" style={{ position: 'relative' }}>
            {first} 👋
          </div>
          <div className="chips" style={{ position: 'relative' }}>
            <span className="chip chip-glass">
              <span className="dot" /> Riesgo bajo
            </span>
            <span className="chip chip-glass">Semana 12/24</span>
            <span className="chip chip-gold">⭐ Nivel BIO activo</span>
          </div>
        </div>

        <div className="kpi-strip">
          {[
            ['IMC', '26.4', '↓ 1.2'],
            ['HbA1c', '5.9%', '↓ mejora'],
            ['Adherencia', '88%', '↑ esta sem'],
            ['Puntos', String(pointsTotal), '↑ hoy'],
          ].map(([l, v, s]) => (
            <div key={l} className="kpi">
              <div className="kpi-lbl">{l}</div>
              <div className="kpi-val">{v}</div>
              <div className="kpi-sub">{s}</div>
            </div>
          ))}
        </div>

        <button
          onClick={openPanic}
          style={{
            margin: '10px 14px 0',
            width: 'calc(100% - 28px)',
            background: 'linear-gradient(135deg, var(--panic), #8B0000)',
            border: 'none',
            borderRadius: 16,
            padding: 14,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
            boxShadow: '0 8px 24px rgba(255,45,85,.28)',
          }}
        >
          <IonIcon icon={medkit} style={{ fontSize: 28 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>BOTÓN DE PÁNICO</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Presiona si te sientes mal · Ambulancia + familia</div>
          </div>
          <span style={{ opacity: 0.6 }}>›</span>
        </button>

        <button
          onClick={openVoice}
          style={{
            margin: '10px 14px 0',
            width: 'calc(100% - 28px)',
            background: 'linear-gradient(135deg,#1A0A3C,#0D1B4B)',
            border: 'none',
            borderRadius: 16,
            padding: 14,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
          }}
        >
          <div className="waves">
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Agente de voz ANTARES</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Habla sobre síntomas, citas o consejos</div>
          </div>
          <span>🎙️</span>
        </button>

        <div className="sec">Módulos COPP-ADRESD</div>
        <div className="grid-2">
          {modules.map((m) => (
            <button
              key={m.title}
              className={`card card-accent ${m.tone}`}
              onClick={() => (m.id === 'panic' ? openPanic() : navigate(m.id))}
              style={{ textAlign: 'left' }}
            >
              <div className="ico" style={{ background: m.bg, color: m.color }}>
                <IonIcon icon={m.icon} />
              </div>
              <div className="ct">{m.title}</div>
              <div className="cs">{m.sub}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('prog')}
          style={{
            margin: '12px 14px 4px',
            width: 'calc(100% - 28px)',
            background: 'linear-gradient(135deg,#06091A,#1A0A3C)',
            border: '1px solid rgba(212,175,55,.28)',
            borderRadius: 16,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,175,55,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            🌟
          </div>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 14 }}>
              Iniciar programa del día
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Vitales · Nutrición · Ejercicio · hasta 700 pts</div>
          </div>
          <span style={{ color: 'rgba(212,175,55,.6)' }}>›</span>
        </button>

        <div className="sec">Próximas citas</div>
        <div className="card" style={{ margin: '0 14px', padding: 0 }}>
          {[
            ['🩺', 'Dr. Carlos Ramírez, MD', 'Hoy · 3:00 PM · Telemedicina', 'Hoy', 'chip-teal'],
            ['🥗', 'Nut. Ana Torres, RDN', 'Jue 8 ago · 10:00 AM · MNT #4', 'Próx.', 'chip-blue'],
            ['🧠', 'Coach Marco Reyes, NBHWC', 'Vie 9 ago · 11:00 AM · SMART', 'Próx.', 'chip-blue'],
            ['∞', 'SUMMIT INFINITO Virtual', 'Sáb 10 ago · 9:00 AM', 'Evento', 'chip-org'],
          ].map(([e, n, t, b, c]) => (
            <div key={n} style={{ display: 'flex', gap: 10, padding: '11px 12px', borderTop: '1px solid var(--g1)', alignItems: 'center' }}>
              <div className="ico" style={{ marginBottom: 0, background: 'var(--blue-l)', fontSize: 16 }}>
                {e}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{t}</div>
              </div>
              <span className={`chip ${c}`}>{b}</span>
            </div>
          ))}
        </div>

        <div className="sec">Progreso semanal</div>
        <div className="card" style={{ margin: '0 14px 16px' }}>
          {[
            ['Hidratación', '7/8 vasos · 87%', 87, 'var(--teal)'],
            ['Pasos diarios', '6,240/8,000 · 78%', 78, 'var(--blue)'],
            ['Calorías', '1,650/1,800 · 91%', 91, 'var(--org)'],
            ['Academia', 'Módulo 5 · 68%', 68, 'var(--gold)'],
          ].map(([l, r, w, c]) => (
            <div key={String(l)} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mu)', marginBottom: 4 }}>
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

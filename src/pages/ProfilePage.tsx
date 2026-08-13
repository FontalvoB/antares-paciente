import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import type { Screen as ScreenId } from '../types'

export function ProfilePage() {
  const { user, navigate, openPanic, showToast, pointsTotal, logout } = useApp()

  const go = (s: ScreenId) => navigate(s)

  return (
    <Screen>
      <Scroll>
        <div className="hero hero-cosmos">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div className="avatar" style={{ width: 58, height: 58, fontSize: 20, background: 'linear-gradient(135deg,var(--teal),#0F6E56)', border: '2px solid rgba(255,255,255,.3)' }}>
              MG
            </div>
            <div>
              <div className="h2">{user.nombre}</div>
              <div className="sub">ID: COPP-2024-00142 · Semana 12/24</div>
              <span className="chip chip-gold" style={{ marginTop: 6 }}>
                ⭐ Miembro BIO activo
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              ['12', 'Semanas'],
              ['-3.2kg', 'Peso'],
              [String(pointsTotal), 'Puntos'],
            ].map(([v, l]) => (
              <div key={l} style={{ textAlign: 'center', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: 10, border: '1px solid rgba(255,255,255,.1)' }}>
                <div className="display" style={{ fontSize: 18, fontWeight: 800 }}>
                  {v}
                </div>
                <div style={{ fontSize: 10, opacity: 0.55 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', letterSpacing: 0.6, marginBottom: 8 }}>MI PLAN</div>
          {[
            ['📋', 'Historia clínica HIPAA', 'Diagnósticos · Lab · Medicamentos', () => go('hc')],
            ['📅', 'Calendario de citas', 'Próxima: Dr. Ramírez hoy 3:00 PM', () => go('book')],
            ['🥗', 'Plan nutricional MNT', '1,800 kcal · Mediterránea', () => go('nut')],
            ['💊', 'Mis medicamentos', 'Metformina · Omega-3 · Vit. D3', () => go('hc')],
          ].map(([e, t, s, fn]) => (
            <button key={String(t)} className="prow" onClick={fn as () => void}>
              <span>{e as string}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t as string}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{s as string}</div>
              </div>
              <span style={{ color: 'var(--mu)' }}>›</span>
            </button>
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', letterSpacing: 0.6, margin: '12px 0 8px' }}>EQUIPO ANTARES</div>
          {[
            ['🩺', 'Dr. Carlos Ramírez, MD', 'Médico COPP-ADRESD'],
            ['🥗', 'Nut. Ana Torres, RDN', 'Nutricionista · CDR'],
            ['🧠', 'Psi. Luis Mora, PhD', 'Psicólogo · CBT'],
            ['🤝', 'Coach Marco Reyes, NBHWC', 'Coach de salud'],
          ].map(([e, t, s]) => (
            <button key={t} className="prow" onClick={() => showToast(`Contactando a ${t}…`, 'info')}>
              <span>{e}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{s}</div>
              </div>
              <span style={{ color: 'var(--mu)' }}>›</span>
            </button>
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', letterSpacing: 0.6, margin: '12px 0 8px' }}>ECOSISTEMA</div>
          <button className="prow" onClick={() => go('edu')}>
            <span>🎓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Academia BIO</div>
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>18 hrs completadas</div>
            </div>
            <span>›</span>
          </button>
          <button className="prow" onClick={() => go('infinito')}>
            <span>∞</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>INFINITO B2C</div>
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>Consciencia · Bienestar</div>
            </div>
            <span>›</span>
          </button>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', letterSpacing: 0.6, margin: '12px 0 8px' }}>EMERGENCIAS</div>
          <button className="prow" style={{ borderColor: '#F7C1C1', background: 'var(--red-l)' }} onClick={openPanic}>
            <span>🚑</span>
            <div style={{ flex: 1, color: 'var(--red)' }}>
              <div style={{ fontWeight: 800 }}>Botón de pánico SOS</div>
              <div style={{ fontSize: 11 }}>Ambulancia + familia + médico</div>
            </div>
          </button>
          <button
            className="prow"
            style={{ marginBottom: 20 }}
            onClick={() => {
              logout()
              showToast('Sesión cerrada', 'ok')
            }}
          >
            <span>🚪</span>
            <div style={{ flex: 1, color: 'var(--red)', fontWeight: 700 }}>Cerrar sesión</div>
          </button>
        </div>
      </Scroll>
    </Screen>
  )
}

import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

export function AcademyPage() {
  const { showToast } = useApp()
  return (
    <Screen>
      <Scroll>
        <div className="hero hero-cosmos">
          <div className="kicker">ANTARES BIOHACKING</div>
          <div className="h1">🎓 Academia BIO</div>
          <div className="sub">Formación y certificación profesional · COPP-ADRESD</div>
          <div className="chips">
            <span className="chip chip-gold">18 hrs completadas</span>
            <span className="chip chip-glass">3 certificados</span>
          </div>
        </div>
        <div className="sec">BIO — El cuerpo</div>
        <div className="card" style={{ margin: '0 14px 10px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ico" style={{ background: 'var(--teal-l)' }}>🥗</div>
            <div>
              <div className="ct">Nutrición y prevención de la obesidad</div>
              <div className="cs">USDA MyPlate · ADA · ABOM</div>
              <span className="chip chip-teal" style={{ marginTop: 6 }}>Certificado obtenido</span>
            </div>
          </div>
          <div className="ptrack" style={{ margin: '12px 0' }}>
            <div className="pfill" style={{ width: '100%', background: 'var(--teal)' }} />
          </div>
          <button className="btn btn-ghost" onClick={() => showToast('Certificado ABOM descargado', 'ok')}>
            📄 Ver certificado
          </button>
        </div>
        <div className="card" style={{ margin: '0 14px 10px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ico" style={{ background: 'var(--blue-l)' }}>🏃</div>
            <div>
              <div className="ct">Actividad física y control del peso</div>
              <div className="cs">CDC · ACSM 2024 · Módulo 5 activo</div>
            </div>
          </div>
          <div className="ptrack" style={{ margin: '12px 0' }}>
            <div className="pfill" style={{ width: '68%', background: 'var(--blue)' }} />
          </div>
          <button className="btn btn-primary" onClick={() => showToast('Iniciando módulo 5: rutinas en casa', 'info')}>
            Continuar módulo 5
          </button>
        </div>
        <div className="sec">PSICO — La mente</div>
        <div className="card" style={{ margin: '0 14px 10px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ico" style={{ background: '#FBEAF0' }}>🧠</div>
            <div>
              <div className="ct">Salud mental y cambio de hábitos</div>
              <div className="cs">APA CBT · MBSR · 33%</div>
            </div>
          </div>
          <div className="ptrack" style={{ margin: '12px 0' }}>
            <div className="pfill" style={{ width: '33%', background: '#D4537E' }} />
          </div>
          <button className="btn" style={{ background: '#D4537E', color: '#fff' }} onClick={() => showToast('Módulo 3: hábitos', 'info')}>
            Continuar módulo 3
          </button>
        </div>
        <div className="sec">Marketplace</div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          {[
            ['💊', 'Nutraceútica', 'Suplementos · Salud'],
            ['🚐', 'Unidades móviles', 'Check-up en tu ciudad'],
            ['🎤', 'SUMMIT virtuales', 'Eventos · Comunidad'],
            ['🛒', 'Tiendas de salud', 'Wellness · Conveniencia'],
          ].map(([e, t, s]) => (
            <button key={t} className="card" style={{ textAlign: 'left' }} onClick={() => showToast(`Abriendo ${t}…`, 'info')}>
              <div style={{ fontSize: 22 }}>{e}</div>
              <div className="ct">{t}</div>
              <div className="cs">{s}</div>
            </button>
          ))}
        </div>
      </Scroll>
    </Screen>
  )
}

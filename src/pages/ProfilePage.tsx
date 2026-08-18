import { IonIcon } from '@ionic/react'
import {
  calendarOutline,
  clipboardOutline,
  infinite,
  leafOutline,
  logOutOutline,
  medkit,
  schoolOutline,
} from 'ionicons/icons'
import { PageHeader } from '../components/PageHeader'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import type { Screen as ScreenId } from '../types'

export function ProfilePage() {
  const { user, navigate, openPanic, showToast, pointsTotal, logout } = useApp()

  const go = (s: ScreenId) => navigate(s)

  return (
    <Screen>
      <PageHeader title="Perfil" sub="ID COPP-2024-00142 · Semana 12/24" />
      <Scroll>
        <div className="profile-hero-card">
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 22, background: 'linear-gradient(145deg,#1a6ad8,#20c8ff)' }}>
            MG
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h2" style={{ margin: 0 }}>{user.nombre}</div>
            <div className="cs">Miembro BIO activo</div>
          </div>
        </div>

        <div className="hero-metrics" style={{ padding: '0 16px', marginBottom: 8 }}>
          {[
            ['12', 'Semanas'],
            ['−3.2 kg', 'Peso'],
            [String(pointsTotal), 'Puntos'],
          ].map(([v, l]) => (
            <div key={l} className="metric-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div className="metric-card-val" style={{ fontSize: 20, margin: '0 0 2px', color: 'var(--tx)' }}>{v}</div>
              <div className="metric-card-lbl">{l}</div>
            </div>
          ))}
        </div>

        <div className="sec">Mi plan</div>
        <div className="group-list">
          {[
            { ico: clipboardOutline, t: 'Historia clínica', s: 'Diagnósticos · Lab · Medicamentos', fn: () => go('hc') },
            { ico: calendarOutline, t: 'Calendario de citas', s: 'Próxima: Dr. Ramírez hoy 15:00', fn: () => go('book') },
            { ico: leafOutline, t: 'Plan nutricional', s: '1,800 kcal · Mediterránea', fn: () => go('nut') },
          ].map((r) => (
            <button key={r.t} type="button" className="group-row" onClick={r.fn}>
              <span className="group-row-ico">
                <IonIcon icon={r.ico} />
              </span>
              <span className="group-row-body">
                <strong>{r.t}</strong>
                <small>{r.s}</small>
              </span>
              <span className="group-row-chevron">›</span>
            </button>
          ))}
        </div>

        <div className="sec">Equipo ANTARES</div>
        <div className="group-list">
          {[
            ['🩺', 'Dr. Carlos Ramírez, MD', 'Médico COPP-ADRESD'],
            ['🥗', 'Nut. Ana Torres, RDN', 'Nutricionista · CDR'],
            ['🧠', 'Psi. Luis Mora, PhD', 'Psicólogo · CBT'],
            ['🤝', 'Coach Marco Reyes, NBHWC', 'Coach de salud'],
          ].map(([e, t, s]) => (
            <button key={t} type="button" className="group-row" onClick={() => showToast(`Contactando a ${t}…`, 'info')}>
              <span className="group-row-ico">{e}</span>
              <span className="group-row-body">
                <strong>{t}</strong>
                <small>{s}</small>
              </span>
              <span className="group-row-chevron">›</span>
            </button>
          ))}
        </div>

        <div className="sec">Ecosistema</div>
        <div className="group-list">
          <button type="button" className="group-row" onClick={() => go('edu')}>
            <span className="group-row-ico">
              <IonIcon icon={schoolOutline} />
            </span>
            <span className="group-row-body">
              <strong>Academia BIO</strong>
              <small>18 hrs completadas</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
          <button type="button" className="group-row" onClick={() => go('infinito')}>
            <span className="group-row-ico">
              <IonIcon icon={infinite} />
            </span>
            <span className="group-row-body">
              <strong>INFINITO B2C</strong>
              <small>Consciencia · Bienestar</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
        </div>

        <div className="sec">Cuenta</div>
        <div className="group-list" style={{ marginBottom: 20 }}>
          <button type="button" className="group-row" onClick={openPanic}>
            <span className="group-row-ico" style={{ background: 'var(--red-l)', color: 'var(--panic)' }}>
              <IonIcon icon={medkit} />
            </span>
            <span className="group-row-body">
              <strong style={{ color: 'var(--panic)' }}>Botón de pánico SOS</strong>
              <small>Ambulancia + familia + médico</small>
            </span>
          </button>
          <button
            type="button"
            className="group-row"
            onClick={() => {
              logout()
              showToast('Sesión cerrada', 'ok')
            }}
          >
            <span className="group-row-ico" style={{ background: 'var(--red-l)', color: 'var(--red)' }}>
              <IonIcon icon={logOutOutline} />
            </span>
            <span className="group-row-body">
              <strong style={{ color: 'var(--red)' }}>Cerrar sesión</strong>
            </span>
          </button>
        </div>
      </Scroll>
    </Screen>
  )
}

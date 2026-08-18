import { useState, type CSSProperties } from 'react'
import { IonAlert, IonButton } from '@ionic/react'
import { PageHeader } from '../components/PageHeader'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

const upcoming = [
  {
    when: 'HOY · CONFIRMADA',
    mode: 'Telemedicina',
    accent: 'linear-gradient(90deg,#0C3D2C,var(--teal))',
    emoji: '🩺',
    name: 'Dr. Carlos Ramírez, MD',
    role: 'Médico COPP-ADRESD',
    time: '15:00',
    day: 'Hoy',
    motivo: 'Control preventivo · Semana 12',
    color: 'var(--teal)',
    featured: true,
  },
  {
    when: 'JUE 08/08 · CONFIRMADA',
    mode: 'Presencial',
    accent: 'linear-gradient(90deg,#102a50,#2f78df)',
    emoji: '🥗',
    name: 'Nut. Ana Torres, RDN',
    role: 'Nutricionista · CDR',
    time: '10:00',
    day: '08/08',
    motivo: 'Seguimiento plan nutricional MNT #4',
    color: 'var(--blue)',
  },
  {
    when: 'VIE 09/08 · CONFIRMADA',
    mode: 'Telemedicina',
    accent: 'linear-gradient(90deg,#2D1B69,#4C1D95)',
    emoji: '💪',
    name: 'Coach Marco Reyes, NBHWC',
    role: 'Health Coach',
    time: '11:00',
    day: '09/08',
    motivo: 'Revisión de metas SMART · Semana 12',
    color: 'var(--pur)',
  },
]

export function AppointmentsPage() {
  const { showToast } = useApp()
  const [cancelId, setCancelId] = useState<string | null>(null)
  const next = upcoming[0]
  const rest = upcoming.slice(1)

  return (
    <Screen>
      <PageHeader
        title="Citas"
        sub="Agenda con el equipo COPP-ADRESD"
        trailing={
          <IonButton className="bt bt-mini bt-primary" onClick={() => showToast('Abriendo portal.antares.health', 'info')}>
            Nueva
          </IonButton>
        }
      />
      <Scroll>
        <article className="appt-featured">
          <div className="appt-featured-band" style={{ background: next.accent }}>
            <span>{next.when}</span>
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '3px 8px' }}>{next.mode}</span>
          </div>
          <div className="appt-featured-body">
            <div className="appt-featured-when">{next.time}</div>
            <div className="appt-featured-mode">{next.day} · {next.motivo}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              <div className="avatar" style={{ width: 44, height: 44, background: 'var(--teal-l)', fontSize: 20 }}>
                {next.emoji}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{next.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mu)' }}>{next.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <IonButton expand="block" className="bt bt-sm bt-teal" style={{ flex: 1 }} onClick={() => showToast('Entrando a la sala de espera…', 'ok')}>
                Unirse a telemedicina
              </IonButton>
              <IonButton
                className="bt bt-round"
                style={{ '--background': 'var(--red-l)', '--color': 'var(--red)' } as CSSProperties}
                aria-label="Cancelar cita"
                onClick={() => setCancelId(next.name)}
              >
                ✕
              </IonButton>
            </div>
          </div>
        </article>

        <div className="sec">Siguientes</div>
        <div className="group-list">
          {rest.map((a) => (
            <div key={a.name} className="group-row" style={{ alignItems: 'flex-start' }}>
              <div className="next-appt-time">
                <strong>{a.time}</strong>
                <span>{a.day}</span>
              </div>
              <div className="group-row-body">
                <strong>{a.name}</strong>
                <small>{a.mode} · {a.motivo}</small>
              </div>
              <IonButton
                className="bt bt-mini bt-ghost"
                onClick={() => setCancelId(a.name)}
              >
                ✕
              </IonButton>
            </div>
          ))}
        </div>

        <div className="sec">Anteriores</div>
        <div className="group-list" style={{ marginBottom: 20 }}>
          {[
            ['🩺', 'Dr. Ramírez · Control sem. 8', '08/07/2026 · Telemedicina'],
            ['🥗', 'Nut. Ana Torres · MNT #3', '01/07/2026 · Presencial'],
            ['🧠', 'Psic. Luis Mora · CBT #2', '25/06/2026 · Telemedicina'],
          ].map(([e, n, t]) => (
            <div key={n} className="group-row">
              <span className="group-row-ico">{e}</span>
              <span className="group-row-body">
                <strong>{n}</strong>
                <small>{t}</small>
              </span>
              <span className="chip chip-teal">Hecha</span>
            </div>
          ))}
        </div>
      </Scroll>

      <IonAlert
        isOpen={!!cancelId}
        header="¿Cancelar la cita?"
        message="Se notificará al equipo médico."
        buttons={[
          { text: 'Volver', role: 'cancel' },
          {
            text: 'Cancelar cita',
            role: 'destructive',
            handler: () => {
              setCancelId(null)
              showToast('Solicitud de cancelación enviada', 'warn')
            },
          },
        ]}
        onDidDismiss={() => setCancelId(null)}
      />
    </Screen>
  )
}

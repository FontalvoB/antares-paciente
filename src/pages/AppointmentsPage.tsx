import { useState, type CSSProperties } from 'react'
import { IonAlert, IonButton, IonModal } from '@ionic/react'
import { PageHeader } from '../components/PageHeader'
import { RequestAppointmentWizard } from '../components/RequestAppointmentWizard'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { INITIAL_UPCOMING } from '../data/appointments'

export function AppointmentsPage() {
  const { showToast } = useApp()
  const [upcoming, setUpcoming] = useState(INITIAL_UPCOMING)
  const [requestOpen, setRequestOpen] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const featured = upcoming.find((a) => a.featured)
  const rest = upcoming.filter((a) => a.id !== featured?.id)

  return (
    <Screen>
      <PageHeader
        title="Citas"
        sub="Agenda con el equipo COPP-ADRESD"
        trailing={
          <IonButton className="bt bt-mini bt-primary" onClick={() => setRequestOpen(true)}>
            Nueva
          </IonButton>
        }
      />
      <Scroll>
        {featured && (
          <article className="appt-featured">
            <div className="appt-featured-band" style={{ background: featured.accent }}>
              <span>{featured.when}</span>
              <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '3px 8px' }}>{featured.mode}</span>
            </div>
            <div className="appt-featured-body">
              <div className="appt-featured-when">{featured.time}</div>
              <div className="appt-featured-mode">{featured.day} · {featured.motivo}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                <div className="avatar" style={{ width: 44, height: 44, background: 'var(--teal-l)', fontSize: 20 }}>
                  {featured.emoji}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{featured.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--mu)' }}>{featured.role}</div>
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
                  onClick={() => setCancelId(featured.id)}
                >
                  ✕
                </IonButton>
              </div>
            </div>
          </article>
        )}

        <div className="sec">Siguientes</div>
        {rest.length === 0 ? (
          <div className="req-empty" style={{ margin: '0 16px 8px' }}>
            <strong>No hay más citas</strong>
            <p>Cuando solicites una nueva, aparecerá aquí mientras se confirma.</p>
          </div>
        ) : (
          <div className="group-list">
            {rest.map((a) => (
              <div key={a.id} className="group-row" style={{ alignItems: 'flex-start' }}>
                <div className="next-appt-time">
                  <strong>{a.time}</strong>
                  <span>{a.day}</span>
                </div>
                <div className="group-row-body">
                  <strong>{a.name}</strong>
                  <small>{a.mode} · {a.motivo}</small>
                </div>
                {a.pending ? <span className="chip chip-org">Pendiente</span> : null}
                <IonButton
                  className="bt bt-mini bt-ghost"
                  aria-label="Cancelar cita"
                  onClick={() => setCancelId(a.id)}
                >
                  ✕
                </IonButton>
              </div>
            ))}
          </div>
        )}

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

      <IonModal
        isOpen={requestOpen}
        onDidDismiss={() => setRequestOpen(false)}
        className="request-modal"
      >
        {requestOpen ? (
          <RequestAppointmentWizard
            onCancel={() => setRequestOpen(false)}
            onSubmitted={(appt) => {
              setUpcoming((list) => {
                const featured = list.filter((a) => a.featured)
                const others = list.filter((a) => !a.featured)
                return [...featured, appt, ...others]
              })
              setRequestOpen(false)
              showToast('Solicitud enviada. Pendiente de confirmación', 'ok')
            }}
          />
        ) : null}
      </IonModal>

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
              setUpcoming((list) => list.filter((a) => a.id !== cancelId))
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

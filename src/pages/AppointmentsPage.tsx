import { useState, type CSSProperties } from 'react'
import { IonAlert, IonButton } from '@ionic/react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

const upcoming = [
  {
    when: 'HOY · CONFIRMADA',
    mode: 'Telemedicina',
    accent: 'linear-gradient(90deg,#0C3D2C,var(--teal))',
    emoji: '🩺',
    name: 'Dr. Carlos Ramírez, MD',
    role: 'Médico COPP-ADRESD · NPI 1234567890',
    time: 'Hoy · 3:00 PM',
    motivo: 'Control preventivo COPP-ADRESD · Semana 12',
    color: 'var(--teal)',
  },
  {
    when: 'JUE 8 AGO · CONFIRMADA',
    mode: 'Presencial',
    accent: 'linear-gradient(90deg,#0A1F36,var(--navy))',
    emoji: '🥗',
    name: 'Nut. Ana Torres, RDN',
    role: 'Nutricionista · CDR · CPT 97803',
    time: 'Jue 8 ago · 10:00 AM',
    motivo: 'Seguimiento plan nutricional MNT #4',
    color: 'var(--blue)',
  },
  {
    when: 'VIE 9 AGO · CONFIRMADA',
    mode: 'Telemedicina',
    accent: 'linear-gradient(90deg,#2D1B69,#4C1D95)',
    emoji: '💪',
    name: 'Coach Marco Reyes, NBHWC',
    role: 'Health Coach · Certificado NBHWC',
    time: 'Vie 9 ago · 11:00 AM',
    motivo: 'Revisión de metas SMART · Semana 12',
    color: 'var(--pur)',
  },
]

export function AppointmentsPage() {
  const { showToast } = useApp()
  const [cancelId, setCancelId] = useState<string | null>(null)

  return (
    <Screen>
      <Scroll>
        <div className="hero hero-cosmos">
          <div className="h1">📅 Mis citas</div>
          <div className="sub">Citas programadas desde la plataforma ANTARES</div>
          <div className="chips">
            <span className="chip chip-glass">COPP-2024-00142</span>
            <span className="chip chip-gold">● Semana 12 activa</span>
          </div>
        </div>

        <div
          style={{
            margin: '12px 14px',
            background: 'linear-gradient(135deg,#0D2B4B,#1A3D5C)',
            borderRadius: 14,
            padding: 14,
            display: 'flex',
            gap: 12,
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 22 }}>🔗</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Conectado a plataforma de citas</div>
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4, lineHeight: 1.5 }}>
              Las citas se gestionan desde el portal institucional. Usa “Solicitar cita” para agendar.
            </div>
          </div>
        </div>

        <div className="sec">Próximas citas</div>
        {upcoming.map((a) => (
          <div key={a.name} className="card" style={{ margin: '0 14px 10px', padding: 0, overflow: 'hidden' }}>
            <div style={{ background: a.accent, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              <span>{a.when}</span>
              <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '2px 8px' }}>{a.mode}</span>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div className="avatar" style={{ width: 44, height: 44, background: 'var(--blue-l)', fontSize: 20 }}>
                  {a.emoji}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)' }}>{a.role}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.time}</div>
                </div>
              </div>
              <div style={{ background: 'var(--g1)', borderRadius: 10, padding: 10, fontSize: 12, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                <strong style={{ color: 'var(--tx)' }}>Motivo:</strong> {a.motivo}
                <br />
                <strong style={{ color: 'var(--tx)' }}>Seguro:</strong> BlueCross BlueShield · Copago $20
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <IonButton expand="block" className="bt bt-sm bt-teal" onClick={() => showToast('Recordatorio configurado', 'ok')}>
                  🔔 Recordatorio
                </IonButton>
                <IonButton
                  className="bt bt-sm"
                  style={{ '--background': 'var(--red-l)', '--color': 'var(--red)' } as CSSProperties}
                  onClick={() => setCancelId(a.name)}
                >
                  ✕
                </IonButton>
              </div>
            </div>
          </div>
        ))}

        <div className="sec">Citas anteriores</div>
        <div className="card" style={{ margin: '0 14px 12px', padding: 0 }}>
          {[
            ['🩺', 'Dr. Ramírez · Control sem. 8', '8 jul 2026 · Telemedicina'],
            ['🥗', 'Nut. Ana Torres · MNT #3', '1 jul 2026 · Presencial'],
            ['🧠', 'Psic. Luis Mora · CBT #2', '25 jun 2026 · Telemedicina'],
          ].map(([e, n, t]) => (
            <div key={n} style={{ display: 'flex', gap: 10, padding: 12, borderBottom: '1px solid var(--g1)', alignItems: 'center' }}>
              <div className="ico" style={{ marginBottom: 0, background: 'var(--g1)' }}>
                {e}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{t}</div>
              </div>
              <span className="chip chip-teal">✓ Completada</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 14px 8px' }}>
          <IonButton expand="block" className="bt bt-primary" onClick={() => showToast('Abriendo portal.antares.health', 'info')}>
            Solicitar nueva cita · Plataforma ANTARES
          </IonButton>
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

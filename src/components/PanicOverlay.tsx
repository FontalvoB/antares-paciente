import { AnimatePresence, motion } from 'framer-motion'
import { IonButton, IonIcon } from '@ionic/react'
import {
  call,
  checkmarkCircle,
  close,
  heart,
  location,
  medkit,
  people,
  pulse,
  volumeHigh,
} from 'ionicons/icons'
import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

type SosView = 'protocol' | 'call911' | 'callFamily'
type CallPhase = 'dialing' | 'ringing' | 'connected'

const RING = 2 * Math.PI * 78

function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Waveform({ live }: { live: boolean }) {
  return (
    <div className={`sos-wave ${live ? 'live' : ''}`} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  )
}

export function PanicOverlay() {
  const { panicOpen, sosActive, closePanic, activateSos, user, showToast } = useApp()
  const [count, setCount] = useState(5)
  const [view, setView] = useState<SosView>('protocol')
  const [phase, setPhase] = useState<CallPhase>('dialing')
  const [callSec, setCallSec] = useState(0)
  const [lit, setLit] = useState(0)
  const [speakerOn, setSpeakerOn] = useState(true)

  const family = user.fam1Nombre
  const familyRole = user.fam1Parentesco
  const familyCel = user.fam1Cel
  const initials = family
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    if (!panicOpen) {
      setView('protocol')
      setPhase('dialing')
      setCallSec(0)
      setLit(0)
      setCount(5)
      setSpeakerOn(true)
    }
  }, [panicOpen])

  useEffect(() => {
    if (!panicOpen || sosActive) return
    setCount(5)
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(id)
          activateSos()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [panicOpen, sosActive, activateSos])

  useEffect(() => {
    if (!sosActive) {
      setLit(0)
      return
    }
    setLit(1)
    const timers = [450, 950, 1450, 1950, 2400].map((ms, i) =>
      window.setTimeout(() => setLit(i + 2), ms),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [sosActive])

  useEffect(() => {
    if (view !== 'call911' && view !== 'callFamily') return
    setPhase('dialing')
    setCallSec(0)
    const t1 = window.setTimeout(() => setPhase('ringing'), 800)
    const t2 = window.setTimeout(() => setPhase('connected'), 2600)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [view])

  useEffect(() => {
    if (phase !== 'connected') return
    const id = window.setInterval(() => setCallSec((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const startCall = (next: SosView) => {
    if (!sosActive) activateSos()
    setView(next)
  }

  const hangUp = () => {
    setView('protocol')
    setPhase('dialing')
    setCallSec(0)
  }

  const imOk = () => {
    closePanic()
    showToast('Alerta cancelada. Quédate en observación.', 'ok')
  }

  const ringPct = sosActive ? 1 : count / 5
  const calling911 = view === 'call911'
  const callingFam = view === 'callFamily'
  const inCall = calling911 || callingFam
  const phaseLabel =
    phase === 'dialing' ? 'Marcando…' : phase === 'ringing' ? 'Sonando…' : 'En llamada'

  const rows: { key: string; ico: string; title: string; sub: string; tone: string }[] = [
    {
      key: 'amb',
      ico: medkit,
      title: 'Emergencias 911',
      sub: sosActive ? (lit >= 1 ? 'Alerta enviada · despacho en curso' : 'Notificando…') : 'En espera del conteo',
      tone: 'red',
    },
    {
      key: 'fam',
      ico: people,
      title: family,
      sub: sosActive && lit >= 2 ? `Alerta enviada · ${familyCel}` : `${familyRole} · ${familyCel}`,
      tone: 'ice',
    },
    {
      key: 'doc',
      ico: pulse,
      title: 'Dr. Ramírez',
      sub: sosActive && lit >= 3 ? 'Equipo COPP-ADRESD notificado' : 'Médico de cabecera',
      tone: 'blue',
    },
    {
      key: 'gps',
      ico: location,
      title: 'Ubicación GPS',
      sub: sosActive && lit >= 4 ? 'Enviando 25.7617° N, 80.1918° W' : 'Se comparte al activar',
      tone: 'teal',
    },
    {
      key: 'vit',
      ico: heart,
      title: 'Signos vitales',
      sub: sosActive && lit >= 5 ? 'FC 140 · SpO2 94% · TA 160/110' : 'Se adjuntan al activar',
      tone: 'org',
    },
  ]

  return (
    <AnimatePresence>
      {panicOpen && (
        <motion.div
          className={`overlay overlay-panic sos-screen ${sosActive ? 'is-hot' : ''} ${inCall ? 'is-call' : ''} ${calling911 ? 'is-call-911' : ''} ${callingFam ? 'is-call-fam' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="sos-aurora" aria-hidden="true" />

          <AnimatePresence mode="wait" initial={false}>
            {!inCall ? (
              <motion.div
                key="protocol"
                className="sos-protocol"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <header className="sos-head">
                  <span className={`sos-live ${sosActive ? 'on' : ''}`}>
                    {sosActive ? 'SOS ACTIVO' : 'PROTOCOLO ARMADO'}
                  </span>
                  <p>{sosActive ? 'Ayuda en camino' : 'Se activa sola en'}</p>
                </header>

                <div className="sos-orb-wrap">
                  <span className="sos-ripple r1" />
                  <span className="sos-ripple r2" />
                  <span className="sos-ripple r3" />
                  <svg className="sos-count-ring" viewBox="0 0 180 180" aria-hidden="true">
                    <circle cx="90" cy="90" r="78" className="sos-count-track" />
                    <motion.circle
                      cx="90"
                      cy="90"
                      r="78"
                      className="sos-count-fill"
                      strokeDasharray={RING}
                      animate={{ strokeDashoffset: RING * (1 - ringPct) }}
                      transition={{ duration: sosActive ? 0.4 : 0.95, ease: [0.22, 1, 0.36, 1] }}
                      transform="rotate(-90 90 90)"
                    />
                  </svg>
                  <button
                    type="button"
                    className={`sos-orb ${sosActive ? 'hot' : ''}`}
                    onClick={activateSos}
                    aria-label={sosActive ? 'SOS activado' : `Activar SOS ahora. Quedan ${count} segundos`}
                  >
                    {sosActive ? (
                      <IonIcon icon={medkit} />
                    ) : (
                      <b aria-live="assertive">{count}</b>
                    )}
                  </button>
                </div>

                <div className="sos-copy">
                  <h1>{sosActive ? 'Protocolo lanzado' : 'Botón de pánico'}</h1>
                  <p>
                    {sosActive
                      ? 'Ambulancia, familia y tu equipo médico están recibiendo GPS y signos vitales.'
                      : 'Toca el círculo o espera el conteo. 911, tu familiar y el médico se notifican juntos.'}
                  </p>
                </div>

                <ul className="sos-feed">
                  {rows.map((r, i) => {
                    const on = sosActive && lit > i
                    return (
                      <li key={r.key} className={`sos-feed-row tone-${r.tone} ${on ? 'on' : ''}`}>
                        <span className="sos-feed-ico">
                          <IonIcon icon={on ? checkmarkCircle : r.ico} />
                        </span>
                        <span>
                          <strong>{r.title}</strong>
                          <small>{r.sub}</small>
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <div className="sos-actions">
                  <IonButton className="bt sos-act-911" onClick={() => startCall('call911')}>
                    <IonIcon icon={call} slot="start" />
                    Llamar 911
                  </IonButton>
                  <IonButton className="bt sos-act-fam" onClick={() => startCall('callFamily')}>
                    <IonIcon icon={people} slot="start" />
                    Llamar familiar
                  </IonButton>
                </div>
                <IonButton expand="block" className="bt sos-act-ok" onClick={imOk}>
                  <IonIcon icon={sosActive ? checkmarkCircle : close} slot="start" />
                  Estoy bien
                </IonButton>
              </motion.div>
            ) : (
              <motion.div
                key={view}
                className={`sos-call ${calling911 ? 'tone-911' : 'tone-fam'}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="sos-call-kicker">
                  {calling911 ? 'EMERGENCIAS 911' : 'CONTACTO DE EMERGENCIA'}
                </div>

                <div className="sos-call-orb">
                  <span className="sos-call-halo h1" />
                  <span className="sos-call-halo h2" />
                  <span className="sos-call-halo h3" />
                  <span className="sos-call-face">
                    {calling911 ? <IonIcon icon={medkit} /> : initials}
                  </span>
                </div>

                <h2>{calling911 ? '911' : family}</h2>
                {!calling911 && <em className="sos-call-role">{familyRole}</em>}
                <p className="sos-call-sub">
                  {calling911
                    ? phase === 'connected'
                      ? 'Operador de emergencias · Miami-Dade'
                      : 'Central de emergencias'
                    : familyCel}
                </p>
                <div className={`sos-call-phase ${phase}`}>
                  <i />
                  {phase === 'connected' ? mmss(callSec) : phaseLabel}
                </div>
                <Waveform live={phase === 'connected'} />

                <div className="sos-call-chips">
                  <span>
                    <IonIcon icon={location} /> GPS en vivo
                  </span>
                  <span>
                    <IonIcon icon={heart} /> FC 140 · SpO2 94%
                  </span>
                </div>

                {phase === 'connected' && (
                  <p className="sos-call-note">
                    {calling911
                      ? 'Unidad en despacho. Quédate en el teléfono y no cuelgues.'
                      : `${family.split(' ')[0]} ya recibió tu alerta, ubicación y signos.`}
                  </p>
                )}

                <div className="sos-call-bar">
                  <IonButton
                    className={`bt bt-round-lg sos-side ${speakerOn ? 'on' : ''}`}
                    aria-label={speakerOn ? 'Altavoz encendido' : 'Altavoz apagado'}
                    onClick={() => setSpeakerOn((v) => !v)}
                  >
                    <IonIcon icon={volumeHigh} slot="icon-only" />
                  </IonButton>
                  <IonButton className="bt sos-hang" aria-label="Colgar" onClick={hangUp}>
                    <IonIcon icon={call} slot="icon-only" />
                  </IonButton>
                  <IonButton className="bt bt-round-lg sos-side" aria-label="Volver al protocolo" onClick={hangUp}>
                    <IonIcon icon={close} slot="icon-only" />
                  </IonButton>
                </div>
                <span className="sos-hang-lbl">Colgar y volver al protocolo</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

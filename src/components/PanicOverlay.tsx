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
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { buildSosDataBlock } from '../utils/sosMessage'
import type { SosDispatchResult } from '../utils/sosApi'

type SosView = 'protocol' | 'call911' | 'callFamily'
type CallPhase = 'dialing' | 'ringing' | 'connected'

const RING = 2 * Math.PI * 78

function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Format decimal degrees to display string: 25.7617° N, 80.1918° W */
function formatCoordDisplay(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal)
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W')
  return `${abs.toFixed(4)}° ${dir}`
}

/** Strip spaces, parens, dashes from a phone number for tel: links */
function cleanPhone(raw: string): string {
  return raw.replace(/[\s()\-+]/g, '')
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

const SOS_VITALS = { heartRate: 140, spo2: 94, bloodPressure: '160/110' } as const

export function PanicOverlay() {
  const { panicOpen, sosActive, sosCoords, sosDispatch, closePanic, activateSos, user, showToast } = useApp()
  const { t, lang } = useI18n()
  const [count, setCount] = useState(5)
  const [view, setView] = useState<SosView>('protocol')
  const [phase, setPhase] = useState<CallPhase>('dialing')
  const [callSec, setCallSec] = useState(0)
  const [lit, setLit] = useState(0)
  const [speakerOn, setSpeakerOn] = useState(true)
  const countdownAutoDialRef = useRef(false)

  const family = user.fam1Nombre
  const familyRole = user.fam1Parentesco
  const familyCel = user.fam1Cel
  const initials = family
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  const emergencyNumber = sosDispatch?.emergencyNumber ?? '911'

  // Cancel speech when overlay closes
  useEffect(() => {
    if (!panicOpen) {
      setView('protocol')
      setPhase('dialing')
      setCallSec(0)
      setLit(0)
      setCount(5)
      setSpeakerOn(true)
      countdownAutoDialRef.current = false
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel()
      }
    }
  }, [panicOpen])

  // Countdown timer — auto-dial when countdown reaches 0
  useEffect(() => {
    if (!panicOpen || sosActive) return
    setCount(5)
    countdownAutoDialRef.current = false
    const id = window.setInterval(() => {
      setCount((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [panicOpen, sosActive])

  // Auto-dial 911 at countdown zero (NOT on manual orb tap: sosActive blocks this)
  useEffect(() => {
    if (!panicOpen || sosActive || count !== 0) return
    if (countdownAutoDialRef.current) return
    countdownAutoDialRef.current = true
    activateSos()
    try {
      window.location.href = `tel:${emergencyNumber}`
    } catch { /* native dialer may not be available in web */ }
  }, [panicOpen, sosActive, count, activateSos, emergencyNumber])

  // Feed row lighting animation
  useEffect(() => {
    if (!sosActive) {
      setLit(0)
      return
    }
    setLit(1)
    const timers = [450, 950, 1450, 1950, 2400].map((ms, i) =>
      window.setTimeout(() => setLit(i + 2), ms),
    )
    return () => timers.forEach((tm) => window.clearTimeout(tm))
  }, [sosActive])

  // Simulated call phase transitions
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
    // Trigger native dialer
    try {
      const phone = next === 'call911' ? emergencyNumber : cleanPhone(familyCel)
      window.location.href = `tel:${phone}`
    } catch { /* native dialer may not be available in web */ }
  }

  const hangUp = () => {
    setView('protocol')
    setPhase('dialing')
    setCallSec(0)
  }

  const imOk = () => {
    closePanic()
    showToast(t('Alerta cancelada. Quédate en observación.'), 'ok')
  }

  /** "No puedo hablar" — speak the SOS data block via TTS */
  const speakSosMessage = () => {
    const text = buildSosDataBlock(user, sosCoords, SOS_VITALS, lang)
    if (typeof speechSynthesis === 'undefined' || !window.speechSynthesis) {
      showToast(t('Tu dispositivo no soporta lectura de voz.'), 'warn')
      return
    }
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang === 'es' ? 'es-ES' : 'en-US'
    speechSynthesis.speak(utter)
  }

  const ringPct = sosActive ? 1 : count / 5
  const calling911 = view === 'call911'
  const callingFam = view === 'callFamily'
  const inCall = calling911 || callingFam
  const phaseLabel =
    phase === 'dialing' ? t('Marcando…') : phase === 'ringing' ? t('Sonando…') : t('En llamada')

  // ── GPS display text ──────────────────────────────────────────────
  const gpsDisplayText = sosCoords
    ? `${formatCoordDisplay(sosCoords.latitude, true)}, ${formatCoordDisplay(sosCoords.longitude, false)}`
    : null

  // ── Feed rows with real channel status when sosDispatch is present ──
  const rows: { key: string; ico: string; title: string; sub: string; tone: string }[] = [
    // 911 / SMS row — always red tone, reflect real voice channel if available
    {
      key: 'amb',
      ico: medkit,
      title: t('Emergencias 911'),
      sub: sosActive
        ? (lit >= 1
          ? (sosDispatch
            ? voiceChannelLabel(sosDispatch, t)
            : t('Alerta enviada · despacho en curso'))
          : t('Notificando…'))
        : t('En espera del conteo'),
      tone: 'red',
    },
    // Family row — reflect real SMS/email status if available
    {
      key: 'fam',
      ico: people,
      title: family,
      sub: sosActive && lit >= 2
        ? (sosDispatch
          ? familyChannelLabel(sosDispatch, familyCel, t)
          : t('Alerta enviada · {phone}', { phone: familyCel }))
        : `${familyRole} · ${familyCel}`,
      tone: 'ice',
    },
    {
      key: 'doc',
      ico: pulse,
      title: t('Dr. Ramírez'),
      sub: sosActive && lit >= 3 ? t('Equipo COPP-ADRESD notificado') : t('Médico de cabecera'),
      tone: 'blue',
    },
    // GPS row — real coords when available
    {
      key: 'gps',
      ico: location,
      title: t('Ubicación GPS'),
      sub: sosActive && lit >= 4
        ? (gpsDisplayText
          ? t('Enviando coordenadas GPS') + ' · ' + gpsDisplayText
          : t('Ubicación no disponible'))
        : t('Se comparte al activar'),
      tone: 'teal',
    },
    {
      key: 'vit',
      ico: heart,
      title: t('Signos vitales'),
      sub: sosActive && lit >= 5 ? t('FC 140 · SpO2 94% · TA 160/110') : t('Se adjuntan al activar'),
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
                    {sosActive ? t('SOS ACTIVO') : t('PROTOCOLO ARMADO')}
                  </span>
                  <p>{sosActive ? t('Ayuda en camino') : t('Se activa sola en')}</p>
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
                    aria-label={sosActive ? t('SOS activado') : t('Activar SOS ahora. Quedan {count} segundos', { count: String(count) })}
                  >
                    {sosActive ? (
                      <IonIcon icon={medkit} />
                    ) : (
                      <b aria-live="assertive">{count}</b>
                    )}
                  </button>
                </div>

                <div className="sos-copy">
                  <h1>{sosActive ? t('Protocolo lanzado') : t('Botón de pánico')}</h1>
                  <p>
                    {sosActive
                      ? t('Ambulancia, familia y tu equipo médico están recibiendo GPS y signos vitales.')
                      : t('Toca el círculo o espera el conteo. 911, tu familiar y el médico se notifican juntos.')}
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
                    {t('Llamar 911')}
                  </IonButton>
                  <IonButton className="bt sos-act-fam" onClick={() => startCall('callFamily')}>
                    <IonIcon icon={people} slot="start" />
                    {t('Llamar familiar')}
                  </IonButton>
                </div>
                <IonButton expand="block" className="bt sos-act-speak" onClick={speakSosMessage}>
                  <IonIcon icon={volumeHigh} slot="start" />
                  {t('No puedo hablar')}
                </IonButton>
                <IonButton expand="block" className="bt sos-act-ok" onClick={imOk}>
                  <IonIcon icon={sosActive ? checkmarkCircle : close} slot="start" />
                  {t('Estoy bien')}
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
                  {calling911 ? t('EMERGENCIAS 911') : t('CONTACTO DE EMERGENCIA')}
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
                      ? t('Operador de emergencias · Miami-Dade')
                      : t('Central de emergencias')
                    : familyCel}
                </p>
                <div className={`sos-call-phase ${phase}`}>
                  <i />
                  {phase === 'connected' ? mmss(callSec) : phaseLabel}
                </div>
                <Waveform live={phase === 'connected'} />

                <div className="sos-call-chips">
                  <span>
                    <IonIcon icon={location} /> {t('GPS en vivo')}
                  </span>
                  <span>
                    <IonIcon icon={heart} /> {t('FC 140 · SpO2 94%')}
                  </span>
                </div>

                {phase === 'connected' && (
                  <p className="sos-call-note">
                    {calling911
                      ? t('Unidad en despacho. Quédate en el teléfono y no cuelgues.')
                      : t('{name} ya recibió tu alerta, ubicación y signos.', { name: family.split(' ')[0] })}
                  </p>
                )}

                <div className="sos-call-bar">
                  <IonButton
                    className={`bt bt-round-lg sos-side ${speakerOn ? 'on' : ''}`}
                    aria-label={speakerOn ? t('Altavoz encendido') : t('Altavoz apagado')}
                    onClick={() => setSpeakerOn((v) => !v)}
                  >
                    <IonIcon icon={volumeHigh} slot="icon-only" />
                  </IonButton>
                  <IonButton className="bt sos-hang" aria-label={t('Colgar')} onClick={hangUp}>
                    <IonIcon icon={call} slot="icon-only" />
                  </IonButton>
                  <IonButton className="bt bt-round-lg sos-side" aria-label={t('Volver al protocolo')} onClick={hangUp}>
                    <IonIcon icon={close} slot="icon-only" />
                  </IonButton>
                </div>
                <span className="sos-hang-lbl">{t('Colgar y volver al protocolo')}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Channel label helpers ──────────────────────────────────────────────

function voiceChannelLabel(d: SosDispatchResult, t: (s: string, p?: Record<string, string>) => string): string {
  const v = d.channels.voice.status
  if (v === 'Sent') return t('Llamada con mensaje enviada')
  if (v === 'Failed') return t('Fallo de llamada')
  return t('Alerta enviada · despacho en curso')
}

function familyChannelLabel(d: SosDispatchResult, phone: string, t: (s: string, p?: Record<string, string>) => string): string {
  const sms = d.channels.sms.status
  const email = d.channels.email.status
  const sent = (s: string) => s === 'Sent'
  if (sent(sms) && sent(email)) return t('Alerta enviada · SMS + correo')
  if (sent(sms)) return t('Alerta enviada · {phone}', { phone })
  if (sent(email)) return t('Alerta enviada · correo electrónico')
  if (sms === 'Failed' || email === 'Failed') return t('Fallo al enviar alerta')
  return t('Alerta enviada · {phone}', { phone })
}

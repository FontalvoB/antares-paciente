import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/react'
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
  shieldCheckmarkOutline,
  informationCircleOutline,
  arrowBack,
} from 'ionicons/icons'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'

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
  const t = useT()
  const reduce = useReducedMotion()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(5)
  const [view, setView] = useState<SosView>('protocol')
  const [phase, setPhase] = useState<CallPhase>('dialing')
  const [callSec, setCallSec] = useState(0)
  const [lit, setLit] = useState(0)
  const [speakerOn, setSpeakerOn] = useState(true)

  // Overlay de emergencia custom: conserva su temporizador y devuelve el foco
  // al acceso SOS al cerrar. Los controles siguen siendo componentes Ionic.
  useEffect(() => {
    if (!panicOpen) return
    const previous = document.activeElement as HTMLElement | null
    return () => previous?.focus()
  }, [panicOpen])

  useEffect(() => {
    if (!panicOpen) return
    const frame = requestAnimationFrame(() => overlayRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [panicOpen, view])

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
    showToast(t('Alerta cancelada. Quédate en observación.'), 'ok')

  }

  const ringPct = sosActive ? 1 : count / 5
  const calling911 = view === 'call911'
  const callingFam = view === 'callFamily'
  const inCall = calling911 || callingFam
  const phaseLabel =
    phase === 'dialing' ? t('Marcando…') : phase === 'ringing' ? t('Sonando…') : t('En llamada')

  const rows: { key: string; ico: string; title: string; sub: string; tone: string }[] = [
    {
      key: 'amb',
      ico: medkit,
      title: t('Emergencias 911'),
      sub: sosActive ? (lit >= 1 ? t('Alerta enviada · despacho en curso') : t('Notificando…')) : t('En espera del conteo'),
      tone: 'red',
    },
    {
      key: 'fam',
      ico: people,
      title: family,
      sub: sosActive && lit >= 2 ? t('Alerta enviada · {phone}', { phone: familyCel }) : `${familyRole} · ${familyCel}`,
      tone: 'ice',
    },
    {
      key: 'doc',
      ico: pulse,
      title: t('Dr. Ramírez'),
      sub: sosActive && lit >= 3 ? t('Equipo COPP-ADRESD notificado') : t('Médico de cabecera'),
      tone: 'blue',
    },
    {
      key: 'gps',
      ico: location,
      title: t('Ubicación GPS'),
      sub: sosActive && lit >= 4 ? t('Enviando 25.7617° N, 80.1918° W') : t('Se comparte al activar'),
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
    <MotionConfig reducedMotion="user">
    <AnimatePresence>
      {panicOpen && (
        <motion.div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('Asistencia de emergencia SOS')}
          tabIndex={-1}
          onKeyDown={event => {
            if (event.key !== 'Tab') return
            const buttons = Array.from(overlayRef.current?.querySelectorAll('ion-button') ?? [])
              .filter(button => !button.disabled && button.getClientRects().length > 0)
            const first = buttons[0]
            const last = buttons[buttons.length - 1]
            const active = document.activeElement
            if (event.shiftKey && (active === first || active === overlayRef.current)) {
              event.preventDefault()
              last?.shadowRoot?.querySelector('button')?.focus()
            } else if (!event.shiftKey && active === last) {
              event.preventDefault()
              first?.shadowRoot?.querySelector('button')?.focus()
            }
          }}
          className={`overlay overlay-panic sos-screen sos-modern ${sosActive ? 'is-hot' : ''} ${inCall ? 'is-call' : ''} ${calling911 ? 'is-call-911' : ''} ${callingFam ? 'is-call-fam' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <header className="sos-topbar">
            <div className="sos-brand"><span><IonIcon icon={medkit} aria-hidden="true" /></span><div><strong>SOS</strong><small>{t('Asistencia de emergencia')}</small></div></div>
            <IonButton fill="clear" className="sos-top-close" onClick={inCall ? hangUp : imOk} aria-label={inCall ? t('Volver al protocolo') : sosActive ? t('Estoy bien') : t('Cancelar activación')}>
              <IonIcon icon={inCall ? arrowBack : close} slot="start" />
              {inCall ? t('Volver') : sosActive ? t('Cerrar') : t('Cancelar')}
            </IonButton>
          </header>
          <div className="sos-demo-note"><IonIcon icon={informationCircleOutline} aria-hidden="true" /><span>{t('Simulación SOS: no realiza llamadas ni envía alertas.')}</span></div>

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
                <div className="sos-scroll-body">
                  <section className="sos-alert-card">
                    <header className="sos-head">
                      <IonBadge className={`sos-live ${sosActive ? 'on' : ''}`}>
                        {sosActive ? t('SOS ACTIVO') : t('PROTOCOLO ARMADO')}
                      </IonBadge>
                      <p>{sosActive ? t('Protocolo de emergencia') : t('Activación automática en 5 segundos')}</p>
                    </header>

                    <div className="sos-orb-wrap">
                      <span className="sos-ripple r1" aria-hidden="true" />
                      <span className="sos-ripple r2" aria-hidden="true" />
                      <svg className="sos-count-ring" viewBox="0 0 180 180" aria-hidden="true">
                        <circle cx="90" cy="90" r="78" className="sos-count-track" />
                        <motion.circle
                          cx="90"
                          cy="90"
                          r="78"
                          className="sos-count-fill"
                          strokeDasharray={RING}
                          animate={{ strokeDashoffset: RING * (1 - ringPct) }}
                          transition={{ duration: reduce ? 0 : sosActive ? 0.4 : 0.95, ease: [0.22, 1, 0.36, 1] }}
                          transform="rotate(-90 90 90)"
                        />
                      </svg>
                      <IonButton
                        type="button"
                        className={`sos-orb ${sosActive ? 'hot' : ''}`}
                        onClick={activateSos}
                        disabled={sosActive}
                        aria-label={sosActive ? t('SOS activado') : t('Activar SOS ahora. Quedan {count} segundos', { count: String(count) })}
                      >
                        <span className="sos-orb-content">{sosActive ? <IonIcon icon={medkit} aria-hidden="true" /> : <b>{count}</b>}<small>{sosActive ? 'SOS' : t('Activar ahora')}</small></span>
                      </IonButton>
                    </div>

                    <div className="sos-copy">
                      <h1 aria-live="polite">{sosActive ? t('Protocolo activado') : t('Estamos para ayudarte')}</h1>
                      <p>
                        {sosActive
                          ? t('Ambulancia, familia y tu equipo médico están recibiendo GPS y signos vitales.')
                          : t('Toca el círculo o espera el conteo. 911, tu familiar y el médico se notifican juntos.')}
                      </p>
                    </div>
                  </section>

                  <section className="sos-network">
                    <div className="sos-section-heading"><div><small>{t('CONTACTOS DE EMERGENCIA')}</small><h2>{t('Tu red de ayuda')}</h2></div><IonIcon icon={people} aria-hidden="true" /></div>
                  <IonList className="sos-feed" lines="none">
                    {rows.slice(0, 3).map((r, i) => {
                      const on = sosActive && lit > i
                      return (
                        <IonItem key={r.key} className={`sos-feed-row tone-${r.tone} ${on ? 'on' : ''}`}>
                          <span slot="start" className="sos-feed-ico">
                            <IonIcon icon={r.ico} aria-hidden="true" />
                          </span>
                          <IonLabel>
                            <strong>{r.title}</strong>
                            <small>{r.sub}</small>
                          </IonLabel>
                          <IonIcon className="sos-row-status" slot="end" icon={on ? checkmarkCircle : shieldCheckmarkOutline} aria-label={on ? t('Notificado') : t('En espera')} />
                        </IonItem>
                      )
                    })}
                  </IonList>
                  </section>

                  <section className="sos-shared">
                    <div className="sos-section-heading"><div><small>{t('CONTEXTO DE LA ALERTA')}</small><h2>{t('Información compartida')}</h2></div><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /></div>
                    <div className="sos-data-grid">
                      {rows.slice(3).map((row, i) => <article key={row.key} className={`sos-data-card ${sosActive && lit > i + 3 ? 'on' : ''}`}>
                        <IonIcon icon={row.ico} aria-hidden="true" /><h3>{row.title}</h3><p>{row.sub}</p>
                      </article>)}
                    </div>
                  </section>
                </div>

                <footer className="sos-action-dock">
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
                  <IonButton expand="block" className="bt sos-act-ok" onClick={imOk}>
                    <IonIcon icon={sosActive ? checkmarkCircle : close} slot="start" />
                    {sosActive ? t('Estoy bien') : t('Cancelar activación')}
                  </IonButton>
                </footer>
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
                <div className="sos-call-body">
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

                </div>
                <footer className="sos-call-controls">
                  <div className="sos-call-bar">
                    <IonButton
                      className={`bt bt-round-lg sos-side ${speakerOn ? 'on' : ''}`}
                      aria-label={speakerOn ? t('Altavoz encendido') : t('Altavoz apagado')}
                      aria-pressed={speakerOn ? 'true' : 'false'}
                      onClick={() => setSpeakerOn((v) => !v)}
                    >
                      <IonIcon icon={volumeHigh} slot="icon-only" />
                    </IonButton>
                    <IonButton className="bt sos-hang" aria-label={t('Colgar')} onClick={hangUp}>
                      <IonIcon icon={call} slot="icon-only" />
                    </IonButton>
                    <IonButton className="bt bt-round-lg sos-side" aria-label={t('Volver al protocolo')} onClick={hangUp}>
                      <IonIcon icon={shieldCheckmarkOutline} slot="icon-only" />
                    </IonButton>
                  </div>
                  <div className="sos-control-labels"><span>{t('Altavoz')}</span><span>{t('Colgar')}</span><span>{t('Protocolo')}</span></div>
                  <span className="sos-hang-lbl">{t('Colgar y volver al protocolo')}</span>
                </footer>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>
  )
}

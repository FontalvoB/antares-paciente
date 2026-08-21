import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonModal,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
} from '@ionic/react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  barbell,
  checkmark,
  close,
  flame,
  flask,
  headset,
  happy,
  nutrition,
  pause,
  play,
  pulse,
  star,
  trophy,
} from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { PROGRAM_POINTS_MAX, PROGRAM_TASKS, PROGRAM_WEEKS, WEEK_LABELS } from '../data/program'
import type { ProgramTaskId } from '../types'
import { weekdayMondayIndex } from '../utils/dates'

const TASK_ICONS: Record<ProgramTaskId, string> = {
  podcast: headset,
  vitals: pulse,
  nut: nutrition,
  ejercicio: barbell,
  nutribiotico: flask,
  emocional: happy,
}

const VITAL_FIELDS = ['❤️ FC', '🩺 Presión', '💨 SpO2', '🩸 Glucosa', '⚖️ Peso', '🌡️ Temp']
const MOODS = [
  { v: '1', face: '😔', label: 'Bajo' },
  { v: '2', face: '😕', label: 'Regular' },
  { v: '3', face: '😐', label: 'Neutro' },
  { v: '4', face: '🙂', label: 'Bien' },
  { v: '5', face: '😄', label: 'Alto' },
]

export function ProgramPage() {
  const {
    program,
    completeStep,
    pointsToday,
    navigate,
    showToast,
    mealsLogged,
    streak,
    programWeek,
    weekCheckins,
  } = useApp()

  const [active, setActive] = useState<ProgramTaskId | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [running, setRunning] = useState(false)
  const [secs, setSecs] = useState(12 * 60)
  const [podPlaying, setPodPlaying] = useState(false)
  const [podProgress, setPodProgress] = useState(0)
  const [mood, setMood] = useState('')
  const [energy, setEnergy] = useState('')
  const [note, setNote] = useState('')
  const [nutriSlot, setNutriSlot] = useState('manana')
  const prevAll = useRef(false)

  const doneCount = PROGRAM_TASKS.filter((t) => program[t.id]).length
  const allDone = doneCount === PROGRAM_TASKS.length
  const currentId = PROGRAM_TASKS.find((t) => !program[t.id])?.id
  const todayIdx = weekdayMondayIndex()
  const weekPct = programWeek / PROGRAM_WEEKS

  const task = useMemo(() => PROGRAM_TASKS.find((t) => t.id === active) ?? null, [active])

  useEffect(() => {
    if (allDone && !prevAll.current) setCelebrate(true)
    prevAll.current = allDone
  }, [allDone])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          setRunning(false)
          if (!program.ejercicio) {
            completeStep('ejercicio', 150)
            showToast('Circuito completado · +150 pts', 'ok')
            setActive(null)
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, program.ejercicio, completeStep, showToast])

  useEffect(() => {
    if (!podPlaying) return
    const id = window.setInterval(() => {
      setPodProgress((p) => {
        if (p >= 1) {
          window.clearInterval(id)
          setPodPlaying(false)
          return 1
        }
        return Math.min(1, p + 0.04)
      })
    }, 220)
    return () => window.clearInterval(id)
  }, [podPlaying])

  const finish = (id: ProgramTaskId, pts: number, msg: string) => {
    if (program[id]) return
    completeStep(id, pts)
    showToast(msg, 'ok')
    setActive(null)
  }

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <Screen>
      <Scroll>
        <div className="hero hero-cosmos duo-hero">
          <div className="kicker">COPP-ADRESD · 83 SEMANAS</div>
          <div className="h1">Mi programa de hoy</div>
          <div className="sub">
            Semana {programWeek} de {PROGRAM_WEEKS} · Completa las 6 misiones diarias
          </div>

          <div className="duo-stats">
            <div className={`duo-stat ${allDone ? 'hot' : ''}`}>
              <IonIcon icon={flame} />
              <div>
                <strong>{streak}</strong>
                <span>días de racha</span>
              </div>
            </div>
            <div className="duo-stat">
              <IonIcon icon={star} />
              <div>
                <strong>
                  {pointsToday} / {PROGRAM_POINTS_MAX}
                </strong>
                <span>puntos hoy</span>
              </div>
            </div>
          </div>

          <div className="duo-week" role="list" aria-label="Racha de la semana">
            {WEEK_LABELS.map((label, i) => {
              const done = weekCheckins[i]
              const isToday = i === todayIdx
              return (
                <div
                  key={label}
                  role="listitem"
                  className={`duo-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}`}
                >
                  <span>{label}</span>
                  <b>{done ? '✓' : isToday ? '·' : ''}</b>
                </div>
              )
            })}
          </div>

          <IonProgressBar
            className="pb"
            value={weekPct}
            style={
              {
                marginTop: 12,
                '--background': 'rgba(255,255,255,.12)',
                '--progress-background': 'linear-gradient(90deg,var(--cyan),var(--teal))',
              } as CSSProperties
            }
          />
          <div className="duo-week-caption">
            Recorrido del programa · {Math.round(weekPct * 100)}%
          </div>
        </div>

        <div className="duo-progress-chip">
          {allDone ? '¡Día perfecto! Vuelve mañana para seguir la racha' : `${doneCount} de 6 misiones · toca el nodo activo`}
        </div>

        <div className="duo-track">
          <div className="duo-rail" aria-hidden="true" />
          {PROGRAM_TASKS.map((t, i) => {
            const done = program[t.id]
            const current = t.id === currentId
            return (
              <motion.div
                key={t.id}
                className={`duo-row ${i % 2 === 0 ? 'left' : 'right'}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  type="button"
                  className={`duo-node tone-${t.tone} ${done ? 'done' : ''} ${current ? 'current' : ''}`}
                  aria-label={`${t.title}${done ? ', completada' : current ? ', siguiente' : ''}`}
                  onClick={() => setActive(t.id)}
                >
                  <IonIcon icon={done ? checkmark : TASK_ICONS[t.id]} />
                  {current && !done && <span className="duo-pulse" />}
                </button>
                <div className="duo-meta">
                  <div className="duo-meta-title">{t.title}</div>
                  <div className="duo-meta-sub">{done ? 'Completada' : t.short}</div>
                  <span className="chip chip-gold">+{t.pts} pts</span>
                </div>
              </motion.div>
            )
          })}
          <div className={`duo-chest ${allDone ? 'open' : ''}`}>
            <div className="duo-chest-ico">
              <IonIcon icon={trophy} />
            </div>
            <span>{allDone ? 'Recompensa del día desbloqueada' : 'Completa las 6 para subir la racha'}</span>
          </div>
        </div>
      </Scroll>

      <IonModal
        isOpen={!!active && !!task}
        onDidDismiss={() => setActive(null)}
        initialBreakpoint={1}
        breakpoints={[0, 1]}
        handle
        className="lesson-modal"
      >
        {task && (
          <IonContent>
            <div className="lesson-sheet">
            <div className="lesson-sheet-head">
              <div>
                <div className="kicker" style={{ color: 'var(--mu)' }}>
                  Misión · +{task.pts} pts
                </div>
                <h2>{task.title}</h2>
                <p>{task.hint}</p>
              </div>
              <IonButton fill="clear" aria-label="Cerrar" onClick={() => setActive(null)}>
                <IonIcon slot="icon-only" icon={close} />
              </IonButton>
            </div>

            {program[task.id] && (
              <div className="lesson-done-banner">Completada hoy · +{task.pts} pts</div>
            )}

            {task.id === 'podcast' && (
              <div className="pod-player">
                <div className="pod-cover">
                  <IonIcon icon={headset} />
                </div>
                <div className="pod-copy">
                  <strong>Semana {programWeek} · Consistencia metabólica</strong>
                  <span>Dr. Ramírez · 8:12</span>
                </div>
                <IonProgressBar value={podProgress} className="pb" />
                <IonButton
                  expand="block"
                  className="bt bt-pur"
                  onClick={() => setPodPlaying((v) => !v)}
                  disabled={program.podcast}
                >
                  <IonIcon icon={podPlaying ? pause : play} slot="start" />
                  {podPlaying ? 'Pausar' : podProgress >= 1 ? 'Volver a escuchar' : 'Reproducir episodio'}
                </IonButton>
                {!program.podcast && (
                  <IonButton
                    expand="block"
                    className="bt bt-primary"
                    disabled={podProgress < 0.7}
                    onClick={() => finish('podcast', task.pts, 'Podcast escuchado · +80 pts')}
                  >
                    {podProgress < 0.7 ? 'Escucha al menos el 70%' : 'Marcar como escuchado · +80 pts'}
                  </IonButton>
                )}
              </div>
            )}

            {task.id === 'vitals' && (
              <>
                <div className="vital-grid">
                  {VITAL_FIELDS.map((l) => (
                    <div key={l} className="vital-inp">
                      <label>{l}</label>
                      <IonInput className="vital-i" placeholder="—" inputmode="decimal" />
                    </div>
                  ))}
                </div>
                {!program.vitals && (
                  <IonButton
                    expand="block"
                    className="bt bt-primary"
                    onClick={() => finish('vitals', task.pts, '+120 pts por signos vitales')}
                  >
                    Registrar signos · +120 pts
                  </IonButton>
                )}
              </>
            )}

            {task.id === 'nut' && (
              <>
                <div className="nut-slots">
                  {[
                    ['des', '🌅 Des'],
                    ['alm', '☀️ Alm'],
                    ['mer', '🍎 Mer'],
                    ['cen', '🌙 Cena'],
                  ].map(([id, t]) => (
                    <div key={id} className={`nut-slot ${mealsLogged.includes(id) ? 'on' : ''}`}>
                      {t}
                    </div>
                  ))}
                </div>
                <IonButton expand="block" className="bt bt-teal" onClick={() => { setActive(null); navigate('nut') }}>
                  Ir a registrar comidas
                </IonButton>
                {!program.nut && mealsLogged.length >= 2 && (
                  <IonButton
                    expand="block"
                    className="bt bt-gold"
                    style={{ marginTop: 8 }}
                    onClick={() => finish('nut', task.pts, '+150 pts nutrición')}
                  >
                    Validar adherencia · +150
                  </IonButton>
                )}
                {!program.nut && mealsLogged.length < 2 && (
                  <p className="lesson-hint">Registra al menos 2 comidas para validar el plan de hoy.</p>
                )}
              </>
            )}

            {task.id === 'ejercicio' && (
              <>
                <div className="ex-timer">
                  <div className="kicker" style={{ color: 'var(--ice)' }}>
                    Temporizador
                  </div>
                  <div className="display ex-clock">
                    {mm}:{ss}
                  </div>
                </div>
                <div className="ex-plan">
                  ① Calentamiento 2 min · ② Sentadillas 2 min · ③ Plancha 1 min · ④ Caminata 3 min · ⑤ Estiramiento 2 min · ⑥ Respiración 4-7-8
                </div>
                {!program.ejercicio && (
                  <>
                    <IonButton expand="block" className="bt bt-pur" onClick={() => setRunning((r) => !r)}>
                      {running ? 'Pausar' : 'Iniciar circuito'}
                    </IonButton>
                    <IonButton
                      expand="block"
                      className="bt bt-ghost"
                      style={{ marginTop: 8 }}
                      onClick={() => finish('ejercicio', task.pts, 'Ejercicio del día · +150 pts')}
                    >
                      Ya lo hice · +150 pts
                    </IonButton>
                  </>
                )}
              </>
            )}

            {task.id === 'nutribiotico' && (
              <>
                <div className="pill-hero">
                  <div className="pill-cap" />
                  <p>Dosis diaria del protocolo COPP-ADRESD</p>
                </div>
                <IonSegment value={nutriSlot} onIonChange={(e) => setNutriSlot(String(e.detail.value))}>
                  <IonSegmentButton value="manana">Mañana</IonSegmentButton>
                  <IonSegmentButton value="tarde">Tarde</IonSegmentButton>
                  <IonSegmentButton value="noche">Noche</IonSegmentButton>
                </IonSegment>
                {!program.nutribiotico && (
                  <IonButton
                    expand="block"
                    className="bt bt-gold"
                    style={{ marginTop: 14 }}
                    onClick={() => finish('nutribiotico', task.pts, 'Nutribiótico registrado · +80 pts')}
                  >
                    Ya lo tomé · +80 pts
                  </IonButton>
                )}
              </>
            )}

            {task.id === 'emocional' && (
              <>
                <p className="lesson-q">¿Cómo está tu ánimo ahora?</p>
                <div className="mood-row">
                  {MOODS.map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      className={`mood-face ${mood === m.v ? 'sel' : ''}`}
                      onClick={() => setMood(m.v)}
                    >
                      <span>{m.face}</span>
                      <small>{m.label}</small>
                    </button>
                  ))}
                </div>
                <p className="lesson-q">Energía de hoy</p>
                <IonSegment value={energy} onIonChange={(e) => setEnergy(String(e.detail.value ?? ''))}>
                  <IonSegmentButton value="baja">Baja</IonSegmentButton>
                  <IonSegmentButton value="media">Media</IonSegmentButton>
                  <IonSegmentButton value="alta">Alta</IonSegmentButton>
                </IonSegment>
                <IonTextarea
                  className="fld post-tx"
                  value={note}
                  placeholder="¿Algo que quieras registrar? (opcional)"
                  autoGrow
                  onIonInput={(e) => setNote(e.detail.value ?? '')}
                />
                {!program.emocional && (
                  <IonButton
                    expand="block"
                    className="bt bt-primary"
                    disabled={!mood || !energy}
                    onClick={() => finish('emocional', task.pts, 'Check-in emocional · +120 pts')}
                  >
                    Guardar evaluación · +120 pts
                  </IonButton>
                )}
              </>
            )}
          </div>
          </IonContent>
        )}
      </IonModal>

      <IonModal
        isOpen={celebrate}
        onDidDismiss={() => setCelebrate(false)}
        className="celebrate-modal"
      >
        <div className="celebrate-card">
          <AnimatePresence>
            {celebrate && (
              <motion.div
                className="celebrate-burst"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              >
                <div className="celebrate-ico">
                  <IonIcon icon={flame} />
                </div>
                <div className="display" style={{ fontSize: 22, fontWeight: 800 }}>
                  ¡Racha de {streak} días!
                </div>
                <p>
                  Completaste las 6 misiones de la semana {programWeek}. Mañana sigue el protocolo para no romper la racha.
                </p>
                <div className="celebrate-xp">+{pointsToday} pts hoy</div>
                <IonButton expand="block" className="bt bt-primary" onClick={() => setCelebrate(false)}>
                  Seguir
                </IonButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </IonModal>
    </Screen>
  )
}

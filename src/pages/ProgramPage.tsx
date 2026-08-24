import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
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
  pulse,
  star,
  trophy,
} from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import {
  CAL_DAY_LABELS,
  CIRCUIT_STEPS,
  DAY_BONUS_PTS,
  HEALTH_PILLARS,
  HEALTH_SCORE,
  LONGEST_STREAK,
  NEXT_CHEST_DAYS,
  PODCAST_EPISODE,
  PROGRAM_POINTS_MAX,
  PROGRAM_TASKS,
  PROGRAM_WEEKS,
  TRANSFORM_ROWS,
  TRANSFORM_SCORE,
  WEEK_LABELS,
  levelForXp,
} from '../data/program'
import type { ProgramTaskId } from '../types'
import { weekdayMondayIndex } from '../utils/dates'
import {
  EmotionalLesson,
  ExerciseLesson,
  NutribioticLesson,
  NutritionLesson,
  PodcastLesson,
  VitalsLesson,
  type ProgramTab,
} from './program/Lessons'

const TASK_ICONS: Record<ProgramTaskId, string> = {
  podcast: headset,
  vitals: pulse,
  nut: nutrition,
  ejercicio: barbell,
  nutribiotico: flask,
  emocional: happy,
}

const CONF_COLORS = ['var(--teal)', 'var(--ice)', 'var(--pur)', 'var(--org)', 'var(--blue)', 'var(--red)']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function buildMonthCells() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = now.getDate()
  const pad = new Date(y, m, 1).getDay()
  const last = new Date(y, m + 1, 0).getDate()
  const milestones = new Set([7, 11, 22])
  const cells: { d: number | null; kind: string }[] = []
  for (let i = 0; i < pad; i++) cells.push({ d: null, kind: 'empty' })
  for (let d = 1; d <= last; d++) {
    let kind = 'future'
    if (d < today) kind = d === 10 ? 'partial' : 'ok'
    else if (d === today) kind = 'today'
    if (milestones.has(d) && d <= today) kind += ' mile'
    cells.push({ d, kind })
  }
  return cells
}

export function ProgramPage() {
  const {
    program,
    completeStep,
    pointsToday,
    pointsTotal,
    navigate,
    showToast,
    mealsLogged,
    streak,
    programWeek,
    weekCheckins,
    user,
    watchConnected,
    connectWatch,
  } = useApp()

  const [tab, setTab] = useState<ProgramTab>('hoy')
  const [active, setActive] = useState<ProgramTaskId | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [xpPop, setXpPop] = useState<number | null>(null)
  const [confetti, setConfetti] = useState<{ id: number; left: number; delay: number; dur: number; color: string }[]>([])
  const [podPlaying, setPodPlaying] = useState(false)
  const [podProgress, setPodProgress] = useState(0)
  const [exRunning, setExRunning] = useState(false)
  const [exStep, setExStep] = useState(0)
  const [exLeft, setExLeft] = useState(CIRCUIT_STEPS[0].sec)
  const [nutriSlot, setNutriSlot] = useState('manana')
  const [takenAt, setTakenAt] = useState('')
  const prevAll = useRef(false)

  const doneCount = PROGRAM_TASKS.filter((t) => program[t.id]).length
  const allDone = doneCount === PROGRAM_TASKS.length
  const currentId = PROGRAM_TASKS.find((t) => !program[t.id])?.id
  const todayIdx = weekdayMondayIndex()
  const weekPct = programWeek / PROGRAM_WEEKS
  const task = useMemo(() => PROGRAM_TASKS.find((t) => t.id === active) ?? null, [active])
  const lvl = levelForXp(pointsTotal)
  const first = user.nombre.split(' ')[0]
  const cells = useMemo(buildMonthCells, [])
  const chestPct = Math.min(1, streak / NEXT_CHEST_DAYS)

  const burst = (pts: number, withConfetti = false) => {
    setXpPop(pts)
    window.setTimeout(() => setXpPop(null), 900)
    if (!withConfetti) return
    setConfetti(
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.3 + Math.random(),
        color: CONF_COLORS[i % CONF_COLORS.length],
      })),
    )
    window.setTimeout(() => setConfetti([]), 2400)
  }

  const finish = (id: ProgramTaskId, pts: number, msg: string) => {
    if (program[id]) return
    completeStep(id, pts)
    const willComplete = doneCount + 1 === PROGRAM_TASKS.length
    showToast(willComplete ? `${msg} · Bonus +${DAY_BONUS_PTS}` : msg, 'ok')
    burst(willComplete ? pts + DAY_BONUS_PTS : pts, willComplete)
    if (id === 'nutribiotico') {
      const n = new Date()
      setTakenAt(
        n.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit' }),
      )
    }
    setActive(null)
  }

  useEffect(() => {
    if (allDone && !prevAll.current) setCelebrate(true)
    prevAll.current = allDone
  }, [allDone])

  useEffect(() => {
    if (!podPlaying) return
    const id = window.setInterval(() => {
      setPodProgress((p) => {
        if (p >= 1) {
          window.clearInterval(id)
          setPodPlaying(false)
          return 1
        }
        return Math.min(1, p + 1 / 24)
      })
    }, 220)
    return () => window.clearInterval(id)
  }, [podPlaying])

  useEffect(() => {
    if (!exRunning) return
    const id = window.setInterval(() => setExLeft((s) => s - 1), 1000)
    return () => window.clearInterval(id)
  }, [exRunning])

  useEffect(() => {
    if (!exRunning || exLeft > 0) return
    if (exStep < CIRCUIT_STEPS.length - 1) {
      const next = exStep + 1
      setExStep(next)
      setExLeft(CIRCUIT_STEPS[next].sec)
      return
    }
    setExRunning(false)
    if (!program.ejercicio) {
      completeStep('ejercicio', 150)
      showToast('Circuito completado · +150 pts', 'ok')
      setXpPop(150)
      window.setTimeout(() => setXpPop(null), 900)
      setActive(null)
    }
  }, [exLeft, exRunning, exStep, program.ejercicio, completeStep, showToast])

  const skipStation = () => {
    if (program.ejercicio) return
    if (exStep >= CIRCUIT_STEPS.length - 1) {
      setExRunning(false)
      finish('ejercicio', 150, 'Circuito completado · +150 pts')
      return
    }
    const next = exStep + 1
    setExStep(next)
    setExLeft(CIRCUIT_STEPS[next].sec)
  }

  return (
    <Screen>
      <Scroll>
        <div className="hero hero-cosmos dash-hero">
          <div className="kicker">MI TRANSFORMACIÓN · COPP-ADRESD</div>
          <div className="h1">
            {greeting()}, {first}
          </div>
          <div className="sub">
            Semana {programWeek} de {PROGRAM_WEEKS} · Cada día cuenta
          </div>

          <div className="hero-pills">
            <div className={`hpill hpill-streak ${allDone ? 'hot' : ''}`}>
              <div className="hpill-ico">
                <IonIcon icon={flame} />
              </div>
              <div className="hpill-val">{streak}</div>
              <div className="hpill-lbl">Racha</div>
            </div>
            <div className="hpill hpill-xp">
              <div className="hpill-ico">
                <IonIcon icon={star} />
              </div>
              <div className="hpill-val">{pointsTotal.toLocaleString('es-ES')}</div>
              <div className="hpill-lbl">XP</div>
            </div>
            <div className="hpill hpill-hs">
              <div className="hpill-val">{HEALTH_SCORE}</div>
              <div className="hpill-lbl">Health</div>
            </div>
            <div className="hpill hpill-ts">
              <div className="hpill-val">+27%</div>
              <div className="hpill-lbl">Evolución</div>
            </div>
          </div>

          <div className="lvl-bar-wrap">
            <div className="lvl-row">
              <div className="lvl-name">
                Nivel {lvl.level} — {lvl.name}
              </div>
              <div className="lvl-xp">
                {pointsTotal.toLocaleString('es-ES')} / {lvl.max.toLocaleString('es-ES')} XP
              </div>
            </div>
            <IonProgressBar
              className="pb"
              value={lvl.pct}
              style={
                {
                  '--background': 'rgba(255,255,255,.12)',
                  '--progress-background': 'linear-gradient(90deg,var(--cyan),var(--ice))',
                } as CSSProperties
              }
            />
          </div>
        </div>

        <div className="duo-seg-wrap">
          <IonSegment value={tab} onIonChange={(e) => setTab((e.detail.value as ProgramTab) || 'hoy')}>
            <IonSegmentButton value="hoy">Hoy</IonSegmentButton>
            <IonSegmentButton value="racha">Racha</IonSegmentButton>
            <IonSegmentButton value="evo">Evolución</IonSegmentButton>
          </IonSegment>
        </div>

        {tab === 'hoy' && (
          <>
            <div className="today-hdr">
              <div>
                <div className="today-hdr-txt">Mi programa hoy</div>
                <div className="today-hdr-sub">
                  {allDone ? 'Día perfecto · racha protegida' : `Completa las 6 misiones · ${doneCount}/6`}
                </div>
              </div>
              <div className="today-pts">
                {pointsToday} / {PROGRAM_POINTS_MAX}
              </div>
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
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.06, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
                      <span className={`chip ${done ? 'chip-teal' : 'chip-gold'}`}>+{t.pts}</span>
                    </div>
                  </motion.div>
                )
              })}
              <div className={`duo-chest ${allDone ? 'open' : ''}`}>
                <div className="duo-chest-ico">
                  <IonIcon icon={trophy} />
                </div>
                <span>
                  {allDone
                    ? `Bonus del día +${DAY_BONUS_PTS} pts desbloqueado`
                    : 'Completa las 6 y sube la racha'}
                </span>
              </div>
            </div>

            <div className="stitle">Nutribiótico</div>
            <div className="nb-card">
              <div className="nb-title">{program.nutribiotico ? 'Dosis de hoy lista' : '¿Ya tomaste tu Nutribiótico?'}</div>
              <div className="nb-sub">
                {program.nutribiotico ? `Registrado a las ${takenAt || 'ahora'}` : 'Producto ADRED · dosis matutina'}
              </div>
              <div className="nb-streak">
                {WEEK_LABELS.map((d, i) => {
                  const ok = i === todayIdx ? program.nutribiotico : i < todayIdx
                  return (
                    <div key={d} className={`nb-day ${ok ? 'ok' : 'no'} ${i === todayIdx ? 'today' : ''}`}>
                      {d}
                    </div>
                  )
                })}
              </div>
              {!program.nutribiotico && (
                <IonButton expand="block" className="bt bt-teal" onClick={() => setActive('nutribiotico')}>
                  Registrar dosis
                </IonButton>
              )}
            </div>

            <div className="stitle">AI Health Coach</div>
            <div className="ai-wrap">
              <div className="ai-chip">ANÁLISIS SEMANAL · SEMANA {programWeek}</div>
              <div className="ai-bubble">
                {first}, tu <strong>adherencia nutricional subió de 67% a 84%</strong>. El índice de grasa varió +0.4% — hay una cosa que quiero revisar contigo.
              </div>
              <div className="ai-actions">
                <IonButton className="bt bt-ghost" onClick={() => setTab('evo')}>
                  Ver evolución
                </IonButton>
                <IonButton className="bt bt-primary" onClick={() => navigate('chat')}>
                  Hablar con IA
                </IonButton>
              </div>
            </div>
          </>
        )}

        {tab === 'racha' && (
          <div className="cpad">
            <div className="card">
              <div className="cal-head">
                <div>
                  <div className="cal-streak">
                    <IonIcon icon={flame} /> {streak} días
                  </div>
                  <div className="cs">Racha actual · Máxima: {LONGEST_STREAK} días</div>
                </div>
                <div className="cal-rescue">
                  <div className="cs">Protección</div>
                  <strong>1 rescate</strong>
                </div>
              </div>
              <div className="duo-week cal-week">
                {WEEK_LABELS.map((label, i) => (
                  <div key={label} className={`duo-day ${weekCheckins[i] ? 'done' : ''} ${i === todayIdx ? 'today' : ''}`}>
                    <span>{label}</span>
                    <b>{weekCheckins[i] ? '✓' : i === todayIdx ? '·' : ''}</b>
                  </div>
                ))}
              </div>
              <div className="cal-grid-lbls">
                {CAL_DAY_LABELS.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="cal-grid">
                {cells.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`cal-cell ${c.kind}`}
                    disabled={!c.d}
                    onClick={() => c.d && showToast(c.d < new Date().getDate() ? `Día ${c.d} completado` : 'Hoy · sigue la racha', 'info')}
                  >
                    {c.d ?? ''}
                  </button>
                ))}
              </div>
              <div className="cal-legend">
                <span>
                  <i className="cal-dot ok" /> Completo
                </span>
                <span>
                  <i className="cal-dot partial" /> Parcial
                </span>
                <span>
                  <i className="cal-dot miss" /> Futuro
                </span>
                <span>🏆 Hito</span>
              </div>
            </div>

            <div className="card chest-next">
              <div className="chest-next-row">
                <div className="chest-float">🎁</div>
                <div>
                  <div className="ct">Cofre de Permanencia</div>
                  <div className="cs">
                    {NEXT_CHEST_DAYS} días de racha · faltan {Math.max(0, NEXT_CHEST_DAYS - streak)}
                  </div>
                </div>
              </div>
              <IonProgressBar value={chestPct} className="pb" />
              <div className="chest-next-meta">
                {streak} de {NEXT_CHEST_DAYS} · +1,500 XP al abrir
              </div>
            </div>

            <div className="card">
              <div className="cs" style={{ marginBottom: 8 }}>
                Recorrido del protocolo · {programWeek}/{PROGRAM_WEEKS} semanas
              </div>
              <IonProgressBar value={weekPct} className="pb" />
            </div>
          </div>
        )}

        {tab === 'evo' && (
          <div className="cpad">
            <div className="card">
              <div className="hs-wrap">
                <div className="hs-ring">
                  <svg width="90" height="90" viewBox="0 0 90 90">
                    <circle cx="45" cy="45" r="35" fill="none" stroke="var(--g1)" strokeWidth="9" />
                    <circle
                      cx="45"
                      cy="45"
                      r="35"
                      fill="none"
                      stroke="var(--teal)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray="219.9"
                      strokeDashoffset={219.9 * (1 - HEALTH_SCORE / 100)}
                      transform="rotate(-90 45 45)"
                    />
                  </svg>
                  <div className="hs-center">
                    <div className="hs-val">{HEALTH_SCORE}</div>
                    <div className="hs-lbl">Health</div>
                  </div>
                </div>
                <div className="hs-bars">
                  {HEALTH_PILLARS.map((p) => (
                    <div key={p.label} className="hs-bar-row">
                      <div className="hs-bar-top">
                        <span>{p.label}</span>
                        <span>{p.pct}%</span>
                      </div>
                      <div className="hs-bar-track">
                        <div className="hs-bar-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hs-kpis">
                <div>
                  <span>Anterior</span>
                  <b>81</b>
                </div>
                <div>
                  <span>Cambio</span>
                  <b className="up">+5</b>
                </div>
                <div>
                  <span>Meta</span>
                  <b>90</b>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="tf-head">
                <div>
                  <div className="ct">Transformation Score</div>
                  <div className="cs">Desde tu línea base · día 0</div>
                </div>
                <div className="tf-score">{TRANSFORM_SCORE}</div>
              </div>
              {TRANSFORM_ROWS.map((r) => (
                <div key={r.label} className="tf-row">
                  <div className="tf-lbl">{r.label}</div>
                  <div className="tf-base">{r.base}</div>
                  <div className="tf-cur">{r.cur}</div>
                  <div className="tf-delta">{r.delta}</div>
                </div>
              ))}
            </div>

            <div className="wk-card wk-amber">
              <div>
                <div className="wk-title">Índice de grasa: tendencia a vigilar</div>
                <div className="wk-sub">+0.4% esta semana. La IA sugiere revisar proteínas con tu nutricionista.</div>
                <IonButton className="bt bt-gold" onClick={() => navigate('book')}>
                  Ver cita
                </IonButton>
              </div>
            </div>
          </div>
        )}
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
                    {task.emoji} Misión · +{task.pts} pts
                  </div>
                  <h2>{task.title}</h2>
                  <p>{task.hint}</p>
                </div>
                <IonButton fill="clear" aria-label="Cerrar" onClick={() => setActive(null)}>
                  <IonIcon slot="icon-only" icon={close} />
                </IonButton>
              </div>
              {program[task.id] && <div className="lesson-done-banner">Completada hoy · +{task.pts} pts</div>}

              {task.id === 'podcast' && (
                <PodcastLesson
                  done={program.podcast}
                  pts={task.pts}
                  playing={podPlaying}
                  progress={podProgress}
                  onToggle={() => setPodPlaying((v) => !v)}
                  onSkip={(d) => setPodProgress((p) => Math.min(1, Math.max(0, p + d / PODCAST_EPISODE.durationSec)))}
                  onComplete={() => finish('podcast', task.pts, 'Podcast escuchado · +80 pts')}
                />
              )}
              {task.id === 'vitals' && (
                <VitalsLesson
                  done={program.vitals}
                  pts={task.pts}
                  watchConnected={watchConnected}
                  onConnectWatch={() => {
                    connectWatch('ANTARES Watch Pro')
                    showToast('Reloj listo para sincronizar', 'ok')
                  }}
                  onComplete={() => finish('vitals', task.pts, '+120 pts por signos vitales')}
                />
              )}
              {task.id === 'nut' && (
                <NutritionLesson
                  done={program.nut}
                  pts={task.pts}
                  mealsLogged={mealsLogged}
                  onGoPlan={() => {
                    setActive(null)
                    navigate('nut')
                  }}
                  onComplete={() => finish('nut', task.pts, '+150 pts nutrición')}
                />
              )}
              {task.id === 'ejercicio' && (
                <ExerciseLesson
                  done={program.ejercicio}
                  pts={task.pts}
                  step={exStep}
                  left={Math.max(0, exLeft)}
                  running={exRunning}
                  onToggle={() => setExRunning((r) => !r)}
                  onSkip={skipStation}
                  onComplete={() => finish('ejercicio', task.pts, 'Ejercicio del día · +150 pts')}
                />
              )}
              {task.id === 'nutribiotico' && (
                <NutribioticLesson
                  done={program.nutribiotico}
                  pts={task.pts}
                  takenAt={takenAt}
                  slot={nutriSlot}
                  onSlot={setNutriSlot}
                  onComplete={() => finish('nutribiotico', task.pts, 'Nutribiótico registrado · +80 pts')}
                />
              )}
              {task.id === 'emocional' && (
                <EmotionalLesson
                  done={program.emocional}
                  pts={task.pts}
                  onComplete={({ barrier }) => {
                    finish('emocional', task.pts, 'Check-in emocional · +120 pts')
                    if (barrier) showToast('IA: registro enviado a tu equipo', 'info')
                  }}
                />
              )}
            </div>
          </IonContent>
        )}
      </IonModal>

      <IonModal isOpen={celebrate} onDidDismiss={() => setCelebrate(false)} className="celebrate-modal">
        <div className="celebrate-card ms-card-wrap">
          <AnimatePresence>
            {celebrate && (
              <motion.div
                className="celebrate-burst"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 16 }}
              >
                <div className="celebrate-ico">
                  <IonIcon icon={flame} />
                </div>
                <div className="display" style={{ fontSize: 24, fontWeight: 800 }}>
                  ¡{streak} DÍAS!
                </div>
                <p>Cofre del día abierto. Mañana sigue el protocolo para no romper la racha.</p>
                <div className="ms-mini">
                  <div>
                    <b>+{pointsToday}</b>
                    <span>pts hoy</span>
                  </div>
                  <div>
                    <b>x2 · 24h</b>
                    <span>próximo hito</span>
                  </div>
                </div>
                <div className="ms-evo-mini">
                  {TRANSFORM_ROWS.slice(0, 4).map((r) => (
                    <div key={r.label}>
                      <span>{r.label}</span>
                      <strong>{r.delta}</strong>
                    </div>
                  ))}
                </div>
                <IonButton expand="block" className="bt bt-primary" onClick={() => setCelebrate(false)}>
                  Seguir transformándome
                </IonButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </IonModal>

      {xpPop !== null && <div className="xp-pop">+{xpPop} pts</div>}
      {confetti.map((c) => (
        <span
          key={c.id}
          className="conf-p"
          style={
            {
              left: `${c.left}%`,
              background: c.color,
              '--d': `${c.dur}s`,
              '--dl': `${c.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </Screen>
  )
}

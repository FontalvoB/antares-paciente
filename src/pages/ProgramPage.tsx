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
import { close, flame, star } from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import {
  CIRCUIT_STEPS,
  DAY_BONUS_PTS,
  HEALTH_SCORE,
  NEXT_CHEST_DAYS,
  PODCAST_EPISODE,
  PROGRAM_TASKS,
  PROGRAM_WEEKS,
  TRANSFORM_ROWS,
  levelForXp,
} from '../data/program'
import type { ProgramTaskId } from '../types'
import { weekdayMondayIndex } from '../utils/dates'
import { EvolutionView } from './program/EvolutionView'
import {
  EmotionalLesson,
  ExerciseLesson,
  NutribioticLesson,
  NutritionLesson,
  PodcastLesson,
  VitalsLesson,
  type ProgramTab,
} from './program/Lessons'
import { StreakView } from './program/StreakView'
import { TodayView } from './program/TodayView'
import { paneMotion } from './program/ui'

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
            <button
              type="button"
              className={`hpill hpill-streak ${allDone ? 'hot' : ''}`}
              onClick={() => setTab('racha')}
              aria-label={`Ver racha de ${streak} días`}
            >
              <div className="hpill-ico">
                <IonIcon icon={flame} />
              </div>
              <div className="hpill-val">{streak}</div>
              <div className="hpill-lbl">Racha</div>
            </button>
            <div className="hpill hpill-xp">
              <div className="hpill-ico">
                <IonIcon icon={star} />
              </div>
              <div className="hpill-val">{pointsTotal.toLocaleString('es-ES')}</div>
              <div className="hpill-lbl">XP</div>
            </div>
            <button type="button" className="hpill hpill-hs" onClick={() => setTab('evo')} aria-label="Ver Health Score">
              <div className="hpill-val">{HEALTH_SCORE}</div>
              <div className="hpill-lbl">Health</div>
            </button>
            <button type="button" className="hpill hpill-ts" onClick={() => setTab('evo')} aria-label="Ver evolución">
              <div className="hpill-val">+27%</div>
              <div className="hpill-lbl">Evolución</div>
            </button>
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

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} {...paneMotion}>
            {tab === 'hoy' && (
              <TodayView
                program={program}
                doneCount={doneCount}
                allDone={allDone}
                currentId={currentId}
                pointsToday={pointsToday}
                first={first}
                programWeek={programWeek}
                todayIdx={todayIdx}
                takenAt={takenAt}
                onOpenTask={setActive}
                onGoEvo={() => setTab('evo')}
                onGoChat={() => navigate('chat')}
              />
            )}
            {tab === 'racha' && (
              <StreakView
                streak={streak}
                weekCheckins={weekCheckins}
                todayIdx={todayIdx}
                cells={cells}
                chestPct={chestPct}
                weekPct={weekPct}
                programWeek={programWeek}
                onCell={(day, past) =>
                  showToast(past ? `Día ${day} completado` : 'Hoy · sigue la racha', 'info')
                }
              />
            )}
            {tab === 'evo' && <EvolutionView onGoBook={() => navigate('book')} />}
          </motion.div>
        </AnimatePresence>
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

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react'
import { AnimatePresence, motion } from 'framer-motion'
import { close, flame, gift, refresh } from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'
import {
  CIRCUIT_STEPS,
  DAY_BONUS_PTS,
  HEALTH_SCORE,
  LONGEST_STREAK,
  PODCAST_EPISODE,
  PROGRAM_LEVELS,
  PROGRAM_TASKS,
  PROGRAM_WEEKS,
  TRANSFORM_ROWS,
  levelForXp,
} from '../data/program'
import { USER_STATE, userRank } from '../data/rankings'
import type { ProgramDay, ProgramTaskId } from '../types'
import { weekdayMondayIndex } from '../utils/dates'
import { deriveLoggedMeals } from '../utils/nutritionProgress'
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
import { RankingView } from './program/RankingView'
import { StreakView } from './program/StreakView'
import { TodayView } from './program/TodayView'
import { TransformHero } from './program/TransformHero'
import { paneMotion } from './program/ui'
import { useClinicalChests } from '../hooks/useClinicalChests'
import { useProgram } from '../hooks/useProgram'
import { useStreakChests } from '../hooks/useStreakChests'
import { useCompleteTask, type CelebrateInfo } from '../hooks/useCompleteTask'
import { useProgramScores } from '../hooks/useProgramScores'
import { useProgramCalendar } from '../hooks/useProgramCalendar'
import type { CalendarDayDetailDto, TaskCode, VitalsPayload } from '../services/program/types'

const CONF_COLORS = ['var(--teal)', 'var(--ice)', 'var(--pur)', 'var(--org)', 'var(--blue)', 'var(--red)']

function greeting(t: (s: string) => string) {
  const h = new Date().getHours()
  if (h < 12) return t('Buenos días')
  if (h < 19) return t('Buenas tardes')
  return t('Buenas noches')
}

function buildMonthCells(calendarDays?: CalendarDayDetailDto[]) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = now.getDate()
  const pad = new Date(y, m, 1).getDay()
  const last = new Date(y, m + 1, 0).getDate()
  const milestones = new Set([7, 11, 22])

  const dayMap = new Map<number, CalendarDayDetailDto>()
  if (calendarDays) {
    for (const d of calendarDays) {
      const parts = d.localDate.split('-')
      if (parts.length === 3) {
        const dayNum = parseInt(parts[2], 10)
        dayMap.set(dayNum, d)
      }
    }
  }

  const cells: { d: number | null; kind: string }[] = []
  for (let i = 0; i < pad; i++) cells.push({ d: null, kind: 'empty' })
  for (let d = 1; d <= last; d++) {
    let kind = 'future'
    const calDay = dayMap.get(d)
    if (calDay) {
      if (calDay.isPerfectDay) kind = 'ok'
      else if (calDay.points > 0) kind = 'partial'
      else if (d < today) kind = 'partial'
    } else if (d < today) {
      kind = d === 10 ? 'partial' : 'ok'
    } else if (d === today) {
      kind = 'today'
    }
    if (d === today && !kind.includes('today')) kind += ' today'
    if (milestones.has(d) && d <= today) kind += ' mile'
    cells.push({ d, kind })
  }
  return cells
}

export function ProgramPage() {
  const {
    program: appProgram,
    completeStep,
    pointsToday: appPointsToday,
    pointsTotal: appPointsTotal,
    navigate,
    showToast,
    streak: appStreak,
    programWeek: appProgramWeek,
    weekCheckins,
    user,
    watchConnected,
    connectWatch,
  } = useApp()

  const t = useT()
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
  const [openedChest, setOpenedChest] = useState<{ title: string; xp: number } | null>(null)
  const prevAll = useRef(false)

  // --- Program Hooks ---
  const {
    snapshot,
    programState,
    productMessage,
    refetch: refetchProgram,
  } = useProgram()

  const completeTaskMutation = useCompleteTask()
  const { scores, stale: scoresStale } = useProgramScores()
  // Chest trail from server truth (catalog defs + ledger grants); falls back
  // to static defs when the backend field is absent (chests module, T8).
  const { chests } = useStreakChests()

  // S4: comidas registradas hoy desde la verdad server-side del snapshot
  // (nutritionIntakeLogs + capa optimista del cache). Reemplaza el consumo
  // de AppContext.mealsLogged en flujos conectados (sin shim).
  const serverLoggedMeals = useMemo(() => deriveLoggedMeals(snapshot), [snapshot])

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data: calendarData } = useProgramCalendar(monthStart, monthEnd)

  // Derived states from server snapshot with seamless fallback to AppContext/constants
  const program: ProgramDay = useMemo(() => {
    if (snapshot?.todayTasks && snapshot.todayTasks.length > 0) {
      const taskMap: Record<string, boolean> = {}
      for (const task of snapshot.todayTasks) {
        taskMap[task.taskCode] = task.status === 'Completed'
      }
      return {
        podcast: Boolean(taskMap.podcast),
        vitals: Boolean(taskMap.vitals),
        nut: Boolean(taskMap.nut),
        ejercicio: Boolean(taskMap.ejercicio),
        nutribiotico: Boolean(taskMap.nutribiotico),
        emocional: Boolean(taskMap.emocional),
      }
    }
    return appProgram
  }, [snapshot, appProgram])

  const activeStreak = snapshot?.streak?.current ?? appStreak
  const activeStreakLongest = snapshot?.streak?.longest ?? LONGEST_STREAK
  const activeFreezes = snapshot?.streak?.freezesRemaining ?? 0
  const activePointsTotal = snapshot?.xp?.balance ?? appPointsTotal
  const activePointsToday = snapshot?.todayPoints ?? appPointsToday
  const activeProgramWeek = snapshot?.template?.currentWeekNumber ?? appProgramWeek
  const activeTotalWeeks = snapshot?.template?.totalWeeks ?? PROGRAM_WEEKS
  const weekPct = activeTotalWeeks > 0 ? activeProgramWeek / activeTotalWeeks : 0
  const activeHealthScore = scores?.healthScore?.score ?? HEALTH_SCORE

  const activeWeekCheckins = useMemo(() => {
    if (snapshot?.calendar && Array.isArray(snapshot.calendar) && snapshot.calendar.length > 0) {
      return (snapshot.calendar as Array<{ status: string; weekday: number }>).map((c) => c.status === 'Completed')
    }
    return weekCheckins
  }, [snapshot, weekCheckins])

  const doneCount = PROGRAM_TASKS.filter((pt) => program[pt.id]).length
  const allDone = doneCount === PROGRAM_TASKS.length
  const currentId = PROGRAM_TASKS.find((pt) => !program[pt.id])?.id
  const todayIdx = weekdayMondayIndex()
  const task = useMemo(() => PROGRAM_TASKS.find((pt) => pt.id === active) ?? null, [active])
  const serverActiveTask = useMemo(
    () => snapshot?.todayTasks?.find((t) => t.taskCode === active) ?? null,
    [snapshot, active],
  )
  const taskTitle = serverActiveTask?.title || (task ? t(task.title) : '')
  const taskHint = serverActiveTask?.short || (task ? t(task.hint) : '')
  const taskPts = serverActiveTask?.points ?? task?.pts ?? 0

  // XP & Levels
  const lvl = levelForXp(activePointsTotal)
  const serverLevelName = snapshot?.xp?.level
  const activeLevelName = serverLevelName || lvl.name
  const activeNextLevelAt = snapshot?.xp?.nextLevelAt
  const activeXpToNext = activeNextLevelAt
    ? Math.max(0, activeNextLevelAt - activePointsTotal)
    : (PROGRAM_LEVELS[lvl.idx + 1] ? Math.max(0, PROGRAM_LEVELS[lvl.idx + 1].min - activePointsTotal) : 0)
  const activeLevelPct = activeNextLevelAt && activeNextLevelAt > 0
    ? Math.min(1, Math.max(0, activePointsTotal / activeNextLevelAt))
    : lvl.pct
  const activeLevel = lvl.level
  const nextLv = PROGRAM_LEVELS[lvl.idx + 1]
  const activeNextLevelName = nextLv?.name ?? activeLevelName

  const first = user.nombre.split(' ')[0]
  const cells = useMemo(() => buildMonthCells(calendarData?.days), [calendarData])
  // Read-only clinical chest progress from real scores (chests module, T9).
  const clinicalChests = useClinicalChests(scores, activeProgramWeek)
  const liga = userRank('racha')

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

  // Listen to custom celebration events from useCompleteTask
  useEffect(() => {
    const handleCelebrate = (e: Event) => {
      const detail = (e as CustomEvent<CelebrateInfo>).detail
      if (detail?.xpEstimate) {
        burst(detail.xpEstimate, true)
      }
    }
    window.addEventListener('program:task-celebrated', handleCelebrate)
    return () => window.removeEventListener('program:task-celebrated', handleCelebrate)
  }, [])

  // Chest auto-open celebration (chests module, R3.2): a newly granted chest
  // (server truth diffed in useProgram) opens the chest modal + confetti. The
  // XP was already granted server-side; this is presentation only.
  useEffect(() => {
    const handleChestGranted = (e: Event) => {
      const detail = (e as CustomEvent<{ days: number; xp: number }>).detail
      if (!detail) return
      setOpenedChest({
        title: t('Cofre de {days} días', { days: String(detail.days) }),
        xp: detail.xp,
      })
      burst(detail.xp, true)
    }
    window.addEventListener('program:chest-granted', handleChestGranted)
    return () => window.removeEventListener('program:chest-granted', handleChestGranted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = useCallback(
    (
      id: ProgramTaskId,
      pts: number,
      msg: string,
      extra?: { moodScore?: number; barriers?: string; vitals?: VitalsPayload | null },
    ) => {
      if (program[id]) return

      // Trigger backend mutation
      completeTaskMutation.completeTask({
        taskCode: id as TaskCode,
        moodScore: extra?.moodScore,
        barriers: extra?.barriers,
        vitals: extra?.vitals,
      })

      // Also update local AppContext for fallback continuity
      completeStep(id, pts)

      const willComplete = doneCount + 1 === PROGRAM_TASKS.length
      showToast(willComplete ? `${msg} · ${t('Bonus +{pts}', { pts: String(DAY_BONUS_PTS) })}` : msg, 'ok')
      burst(willComplete ? pts + DAY_BONUS_PTS : pts, willComplete)
      if (id === 'nutribiotico') {
        const n = new Date()
        setTakenAt(
          n.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit' }),
        )
      }
      setActive(null)
    },
    [program, completeTaskMutation, completeStep, doneCount, showToast, t],
  )

  const exContent = snapshot?.todayTasks?.find((t) => t.taskCode === 'ejercicio')?.content
  const activeExerciseSteps = useMemo(() => {
    if (exContent?.exercises && exContent.exercises.length > 0) {
      return exContent.exercises.map((ex) => ({
        name: ex.name,
        sec: ex.durationSecs || (ex.restSeconds ? ex.restSeconds * (ex.sets || 1) : 45),
        cue: [
          ex.sets && ex.repetitions ? `${ex.sets} series x ${ex.repetitions} reps` : ex.sets ? `${ex.sets} series` : '',
          ex.description,
          ex.tips,
        ].filter(Boolean).join(' · ') || 'Ejecuta con buena postura',
      }))
    }
    return CIRCUIT_STEPS
  }, [exContent])

  const skipStation = () => {
    if (program.ejercicio) return
    if (exStep >= activeExerciseSteps.length - 1) {
      setExRunning(false)
      finish('ejercicio', taskPts || 150, t('Circuito completado · +{pts} pts', { pts: String(taskPts || 150) }))
      return
    }
    const next = exStep + 1
    setExStep(next)
    setExLeft(activeExerciseSteps[next]?.sec || 45)
  }

  useEffect(() => {
    if (!allDone && !prevAll.current) setCelebrate(true)
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
    if (exStep < activeExerciseSteps.length - 1) {
      const next = exStep + 1
      setExStep(next)
      setExLeft(activeExerciseSteps[next]?.sec || 45)
      return
    }
    setExRunning(false)
    if (!program.ejercicio) {
      finish('ejercicio', taskPts || 150, t('Circuito completado · +{pts} pts', { pts: String(taskPts || 150) }))
    }
  }, [exLeft, exRunning, exStep, program.ejercicio, finish, t, activeExerciseSteps, taskPts])

  return (
    <Screen>
      <Scroll>
        {productMessage && (
          <div
            className="card"
            style={{
              margin: '12px 16px',
              borderLeft: '4px solid var(--org)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{productMessage}</p>
            {programState === 'recoverable' && (
              <IonButton
                size="small"
                fill="outline"
                onClick={() => refetchProgram()}
                style={{ marginLeft: 8 }}
              >
                <IonIcon icon={refresh} slot="start" />
                {t('Reintentar')}
              </IonButton>
            )}
          </div>
        )}

        <TransformHero
          greeting={greeting(t)}
          first={first}
          programWeek={activeProgramWeek}
          programWeeks={activeTotalWeeks}
          level={activeLevel}
          levelName={activeLevelName}
          levelPct={activeLevelPct}
          pointsTotal={activePointsTotal}
          xpToNext={activeXpToNext}
          nextLevelName={activeNextLevelName}
          streak={activeStreak}
          healthScore={activeHealthScore}
          stateRank={liga.rank}
          stateName={USER_STATE}
          // Chests are auto-granted server-side now: nothing sits in a
          // "ready to claim" state anymore (chests module, R3.2).
          readyChests={0}
          allDone={allDone}
          onOpenStreak={() => setTab('racha')}
          onOpenEvo={() => setTab('evo')}
          onOpenLiga={() => setTab('liga')}
          onOpenChests={() => setTab('racha')}
        />

        <div className="duo-seg-wrap tabs-4">
          <IonSegment value={tab} onIonChange={(e) => setTab((e.detail.value as ProgramTab) || 'hoy')}>
            <IonSegmentButton value="hoy">{t('Hoy')}</IonSegmentButton>
            <IonSegmentButton value="racha">{t('Racha')}</IonSegmentButton>
            <IonSegmentButton value="liga">{t('Liga')}</IonSegmentButton>
            <IonSegmentButton value="evo">{t('Evo')}</IonSegmentButton>
          </IonSegment>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} {...paneMotion}>
            {tab === 'hoy' && (
              <TodayView
                program={program}
                todayTasks={snapshot?.todayTasks}
                pointsTodayMax={snapshot?.todayPointsMax}
                doneCount={doneCount}
                allDone={allDone}
                currentId={currentId}
                pointsToday={activePointsToday}
                first={first}
                programWeek={activeProgramWeek}
                todayIdx={todayIdx}
                takenAt={takenAt}
                onOpenTask={setActive}
                onGoEvo={() => setTab('evo')}
                onGoChat={() => navigate('chat')}
                onGoChests={() => setTab('racha')}
                readyChests={0}
                readyXp={0}
              />
            )}
            {tab === 'racha' && (
              <StreakView
                streak={activeStreak}
                longestStreak={activeStreakLongest}
                freezesRemaining={activeFreezes}
                weekCheckins={activeWeekCheckins}
                todayIdx={todayIdx}
                cells={cells}
                weekPct={weekPct}
                programWeek={activeProgramWeek}
                programWeeks={activeTotalWeeks}
                chests={chests}
                clinicalChests={clinicalChests}
                nbStreak={snapshot?.streak?.nbStreak ?? 0}
                nbNextMilestone={snapshot?.streak?.nbNextMilestone ?? null}
              />
            )}
            {tab === 'liga' && (
              <RankingView
                user={{
                  name: user.nombre,
                  streak: activeStreak,
                  evo: scores?.transformation_score?.current ?? scores?.transformationScore?.current ?? scores?.transformationScore?.score ?? 27,
                  adh: scores?.health_score?.dimensions?.adherence ?? scores?.healthScore?.dimensions?.adherence ?? 88,
                  rec: scores?.health_score?.dimensions?.clinical ?? scores?.healthScore?.dimensions?.clinical ?? 74,
                  city: user.ciudad || 'Miami',
                }}
              />
            )}
            {tab === 'evo' && (
              <EvolutionView
                scores={scores}
                stale={scoresStale}
                onGoBook={() => navigate('book')}
              />
            )}
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
                    {task.emoji} {t('Misión · +{pts} pts', { pts: String(taskPts) })}
                  </div>
                  <h2>{t(taskTitle)}</h2>
                  <p>{t(taskHint)}</p>
                </div>
                <IonButton fill="clear" aria-label={t('Cerrar')} onClick={() => setActive(null)}>
                  <IonIcon slot="icon-only" icon={close} />
                </IonButton>
              </div>
              {program[task.id] && <div className="lesson-done-banner">{t('Completada hoy · +{pts} pts', { pts: String(taskPts) })}</div>}

              {task.id === 'podcast' && (
                <PodcastLesson
                  done={program.podcast}
                  pts={taskPts}
                  title={serverActiveTask?.content?.title}
                  author={serverActiveTask?.content?.author}
                  description={serverActiveTask?.content?.description}
                  durationSecs={serverActiveTask?.content?.durationSecs}
                  chapters={serverActiveTask?.content?.chapters}
                  takeaways={serverActiveTask?.content?.takeaways}
                  playing={podPlaying}
                  progress={podProgress}
                  onToggle={() => setPodPlaying((v) => !v)}
                  onSkip={(d) => setPodProgress((p) => Math.min(1, Math.max(0, p + d / (serverActiveTask?.content?.durationSecs || PODCAST_EPISODE.durationSec))))}
                  onComplete={() => finish('podcast', taskPts, t('Podcast escuchado · +{pts} pts', { pts: String(taskPts) }))}
                />
              )}
              {task.id === 'vitals' && (
                <VitalsLesson
                  done={program.vitals}
                  pts={taskPts}
                  recentVitals={serverActiveTask?.content?.recentVitals}
                  watchConnected={watchConnected}
                  onConnectWatch={() => {
                    connectWatch('ANTARES Watch Pro')
                    showToast(t('Reloj listo para sincronizar'), 'ok')
                  }}
                  onComplete={(vitals) => finish('vitals', taskPts, t('+{pts} pts por signos vitales', { pts: String(taskPts) }), { vitals })}
                />
              )}
              {task.id === 'nut' && (
                <NutritionLesson
                  done={program.nut}
                  pts={taskPts}
                  title={serverActiveTask?.content?.nutritionPlanName || serverActiveTask?.content?.title || undefined}
                  dailyCalorieTarget={serverActiveTask?.content?.dailyCalorieTarget}
                  dailyProteinTarget={serverActiveTask?.content?.dailyProteinTarget}
                  dailyCarbsTarget={serverActiveTask?.content?.dailyCarbsTarget}
                  dailyFatTarget={serverActiveTask?.content?.dailyFatTarget}
                  dailyFiberTarget={serverActiveTask?.content?.dailyFiberTarget}
                  nutritionMeals={serverActiveTask?.content?.nutritionMeals}
                  mealsLogged={serverLoggedMeals}
                  onGoPlan={() => {
                    setActive(null)
                    navigate('nut')
                  }}
                  onComplete={() => finish('nut', taskPts, t('+{pts} pts nutrición', { pts: String(taskPts) }))}
                />
              )}
              {task.id === 'ejercicio' && (
                <ExerciseLesson
                  done={program.ejercicio}
                  pts={taskPts}
                  title={serverActiveTask?.content?.exerciseRoutineName || serverActiveTask?.content?.title || undefined}
                  exercises={serverActiveTask?.content?.exercises}
                  step={exStep}
                  left={Math.max(0, exLeft)}
                  running={exRunning}
                  onToggle={() => setExRunning((r) => !r)}
                  onSkip={skipStation}
                  onComplete={() => finish('ejercicio', taskPts, t('Ejercicio del día · +{pts} pts', { pts: String(taskPts) }))}
                />
              )}
              {task.id === 'nutribiotico' && (
                <NutribioticLesson
                  done={program.nutribiotico}
                  pts={taskPts}
                  takenAt={takenAt}
                  slot={nutriSlot}
                  nbWeekDays={snapshot?.streak?.nbWeekDays}
                  onSlot={setNutriSlot}
                  onComplete={() => finish('nutribiotico', taskPts, t('Nutribiótico registrado · +{pts} pts', { pts: String(taskPts) }))}
                />
              )}
              {task.id === 'emocional' && (
                <EmotionalLesson
                  done={program.emocional}
                  pts={taskPts}
                  onComplete={({ mood, barrier }) => {
                    finish('emocional', taskPts, t('Check-in emocional · +{pts} pts', { pts: String(taskPts) }), {
                      moodScore: parseInt(mood, 10) || 3,
                      barriers: barrier,
                    })
                    if (barrier) showToast(t('IA: registro enviado a tu equipo'), 'info')
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
                  {t('¡{streak} DÍAS!', { streak: String(activeStreak) })}
                </div>
                <p>{t('Cofre del día abierto. Mañana sigue el protocolo para no romper la racha.')}</p>
                <div className="ms-mini">
                  <div>
                    <b>+{activePointsToday}</b>
                    <span>{t('pts hoy')}</span>
                  </div>
                  <div>
                    <b>x2 · 24h</b>
                    <span>{t('próximo hito')}</span>
                  </div>
                </div>
                <div className="ms-evo-mini">
                  {TRANSFORM_ROWS.slice(0, 4).map((r) => (
                    <div key={r.label}>
                      <span>{t(r.label)}</span>
                      <strong>{r.delta}</strong>
                    </div>
                  ))}
                </div>
                <IonButton expand="block" className="bt bt-primary" onClick={() => setCelebrate(false)}>
                  {t('Seguir transformándome')}
                </IonButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </IonModal>

      <IonModal isOpen={!!openedChest} onDidDismiss={() => setOpenedChest(null)} className="celebrate-modal">
        <div className="celebrate-card ms-card-wrap">
          <AnimatePresence>
            {openedChest && (
              <motion.div
                className="celebrate-burst cx-open"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 16 }}
              >
                <div className="cx-open-ico">
                  <IonIcon icon={gift} />
                </div>
                <div className="display" style={{ fontSize: 22, fontWeight: 800 }}>
                  {t(openedChest.title)}
                </div>
                <p>{t('El cofre se abrió. La experiencia ya está en tu nivel.')}</p>
                <div className="cx-open-xp">+{openedChest.xp.toLocaleString('es-ES')} XP</div>
                <IonButton expand="block" className="bt bt-primary" onClick={() => setOpenedChest(null)}>
                  {t('Seguir transformándome')}
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

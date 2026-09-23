import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { IonButton, IonContent, IonIcon, IonModal } from "@ionic/react";
import { AnimatePresence, motion } from "framer-motion";
import { close, flame, gift, refresh } from "ionicons/icons";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import {
  DAY_BONUS_PTS,
  PROGRAM_POINTS_MAX,
  PROGRAM_TASKS,
  PROGRAM_WEEKS,
} from "../data/program";
import type { ProgramDay, ProgramTaskId } from "../types";
import { weekdayMondayIndex } from "../utils/dates";
import { deriveLoggedMeals } from "../utils/nutritionProgress";
import { buildMonthCells } from "../utils/monthCells";
import {
  emptyWeekCells,
  mapWeekCheckins,
  weekTodayIndex,
} from "../utils/weekStrip";
import { EvolutionView } from "./program/EvolutionView";
import {
  EmotionalLesson,
  ExerciseLesson,
  NutraceuticLesson,
  NutritionLesson,
  PodcastLesson,
  VitalsLesson,
  type ProgramTab,
} from "./program/Lessons";
import { ProgramHeader } from "./program/ProgramHeader";
import { RankingView } from "./program/RankingView";
import { StreakView } from "./program/StreakView";
import { TodayView } from "./program/TodayView";
import { paneMotion } from "./program/ui";
import { useClinicalChests } from "../hooks/useClinicalChests";
import { useProgram } from "../hooks/useProgram";
import { useStreakChests } from "../hooks/useStreakChests";
import { useCompleteTask } from "../hooks/useCompleteTask";
import { useProgramScores } from "../hooks/useProgramScores";
import { useProgramCalendar } from "../hooks/useProgramCalendar";
import { resolveStationSec } from "../utils/exerciseSteps";
import type { TaskCode, VitalsPayload } from "../services/program/types";

const CONF_COLORS = [
  "var(--teal)",
  "var(--ice)",
  "var(--pur)",
  "var(--org)",
  "var(--blue)",
  "var(--red)",
];

export function ProgramPage() {
  const {
    program: appProgram,
    completeStep,
    pointsToday: appPointsToday,
    navigate,
    showToast,
    streak: appStreak,
    programWeek: appProgramWeek,
    weekCheckins,
    user,
    wearableConnected,
    connectWearable,
  } = useApp();

  const t = useT();
  const [tab, setTab] = useState<ProgramTab>("hoy");
  const [active, setActive] = useState<ProgramTaskId | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [xpPop, setXpPop] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; delay: number; dur: number; color: string }[]
  >([]);
  const [podPlaying, setPodPlaying] = useState(false);
  const [podProgress, setPodProgress] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [exRunning, setExRunning] = useState(false);
  const [exStep, setExStep] = useState(0);
  const [exLeft, setExLeft] = useState(45);
  const [nutriSlot, setNutriSlot] = useState("manana");
  const [takenAt, setTakenAt] = useState("");
  const [openedChest, setOpenedChest] = useState<{
    title: string;
    xp: number;
  } | null>(null);
  // Baseline null (patrón chest-granted): el primer snapshot SOLO calibra;
  // la celebración del cofre del día dispara en la transición no-completo →
  // completo. Con el ref en false, el efecto invertido celebraba al ENTRAR
  // con el día sin terminar ("¡0 DÍAS!" al abrir el Protocolo).
  const prevAll = useRef<boolean | null>(null);

  // --- Program Hooks ---
  const {
    snapshot,
    programState,
    productMessage,
    refetch: refetchProgram,
  } = useProgram();

  const completeTaskMutation = useCompleteTask();
  const {
    scores,
    stale: scoresStale,
    isLoading: scoresLoading,
    isError: scoresError,
    refetch: refetchScores,
  } = useProgramScores();
  // Chest trail from server truth (catalog defs + ledger grants); falls back
  // to static defs when the backend field is absent (chests module, T8).
  const { chests } = useStreakChests();

  // S4: comidas registradas hoy desde la verdad server-side del snapshot
  // (nutritionIntakeLogs + capa optimista del cache). Reemplaza el consumo
  // de AppContext.mealsLogged en flujos conectados (sin shim).
  const serverLoggedMeals = useMemo(
    () => deriveLoggedMeals(snapshot),
    [snapshot],
  );

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const { data: calendarData } = useProgramCalendar(monthStart, monthEnd);

  // Semana REAL del programa (server): fetch propio por rango — el hook
  // namespaced la query por from/to. Se gatilla SOLO en la pestaña Racha
  // (evita un round-trip extra por completación/focus para quien no usa la
  // franja; el primer cambio de tab dispara el fetch) y sin snapshot (sin
  // rango) queda deshabilitado.
  const weekStartLocal = snapshot?.template?.currentWeekStartDateLocal ?? null;
  const weekEndLocal = snapshot?.template?.currentWeekEndDateLocal ?? null;
  const weekRangeReady = Boolean(weekStartLocal && weekEndLocal);
  const { data: weekCalendarData } = useProgramCalendar(
    weekStartLocal ?? "",
    weekEndLocal ?? "",
    { enabled: weekRangeReady && tab === "racha" },
  );

  // Derived states from server snapshot with seamless fallback to AppContext/constants
  const program: ProgramDay = useMemo(() => {
    if (snapshot?.todayTasks && snapshot.todayTasks.length > 0) {
      const taskMap: Record<string, boolean> = {};
      for (const task of snapshot.todayTasks) {
        taskMap[task.taskCode] = task.status === "Completed";
      }
      return {
        podcast: Boolean(taskMap.podcast),
        vitals: Boolean(taskMap.vitals),
        nut: Boolean(taskMap.nut),
        ejercicio: Boolean(taskMap.ejercicio),
        nutraceutico: Boolean(taskMap.nutraceutico),
        emocional: Boolean(taskMap.emocional),
      };
    }
    return appProgram;
  }, [snapshot, appProgram]);

  const activeStreak = snapshot?.streak?.current ?? appStreak;
  // Máxima racha REAL del server; null sin snapshot → el chip "Máxima" no se
  // renderiza (nada inventado).
  const activeStreakLongest = snapshot?.streak?.longest ?? null;
  const activeFreezes = snapshot?.streak?.freezesRemaining ?? 0;
  const activePointsToday = snapshot?.todayPoints ?? appPointsToday;
  const activeProgramWeek =
    snapshot?.template?.currentWeekNumber ?? appProgramWeek;
  const activeTotalWeeks = snapshot?.template?.totalWeeks ?? PROGRAM_WEEKS;
  const weekPct =
    activeTotalWeeks > 0 ? activeProgramWeek / activeTotalWeeks : 0;

  // Índice device (lunes-primero): fallback del marcador de HOY cuando las
  // fechas del server no están o caen fuera de la semana.
  const todayIdx = weekdayMondayIndex();

  // Franja "Esta semana" resuelta por el SERVIDOR: celdas de la semana del
  // programa indexadas por weekday ISO (mapWeekCheckins). Con snapshot pero
  // SIN celdas (error de negocio 4xx re-lanzado por R5.2, o mock transport)
  // → 7 celdas nodata (done:false, hasData:false) — NUNCA el arreglo demo
  // verde. El arreglo device legado (weekCheckins) se usa SOLO en el flujo
  // demo sin snapshot (null).
  const weekStrip = useMemo(() => {
    if (!snapshot) return null;
    if (!weekCalendarData?.days) return emptyWeekCells();
    return mapWeekCheckins(weekCalendarData.days, weekStartLocal, weekEndLocal);
  }, [snapshot, weekCalendarData, weekStartLocal, weekEndLocal]);

  // Marcador de HOY de la franja: derivado de las fechas del server; sin
  // fechas o fuera de rango → marcador device (lunes-primero) documentado.
  const stripTodayIdx = useMemo(
    () =>
      weekTodayIndex(weekStartLocal, snapshot?.todayLocalDate ?? null) ??
      todayIdx,
    [weekStartLocal, snapshot, todayIdx],
  );

  // Progreso del día compartido por el ring, "Día perfecto" y el cofre
  // (Task 4): con snapshot se cuenta sobre la lista SERVER (status
  // Completed); sin snapshot se cae a la derivación local del plan.
  const progress = useMemo(() => {
    const serverCount = snapshot?.todayTasks?.length;
    if (serverCount) {
      const serverDone = snapshot.todayTasks.filter(
        (t) => t.status === "Completed",
      ).length;
      return {
        doneCount: serverDone,
        total: serverCount,
        allDone: serverDone === serverCount,
      };
    }
    const localDone = PROGRAM_TASKS.filter((pt) => program[pt.id]).length;
    return {
      doneCount: localDone,
      total: PROGRAM_TASKS.length,
      allDone: localDone === PROGRAM_TASKS.length,
    };
  }, [snapshot, program]);
  const { doneCount, allDone } = progress;
  const currentId = PROGRAM_TASKS.find((pt) => !program[pt.id])?.id;
  const task = useMemo(
    () => PROGRAM_TASKS.find((pt) => pt.id === active) ?? null,
    [active],
  );
  const serverActiveTask = useMemo(
    () => snapshot?.todayTasks?.find((t) => t.taskCode === active) ?? null,
    [snapshot, active],
  );
  // Lección SIN contenido real del servidor (content null o marcado
  // contentUnavailable): podcast/nut/ejercicio degradan a "contenido no
  // disponible aún" — nunca fabricación de episodios, circuitos o planes.
  const activeContent = serverActiveTask?.content;
  const activeContentUnavailable =
    !activeContent || activeContent.contentUnavailable === true;
  const taskTitle = serverActiveTask?.title || (task ? t(task.title) : "");
  const taskHint = useMemo(() => {
    if (active === "podcast" && serverActiveTask?.content?.title) {
      const durationMin = serverActiveTask.content.durationSecs
        ? Math.round(serverActiveTask.content.durationSecs / 60)
        : null;
      return durationMin
        ? `${serverActiveTask.content.title} · ${durationMin} min`
        : serverActiveTask.content.title;
    }
    return serverActiveTask?.short || (task ? t(task.hint) : "");
  }, [active, serverActiveTask, task, t]);
  const taskPts = serverActiveTask?.points ?? task?.pts ?? 0;

  const first = user.nombre.split(" ")[0];
  // Mapa mensual: verdad del server (nunca inventa días 'ok'); el marcador de
  // hoy usa snapshot.todayLocalDate cuando aplica al mes.
  const monthYear = now.getFullYear();
  const monthIndex = now.getMonth();
  const cells = useMemo(
    () =>
      buildMonthCells({
        year: monthYear,
        month: monthIndex,
        days: calendarData?.days,
        serverTodayIso: snapshot?.todayLocalDate ?? null,
      }),
    [calendarData, snapshot, monthYear, monthIndex],
  );
  // Read-only clinical chest progress from real scores (chests module, T9).
  const clinicalChests = useClinicalChests(scores, activeProgramWeek);

  const burst = (pts: number, withConfetti = false) => {
    setXpPop(pts);
    window.setTimeout(() => setXpPop(null), 900);
    if (!withConfetti) return;
    setConfetti(
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.3 + Math.random(),
        color: CONF_COLORS[i % CONF_COLORS.length],
      })),
    );
    window.setTimeout(() => setConfetti([]), 2400);
  };

  // Chest auto-open celebration (chests module, R3.2): a newly granted chest
  // (server truth diffed in useProgram) opens the chest modal + confetti. The
  // XP was already granted server-side; this is presentation only.
  useEffect(() => {
    const handleChestGranted = (e: Event) => {
      const detail = (e as CustomEvent<{ days: number; xp: number }>).detail;
      if (!detail) return;
      setOpenedChest({
        title: t("Cofre de {days} días", { days: String(detail.days) }),
        xp: detail.xp,
      });
      burst(detail.xp, true);
    };
    window.addEventListener("program:chest-granted", handleChestGranted);
    return () =>
      window.removeEventListener("program:chest-granted", handleChestGranted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    (
      id: ProgramTaskId,
      pts: number,
      msg: string,
      extra?: {
        moodScore?: number;
        barriers?: string;
        vitals?: VitalsPayload | null;
      },
    ) => {
      if (program[id]) return;

      const willComplete = progress.doneCount + 1 === progress.total;
      // El monto del bonus sale del snapshot (regla DAY_BONUS real) para que
      // el toast/burst coincida con la tarjeta del cofre; DAY_BONUS_PTS solo
      // como fallback local.
      const bonusPts = snapshot?.dailyBonusAmount ?? DAY_BONUS_PTS;

      // Todo el feedback local (marca AppContext, toast ok, confeti) queda
      // ATADO AL SUCCESS del servidor: un 422 del gate de adherencia (o
      // cualquier rechazo) no debe dejar la tarea "completada" en la UI —
      // el rollback del snapshot + el toast de error del hook ya muestran
      // la verdad.
      completeTaskMutation.completeTask(
        {
          taskCode: id as TaskCode,
          moodScore: extra?.moodScore,
          barriers: extra?.barriers,
          vitals: extra?.vitals,
        },
        {
          onSuccess: () => {
            // AppContext para fallback continuity — solo tras confirmación.
            completeStep(id, pts);
            showToast(
              willComplete
                ? `${msg} · ${t("Bonus +{pts}", { pts: String(bonusPts) })}`
                : msg,
              "ok",
            );
            burst(willComplete ? pts + bonusPts : pts, true);
            if (id === "nutraceutico") {
              const n = new Date();
              setTakenAt(
                n.toLocaleTimeString("es-ES", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              );
            }
          },
        },
      );

      setActive(null);
    },
    [
      program,
      completeTaskMutation,
      completeStep,
      progress,
      snapshot,
      showToast,
      t,
    ],
  );

  const exContent = snapshot?.todayTasks?.find(
    (t) => t.taskCode === "ejercicio",
  )?.content;
  const activeExerciseSteps = useMemo(() => {
    if (exContent?.exercises && exContent.exercises.length > 0) {
      return exContent.exercises.map((ex) => ({
        name: ex.name,
        // W4: duración defensiva compartida (negativos jamás auto-completan).
        sec: resolveStationSec(ex),
        cue:
          [
            ex.sets && ex.repetitions
              ? `${ex.sets} series x ${ex.repetitions} reps`
              : ex.sets
                ? `${ex.sets} series`
                : "",
            ex.description,
            ex.tips,
          ]
            .filter(Boolean)
            .join(" · ") || "Ejecuta con buena postura",
      }));
    }
    // Sin rutina del servidor → sin estaciones: la lección degrada al estado
    // honesto "contenido no disponible" (nunca el circuito fabricado).
    return [];
  }, [exContent]);

  // W3: el timer se resetea SOLO en la transición hacia la lección de
  // ejercicio. Un refetch por window-focus re-crea `activeExerciseSteps`
  // (misma identidad de rutina) y NO debe reiniciar un circuito a mitad de
  // camino — eso lo silenciaba sin que el usuario lo pidiera.
  const prevActive = useRef<ProgramTaskId | null>(null);
  useEffect(() => {
    const enteringExercise =
      active === "ejercicio" && prevActive.current !== "ejercicio";
    prevActive.current = active;
    if (enteringExercise && activeExerciseSteps.length > 0) {
      setExStep(0);
      setExLeft(activeExerciseSteps[0]?.sec ?? 45);
      setExRunning(false);
    }
  }, [active, activeExerciseSteps]);

  const skipStation = () => {
    if (program.ejercicio) return;
    if (exStep >= activeExerciseSteps.length - 1) {
      setExRunning(false);
      finish(
        "ejercicio",
        taskPts || 150,
        t("Circuito completado · +{pts} pts", { pts: String(taskPts || 150) }),
      );
      return;
    }
    const next = exStep + 1;
    setExStep(next);
    setExLeft(activeExerciseSteps[next]?.sec || 45);
  };

  useEffect(() => {
    // Solo celebra la TRANSICIÓN a día completo: el primer snapshot es
    // baseline (no celebra ni al entrar con tareas pendientes ni al entrar
    // con el día ya hecho). La condición anterior invertida abría el cofre
    // al ENTRAR con el día sin terminar ("¡0 DÍAS!" en el Protocolo).
    if (prevAll.current !== null && allDone && !prevAll.current)
      setCelebrate(true);
    prevAll.current = allDone;
  }, [allDone]);

  // Stop audio and reset playing state when closing the task sheet or switching away from podcast
  useEffect(() => {
    if (active !== "podcast" && audioRef.current) {
      audioRef.current.pause();
      setPodPlaying(false);
    }
  }, [active]);

  // W2: el progreso pertenece al audio que lo generó. Cuando el mediaUrl del
  // episodio cambia (rotación diaria del snapshot), el 80% del episodio
  // anterior no debe heredarse: reset a 0 + pausa, para que "Marcar
  // escuchado" exija escuchar el episodio REAL. Cerrar/reabrir el MISMO
  // episodio conserva el progreso (resume natural de la sesión).
  const podProgressForUrl = useRef<string | null>(null);
  useEffect(() => {
    const url = serverActiveTask?.content?.mediaUrl ?? null;
    if (url && podProgressForUrl.current !== url) {
      setPodProgress(0);
      setPodPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    }
    podProgressForUrl.current = url;
  }, [serverActiveTask?.content?.mediaUrl]);

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePodcast = useCallback(() => {
    const mediaUrl = serverActiveTask?.content?.mediaUrl;
    setAudioError(null);

    // Player real SOLO con mediaUrl: sin audio del servidor la lección se
    // muestra como "contenido no disponible" (no hay playback simulado).
    if (!mediaUrl) return;

    // If we don't have an audio instance or the source changed, initialize it
    if (!audioRef.current || audioRef.current.src !== mediaUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(mediaUrl);
      audio.ontimeupdate = () => {
        if (
          audio.duration &&
          Number.isFinite(audio.duration) &&
          audio.duration > 0
        ) {
          setPodProgress(audio.currentTime / audio.duration);
        }
      };
      audio.onended = () => {
        setPodPlaying(false);
        setPodProgress(1);
      };
      audio.onpause = () => setPodPlaying(false);
      audio.onplay = () => setPodPlaying(true);
      audio.onerror = (e) => {
        console.error("Audio playback error", e);
        setPodPlaying(false);
        setAudioError(t("No se pudo reproducir el archivo de audio."));
      };
      audioRef.current = audio;
    }

    if (podPlaying) {
      audioRef.current.pause();
    } else {
      if (podProgress >= 1 && audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play().catch((err) => {
        console.error("Failed to play podcast audio", err);
        setPodPlaying(false);
        setAudioError(t("Error al iniciar la reproducción de audio."));
      });
    }
  }, [serverActiveTask?.content?.mediaUrl, podPlaying, podProgress, t]);

  const handleSkipPodcast = useCallback(
    (delta: number) => {
      const mediaUrl = serverActiveTask?.content?.mediaUrl;
      const duration = serverActiveTask?.content?.durationSecs || 0;

      if (audioRef.current && mediaUrl) {
        const current = audioRef.current.currentTime;
        const total =
          audioRef.current.duration &&
          Number.isFinite(audioRef.current.duration) &&
          audioRef.current.duration > 0
            ? audioRef.current.duration
            : duration;
        const target = Math.max(0, Math.min(total, current + delta));
        audioRef.current.currentTime = target;
        if (total > 0) {
          setPodProgress(target / total);
        }
      }
    },
    [
      serverActiveTask?.content?.mediaUrl,
      serverActiveTask?.content?.durationSecs,
    ],
  );

  useEffect(() => {
    if (!exRunning) return;
    const id = window.setInterval(() => setExLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [exRunning]);

  useEffect(() => {
    if (!exRunning || exLeft > 0) return;
    if (exStep < activeExerciseSteps.length - 1) {
      const next = exStep + 1;
      setExStep(next);
      setExLeft(activeExerciseSteps[next]?.sec || 45);
      return;
    }
    setExRunning(false);
    if (!program.ejercicio) {
      finish(
        "ejercicio",
        taskPts || 150,
        t("Circuito completado · +{pts} pts", { pts: String(taskPts || 150) }),
      );
    }
  }, [
    exLeft,
    exRunning,
    exStep,
    program.ejercicio,
    finish,
    t,
    activeExerciseSteps,
    taskPts,
  ]);

  return (
    <Screen>
      <Scroll className="pg-scroll">
        {productMessage && (
          <div
            className="card"
            style={{
              margin: "12px 16px",
              borderLeft: "4px solid var(--org)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
              {productMessage}
            </p>
            {programState === "recoverable" && (
              <IonButton
                size="small"
                fill="outline"
                onClick={() => refetchProgram()}
                style={{ marginLeft: 8 }}
              >
                <IonIcon icon={refresh} slot="start" />
                {t("Reintentar")}
              </IonButton>
            )}
          </div>
        )}

        <ProgramHeader
          programWeek={activeProgramWeek}
          doneCount={doneCount}
          total={progress.total}
          allDone={allDone}
          pointsToday={activePointsToday}
          pointsMax={snapshot?.todayPointsMax ?? PROGRAM_POINTS_MAX}
          // Chests are auto-granted server-side now: nothing sits in a
          // "ready to claim" state anymore (chests module, R3.2).
          readyChests={0}
          tab={tab}
          onTab={setTab}
          onOpenChests={() => setTab("racha")}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} {...paneMotion}>
            {tab === "hoy" && (
              <TodayView
                program={program}
                todayTasks={snapshot?.todayTasks}
                allDone={allDone}
                currentId={currentId}
                first={first}
                programWeek={activeProgramWeek}
                todayIdx={todayIdx}
                takenAt={takenAt}
                nbWeekDays={snapshot?.streak?.nbWeekDays}
                weekStartDateLocal={
                  snapshot?.template?.currentWeekStartDateLocal
                }
                todayLocalDate={snapshot?.todayLocalDate}
                dailyBonusAmount={snapshot?.dailyBonusAmount}
                todayBonusAvailable={snapshot?.todayBonusAvailable}
                scores={scores}
                onOpenTask={setActive}
                onGoEvo={() => setTab("evo")}
                onGoChat={() => navigate("chat")}
              />
            )}
            {tab === "racha" && (
              <StreakView
                streak={activeStreak}
                longestStreak={activeStreakLongest}
                freezesRemaining={activeFreezes}
                weekCheckins={weekCheckins}
                weekCells={weekStrip}
                todayIdx={stripTodayIdx}
                cells={cells}
                weekPct={weekPct}
                programWeek={activeProgramWeek}
                programWeeks={activeTotalWeeks}
                chests={chests}
                clinicalChests={clinicalChests}
                nbStreak={snapshot?.streak?.nbStreak ?? 0}
                nbNextMilestone={snapshot?.streak?.nbNextMilestone ?? null}
                multiplierActive={snapshot?.streak?.multiplierActive}
                multiplierRemainingHours={
                  snapshot?.streak?.multiplierRemainingHours
                }
              />
            )}
            {tab === "liga" && <RankingView />}
            {tab === "evo" && (
              <EvolutionView
                scores={scores}
                stale={scoresStale}
                scoresLoading={scoresLoading}
                scoresError={scoresError}
                onRetryScores={() => void refetchScores()}
                onGoBook={() => navigate("book")}
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
                  <div className="kicker" style={{ color: "var(--mu)" }}>
                    {task.emoji}{" "}
                    {t("Misión · +{pts} pts", { pts: String(taskPts) })}
                  </div>
                  <h2>{t(taskTitle)}</h2>
                  <p>{t(taskHint)}</p>
                </div>
                <IonButton
                  fill="clear"
                  aria-label={t("Cerrar")}
                  onClick={() => setActive(null)}
                >
                  <IonIcon slot="icon-only" icon={close} />
                </IonButton>
              </div>
              {program[task.id] && (
                <div className="lesson-done-banner">
                  {t("Completada hoy · +{pts} pts", { pts: String(taskPts) })}
                </div>
              )}

              {task.id === "podcast" && (
                <PodcastLesson
                  done={program.podcast}
                  pts={taskPts}
                  title={serverActiveTask?.content?.title}
                  author={serverActiveTask?.content?.author}
                  description={serverActiveTask?.content?.description}
                  durationSecs={serverActiveTask?.content?.durationSecs}
                  mediaUrl={serverActiveTask?.content?.mediaUrl}
                  audioError={audioError}
                  chapters={serverActiveTask?.content?.chapters}
                  takeaways={serverActiveTask?.content?.takeaways}
                  playing={podPlaying}
                  progress={podProgress}
                  onToggle={handleTogglePodcast}
                  onSkip={handleSkipPodcast}
                  // W1: sin Audio creado aún, skip/capítulos estarían en no-op
                  // silencioso — la lección los deshabilita hasta el primer play
                  // (audioRef.current se vuelve reactivo vía podPlaying).
                  audioReady={audioRef.current != null}
                  onComplete={() =>
                    finish(
                      "podcast",
                      taskPts,
                      t("Podcast escuchado · +{pts} pts", {
                        pts: String(taskPts),
                      }),
                    )
                  }
                  unavailable={activeContentUnavailable}
                />
              )}
              {task.id === "vitals" && (
                <VitalsLesson
                  done={program.vitals}
                  pts={taskPts}
                  recentVitals={serverActiveTask?.content?.recentVitals}
                  wearableConnected={wearableConnected}
                  onConnectWatch={() => {
                    connectWearable("Copp Adresd Wearable");
                    showToast(t("Wearable listo para sincronizar"), "ok");
                  }}
                  onComplete={(vitals) =>
                    finish(
                      "vitals",
                      taskPts,
                      t("+{pts} pts por signos vitales", {
                        pts: String(taskPts),
                      }),
                      { vitals },
                    )
                  }
                />
              )}
              {task.id === "nut" && (
                <NutritionLesson
                  done={program.nut}
                  pts={taskPts}
                  title={
                    serverActiveTask?.content?.nutritionPlanName ||
                    serverActiveTask?.content?.title ||
                    undefined
                  }
                  dailyCalorieTarget={
                    serverActiveTask?.content?.dailyCalorieTarget
                  }
                  dailyProteinTarget={
                    serverActiveTask?.content?.dailyProteinTarget
                  }
                  dailyCarbsTarget={serverActiveTask?.content?.dailyCarbsTarget}
                  dailyFatTarget={serverActiveTask?.content?.dailyFatTarget}
                  dailyFiberTarget={serverActiveTask?.content?.dailyFiberTarget}
                  nutritionMeals={serverActiveTask?.content?.nutritionMeals}
                  mealsLogged={serverLoggedMeals}
                  onGoPlan={() => {
                    setActive(null);
                    navigate("nut");
                  }}
                  onComplete={() =>
                    finish(
                      "nut",
                      taskPts,
                      t("+{pts} pts nutrición", { pts: String(taskPts) }),
                    )
                  }
                  unavailable={activeContentUnavailable}
                />
              )}
              {task.id === "ejercicio" && (
                <ExerciseLesson
                  done={program.ejercicio}
                  pts={taskPts}
                  title={
                    serverActiveTask?.content?.exerciseRoutineName ||
                    serverActiveTask?.content?.title ||
                    undefined
                  }
                  exercises={serverActiveTask?.content?.exercises}
                  step={exStep}
                  left={Math.max(0, exLeft)}
                  running={exRunning}
                  onToggle={() => setExRunning((r) => !r)}
                  onSkip={skipStation}
                  onComplete={() =>
                    finish(
                      "ejercicio",
                      taskPts,
                      t("Ejercicio del día · +{pts} pts", {
                        pts: String(taskPts),
                      }),
                    )
                  }
                  unavailable={activeContentUnavailable}
                />
              )}
              {task.id === "nutraceutico" && (
                <NutraceuticLesson
                  done={program.nutraceutico}
                  pts={taskPts}
                  takenAt={takenAt}
                  slot={nutriSlot}
                  nbWeekDays={snapshot?.streak?.nbWeekDays}
                  onSlot={setNutriSlot}
                  onComplete={() =>
                    finish(
                      "nutraceutico",
                      taskPts,
                      t("Nutracéutico registrado · +{pts} pts", {
                        pts: String(taskPts),
                      }),
                    )
                  }
                />
              )}
              {task.id === "emocional" && (
                <EmotionalLesson
                  done={program.emocional}
                  pts={taskPts}
                  onComplete={({ mood, barrier }) => {
                    finish(
                      "emocional",
                      taskPts,
                      t("Check-in emocional · +{pts} pts", {
                        pts: String(taskPts),
                      }),
                      {
                        moodScore: parseInt(mood, 10) || 3,
                        barriers: barrier,
                      },
                    );
                    if (barrier)
                      showToast(t("Registro enviado a tu equipo"), "info");
                  }}
                />
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
        <div className="celebrate-card ms-card-wrap">
          <AnimatePresence>
            {celebrate && (
              <motion.div
                className="celebrate-burst"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 16 }}
              >
                <div className="celebrate-ico">
                  <IonIcon icon={flame} />
                </div>
                <div
                  className="display"
                  style={{ fontSize: 24, fontWeight: 800 }}
                >
                  {t("¡{streak} DÍAS!", { streak: String(activeStreak) })}
                </div>
                <p>
                  {t(
                    "Cofre del día abierto. Mañana sigue el protocolo para no romper la racha.",
                  )}
                </p>
                <div className="ms-mini">
                  <div>
                    <b>+{activePointsToday}</b>
                    <span>{t("pts hoy")}</span>
                  </div>
                  {/* Multiplicador SOLO con el dato real del snapshot; un `x2 ·
                      24h` fijo fabricaba un bonus que puede estar inactivo. */}
                  {(snapshot?.streak?.multiplierActive ?? 0) > 1 && (
                    <div>
                      <b>
                        {t("x{multiplier} · {hours}h", {
                          multiplier: String(
                            snapshot?.streak?.multiplierActive,
                          ),
                          hours: String(
                            Math.ceil(
                              snapshot?.streak?.multiplierRemainingHours ?? 0,
                            ),
                          ),
                        })}
                      </b>
                      <span>{t("próximo hito")}</span>
                    </div>
                  )}
                </div>
                <IonButton
                  expand="block"
                  className="bt bt-primary"
                  onClick={() => setCelebrate(false)}
                >
                  {t("Seguir transformándome")}
                </IonButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </IonModal>

      <IonModal
        isOpen={!!openedChest}
        onDidDismiss={() => setOpenedChest(null)}
        className="celebrate-modal"
      >
        <div className="celebrate-card ms-card-wrap">
          <AnimatePresence>
            {openedChest && (
              <motion.div
                className="celebrate-burst cx-open"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 16 }}
              >
                <div className="cx-open-ico">
                  <IonIcon icon={gift} />
                </div>
                <div
                  className="display"
                  style={{ fontSize: 22, fontWeight: 800 }}
                >
                  {t(openedChest.title)}
                </div>
                <p>
                  {t("El cofre se abrió. La experiencia ya está en tu nivel.")}
                </p>
                <div className="cx-open-xp">
                  +{openedChest.xp.toLocaleString("es-ES")} XP
                </div>
                <IonButton
                  expand="block"
                  className="bt bt-primary"
                  onClick={() => setOpenedChest(null)}
                >
                  {t("Seguir transformándome")}
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
              "--d": `${c.dur}s`,
              "--dl": `${c.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </Screen>
  );
}

import { WellnessGuidance } from "../WellnessGuidance";
import { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonIcon,
  IonProgressBar,
  IonRange,
  IonSpinner,
  IonToggle,
} from "@ionic/react";
import {
  arrowBackOutline,
  arrowForwardOutline,
  checkmarkCircle,
  informationCircleOutline,
  pauseOutline,
  playOutline,
  timerOutline,
} from "ionicons/icons";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { Screen, Scroll } from "../../../components/Screen";
import {
  completeProtocolStep,
  getWellnessHomeData,
  localISODate,
  parseLocalDate,
} from "../state/wellness-home-store";
import {
  buildExerciseDay,
  type ExerciseCheckin,
  type PlannedExercise,
} from "./exercise-plan";
import { MOTOR_PLAN_STATE, motorPlanUserId, type MotorExerciseSession } from "../calendar/motor-plan-api";
import { useMotorDay } from "../calendar/useMotorDay";
import { submitProtocolStep } from "../protocol/protocol-rewards-api";
import { motorExercisePlan } from "./motor-exercise-plan";
import "../wellness.css";
import "./wellness-exercise.css";
import { VitaEntry } from "../vita";
import { checkinHistory, checkinOwner } from "../checkin/checkin-store";
import { dailyEffects, EFFECT_COPY } from "../checkin/close-day";

const EXERCISE_MESSAGES = new Set<string>([
  EFFECT_COPY.gentleSleep, EFFECT_COPY.gentleFatigue, EFFECT_COPY.lowImpact,
  EFFECT_COPY.pausePain, EFFECT_COPY.continuingPause, EFFECT_COPY.dizziness,
  EFFECT_COPY.progressOne, EFFECT_COPY.progressTwo, EFFECT_COPY.brokenStreak,
]);

const CHECKIN_KEY = "wellness.exercise.checkin.v1";
const SESSION_KEY = "wellness.exercise.session.v1";
const PENDING_KEY = "wellness.exercise.pending.v1";

interface StoredCheckin extends ExerciseCheckin {
  date: string;
  day?: number;
}

interface StoredSession {
  date: string;
  day?: number;
  fingerprint?: string;
  index: number;
  remaining: number;
  endAt: number | null;
  paused: boolean;
  running: boolean;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible */
  }
}

function durationFor(exercise: PlannedExercise): number {
  if (exercise.allottedMinutes !== undefined) return exercise.allottedMinutes * 60;
  const { sets, reps, restSec, minutes } = exercise.dose;
  if (minutes) return Math.max(60, Math.round(minutes * 60));
  return Math.max(
    60,
    Math.round((sets ?? 2) * ((reps ?? 10) * 3 + (restSec ?? 45))),
  );
}

function clock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function sessionRemaining(session: StoredSession): number {
  return session.paused || session.endAt === null
    ? session.remaining
    : Math.max(0, Math.ceil((session.endAt - Date.now()) / 1000));
}

export function WellnessExercise() {
  const motor = useMotorDay();
  const { navigate } = useApp();
  const { t } = useI18n();
  if (motor.kind === "legacy") return <ExerciseScreen key="legacy" />;
  const account = motorPlanUserId();
  if (motor.kind === "ready" && motor.day.status.state !== "paused" && motor.day.exercise && account) {
    const { today, todayLocalDate, exercise } = motor.day;
    // No reanudar por índice si una actualización cambia la receta del día.
    const fingerprint = JSON.stringify(exercise.items.map(({ id, minutes, strength }) => [id, minutes, strength]));
    return <ExerciseScreen key={JSON.stringify([account, today, todayLocalDate, fingerprint])}
      server={{ account, day: today, date: todayLocalDate, exercise, fingerprint }} />;
  }
  const loading = motor.kind === "loading";
  const message = loading ? "Consultando el plan…"
    : motor.kind === "locked" ? MOTOR_PLAN_STATE.locked
    : motor.kind === "ready" && motor.day.status.state === "paused" ? MOTOR_PLAN_STATE.paused
    : "Día del plan no disponible";
  return (
    <Screen>
      <Scroll className="wx-scroll">
        <header className="wx-hero wx-hero-top">
          <IonButton className="wx-back" fill="outline" onClick={() => navigate("protocol")}
            aria-label={t("Volver al protocolo")}>
            <IonIcon icon={arrowBackOutline} slot="icon-only" aria-hidden="true" />
          </IonButton>
          <h1>{t("Ejercicio")}</h1>
        </header>
        <div className="wx-card" role="status">
          {loading && <IonSpinner aria-hidden="true" />}
          <p className="wx-body">{t(message)}</p>
        </div>
      </Scroll>
      <VitaEntry module="exercise" summary={{ sessionActive: false,
        ...(motor.kind === "ready" ? { day: motor.day.today } : {}) }} />
    </Screen>
  );
}

interface ServerExercise {
  account: string;
  day: number;
  date: string;
  exercise: MotorExerciseSession;
  fingerprint: string;
}

function ExerciseScreen({ server }: { server?: ServerExercise }) {
  const { user, navigate, showToast } = useApp();
  const { t, lang } = useI18n();
  const number = new Intl.NumberFormat(lang);
  const today = new Date();
  const date = server?.date ?? localISODate(today);
  const checkinKey = server ? CHECKIN_KEY + "." + server.account : CHECKIN_KEY;
  const sessionKey = server ? SESSION_KEY + "." + server.account : SESSION_KEY;
  const owner = checkinOwner(user);
  const home = getWellnessHomeData(user?.nombre ?? "", today);
  const effects = useMemo(
    () => dailyEffects(date, checkinHistory(owner), home.day),
    [date, owner, home.day],
  );
  const [checkin, setCheckin] = useState<StoredCheckin>(() => {
    const stored = read<StoredCheckin | null>(checkinKey, null);
    return stored && stored.date === date && stored.day === server?.day
      ? stored
      : {
          date,
          day: server?.day,
          pain: 0,
          fatigue: false,
          dizziness: false,
        };
  });
  const plan = useMemo(
    () =>
      server ? motorExercisePlan(server.day, server.exercise, checkin) : buildExerciseDay({
        goal: home.plan.goal,
        day: home.day,
        dailyEffects: effects,
        checkin: checkin.date === date ? {
          pain: checkin.pain,
          fatigue: checkin.fatigue,
          dizziness: checkin.dizziness,
        } : undefined,
      }),
    [server, home.plan.goal, home.day, checkin, effects, date],
  );
  const [session, setSession] = useState<StoredSession | null>(() => {
    const stored = read<StoredSession | null>(sessionKey, null);
    return stored && stored.date === date && stored.day === server?.day &&
      stored.fingerprint === server?.fingerprint ? stored : null;
  });
  const [remaining, setRemaining] = useState(() =>
    session ? sessionRemaining(session) : 0,
  );
  const [finished, setFinished] = useState(false);

  const updateCheckin = (patch: Partial<ExerciseCheckin>) => {
    setCheckin((prev) => {
      const next = { ...prev, ...patch, date, day: server?.day };
      write(checkinKey, next);
      return next;
    });
  };

  const currentExercise = session ? plan.exercises[session.index] : undefined;

  // Cronómetro basado en `endAt`: sobrevive a bloquear la pantalla y a
  // reabrir la app, porque no depende de un contador en memoria.
  useEffect(() => {
    if (!session?.running || session.paused || session.endAt === null) return;
    const initial = sessionRemaining(session);
    setRemaining(initial);
    if (initial === 0) return;

    const timer = window.setInterval(() => {
      const left = sessionRemaining(session);
      setRemaining(left);
      if (left === 0) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [session]);

  const startSession = () => {
    if (plan.exercises.length === 0) return;
    const duration = durationFor(plan.exercises[0]);
    const initial: StoredSession = {
      date,
      day: server?.day,
      fingerprint: server?.fingerprint,
      index: 0,
      remaining: duration,
      endAt: Date.now() + duration * 1000,
      paused: false,
      running: true,
    };
    setSession(initial);
    setRemaining(initial.remaining);
    write(sessionKey, initial);
  };

  const togglePause = () => {
    if (!session) return;
    if (session.paused) {
      const next = {
        ...session,
        paused: false,
        endAt: Date.now() + session.remaining * 1000,
      };
      setSession(next);
      write(sessionKey, next);
    } else {
      const left = sessionRemaining(session);
      const next = { ...session, paused: true, endAt: null, remaining: left };
      setSession(next);
      setRemaining(left);
      write(sessionKey, next);
    }
  };

  const nextExercise = () => {
    if (!session) return;
    const nextIndex = session.index + 1;
    if (nextIndex >= plan.exercises.length) {
      finishSession();
      return;
    }
    const duration = durationFor(plan.exercises[nextIndex]);
    const next = {
      ...session,
      index: nextIndex,
      remaining: duration,
      endAt: Date.now() + duration * 1000,
      paused: false,
    };
    setSession(next);
    setRemaining(duration);
    write(sessionKey, next);
  };

  const finishSession = () => {
    const result = server ? null : completeProtocolStep("exercise", parseLocalDate(date) ?? today);
    write(PENDING_KEY, {
      date,
      completedAt: new Date().toISOString(),
    });
    window.localStorage.removeItem(sessionKey);
    setSession(null);
    setFinished(true);
    if (server) {
      void submitProtocolStep(server.account, server.date, "exercise").then(
        () => showToast(t("Ejercicio completado y guardado en tu teléfono."), "ok"),
        () => showToast(t("No pudimos guardar el paso. Inténtalo de nuevo."), "warn"),
      );
    } else {
      showToast(result?.completed ? t("Ejercicio completado y guardado en tu teléfono.")
        : t("Ejercicio ya estaba completo hoy."), "ok");
    }
  };

  const closeSession = () => {
    write(sessionKey, session);
    setSession(null);
  };

  if (finished) {
    return (
      <Screen>
        <Scroll className="wx-scroll">
          <WellnessGuidance kind="exercise" className="ion-padding-horizontal ion-padding-vertical" />
          <div className="wx-done">
            <IonIcon icon={checkmarkCircle} aria-hidden="true" />
            <h1>{t("Sesión completada")}</h1>
            <p>
              {t(
                "Guardado en el teléfono. Se sincronizará cuando tengas conexión.",
              )}
            </p>
            <IonButton expand="block" onClick={() => navigate("protocol")}>
              {t("Volver al protocolo")}
            </IonButton>
            <IonButton fill="clear" onClick={() => navigate("home")}>
              {t("Ir al inicio")}
            </IonButton>
          </div>
        </Scroll>
      </Screen>
    );
  }

  if (session && currentExercise) {
    return (
      <Screen>
        <Scroll className="wx-scroll">
          <WellnessGuidance kind="exercise" className="ion-padding-horizontal ion-padding-vertical" />
          <header className="wx-session-head">
            <IonButton
              className="wx-back"
              fill="outline"
              onClick={closeSession}
              aria-label={t("Salir de la sesión")}
            >
              <IonIcon icon={arrowBackOutline} slot="icon-only" aria-hidden="true" />
            </IonButton>
            <div>
              <p className="wx-eyebrow">
                {t("Ejercicio {n} de {total}", {
                  n: number.format(session.index + 1),
                  total: number.format(plan.exercises.length),
                })}
              </p>
              <h1>
                {currentExercise.name[lang]}
              </h1>
            </div>
          </header>
          <IonProgressBar
            value={(session.index + 1) / plan.exercises.length}
            className="wx-progress"
            aria-label={t("Progreso de la sesión")}
          />
          <div className="wx-timer" role="timer">
            <IonIcon icon={timerOutline} aria-hidden="true" />
            <strong>{clock(remaining)}</strong>
            <span>{session.paused ? t("En pausa") : t("Tiempo restante")}</span>
          </div>
          <ExerciseTechnique exercise={currentExercise} />
          <div className="wx-session-actions">
            <IonButton fill="outline" expand="block" onClick={togglePause}>
              <IonIcon
                slot="start"
                icon={session.paused ? playOutline : pauseOutline}
                aria-hidden="true"
              />
              {session.paused ? t("Continuar") : t("Pausar")}
            </IonButton>
            <IonButton expand="block" onClick={nextExercise}>
              {session.index + 1 >= plan.exercises.length
                ? t("Terminar sesión")
                : t("Siguiente")}
              <IonIcon
                slot="end"
                icon={arrowForwardOutline}
                aria-hidden="true"
              />
            </IonButton>
          </div>
        </Scroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <Scroll className="wx-scroll">
          <WellnessGuidance kind="exercise" className="ion-padding-horizontal ion-padding-vertical" />
        <header className="wx-hero">
          <div className="wx-hero-top">
            <IonButton
              className="wx-back"
              fill="outline"
              onClick={() => navigate("protocol")}
              aria-label={t("Volver al protocolo")}
            >
              <IonIcon icon={arrowBackOutline} slot="icon-only" aria-hidden="true" />
            </IonButton>
            <div>
              <p className="wx-eyebrow">{t("Ejercicio")}</p>
              <h1>{plan.typeName[lang]}</h1>
            </div>
            <IonBadge className="wx-badge" color="light">
              {t("Semana {week}", { week: number.format(plan.week) })}
            </IonBadge>
          </div>
          <p className="wx-meta">
            {t("Día {day} · {minutes} min · Fase {phase}", {
              day: number.format(plan.day),
              minutes: number.format(plan.minutes),
              phase: plan.phaseName[lang],
            })}
          </p>
          {plan.deload && (
            <p className="wx-deload">
              {t("Semana de descarga: bajamos la carga.")}
            </p>
          )}
        </header>

        <section className="wx-card" aria-labelledby="wx-checkin">
          <h2 id="wx-checkin">{t("Antes de empezar")}</h2>
          <p className="wx-body">
            {t("Ajustamos la sesión según cómo te sientes hoy.")}
          </p>
          <IonRange
            labelPlacement="stacked"
            min={0}
            max={10}
            step={1}
            value={checkin.pain}
            onIonChange={(event) => {
              const value = event.detail.value;
              updateCheckin({
                pain: typeof value === "number" ? value : value.lower,
              });
            }}
          >
            <span slot="label" className="wx-range-label">
              {t("Dolor de 0 a 10")}: <strong aria-hidden="true">{checkin.pain}</strong>
            </span>
          </IonRange>
          <div className="wx-toggles">
            <IonToggle
              checked={checkin.fatigue}
              onIonChange={(event) =>
                updateCheckin({ fatigue: event.detail.checked })
              }
            >
              {t("Fatiga")}
            </IonToggle>
            <IonToggle
              checked={checkin.dizziness}
              onIonChange={(event) =>
                updateCheckin({ dizziness: event.detail.checked })
              }
            >
              {t("Mareo")}
            </IonToggle>
          </div>
        </section>

        {!server && effects.messages.filter((message) => EXERCISE_MESSAGES.has(message)).map((message) => (
          <p className="wx-note" key={message}>{t(message)}</p>
        ))}
        {plan.adaptationNote && (
          <p
            className={`wx-note${plan.adaptation === "rest" ? " wx-note-stop" : ""}`}
            role="status"
          >
            <IonIcon icon={informationCircleOutline} aria-hidden="true" />
            {t(plan.adaptationNote)}
          </p>
        )}

        {plan.exercises.length === 0 ? (
          <p className="wx-card wx-body">
            {t("Hoy toca descanso. Mañana volvemos.")}
          </p>
        ) : (
          <>
            <ol className="wx-list" aria-label={t("Ejercicio")}>
              {plan.exercises.map((exercise, index) => (
                <li className="wx-card" key={`${exercise.id}-${index}`}>
                  <div className="wx-ex-head">
                    <span className="wx-ex-num" aria-hidden="true">
                      {index + 1}
                    </span>
                    <h2>
                      {exercise.name[lang]}
                    </h2>
                  </div>
                  {exercise.description && <p className="wx-body">{exercise.description[lang]}</p>}
                  {exercise.allottedMinutes !== undefined && (
                    <p className="wx-dose">{t("{minutes} min", { minutes: number.format(exercise.allottedMinutes) })}</p>
                  )}
                  {exercise.dose.minutes === undefined || exercise.allottedMinutes === undefined ? (
                    <p className="wx-dose">{doseLabel(exercise, t)}</p>
                  ) : null}
                  {!!exercise.dose.holdSec && (
                    <p className="wx-body">{t("Sostén {seconds} s", { seconds: number.format(exercise.dose.holdSec) })}</p>
                  )}
                  <ExerciseTechnique exercise={exercise} compact />
                </li>
              ))}
            </ol>
            <div className="wx-start">
              <IonButton expand="block" onClick={startSession}>
                {t("Empezar sesión")}
              </IonButton>
            </div>
          </>
        )}

        {plan.nextUnlocks.length > 0 && (
          <section className="wx-card" aria-labelledby="wx-unlocks">
            <h2 id="wx-unlocks">{t("Próximos desbloqueos")}</h2>
            <ul className="wx-unlocks">
              {plan.nextUnlocks.map((unlock) => (
                <li key={unlock.id}>
                  <span>{unlock.name[lang]}</span>
                  <span>
                    {t("Semana {week}", { week: String(unlock.week) })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="wx-legal">
          {t("Contenido orientativo de bienestar. Complementa las indicaciones de tu profesional de la salud.")}
        </p>
      </Scroll>
      <VitaEntry
        module="exercise"
        summary={{
          day: plan.day,
          ...(!server ? { goal: home.plan.goal } : {}),
          exercisesTotal: plan.exercises.length,
          sessionActive: Boolean(session),
        }}
      />
    </Screen>
  );
}

function doseLabel(
  exercise: PlannedExercise,
  t: (key: string, params?: Record<string, string>) => string,
): string {
  const { sets, reps, restSec, rir, minutes } = exercise.dose;
  if (minutes) return t("{minutes} min", { minutes: String(minutes) });
  return t("{sets} series × {reps} reps · descanso {rest} s · RIR {rir}", {
    sets: String(sets),
    reps: String(reps),
    rest: String(restSec),
    rir: rir ?? "2-3",
  });
}

function ExerciseTechnique({
  exercise,
  compact = false,
}: {
  exercise: PlannedExercise;
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const guide = exercise.guide;
  return (
    <details className={`wx-tech${compact ? " is-compact" : ""}`}>
      <summary>{t("Técnica y respiración")}</summary>
      <ol>
        {guide.steps.map((step, index) => (
          <li key={index}>{step[lang]}</li>
        ))}
      </ol>
      <p>
        <strong>{t("Respiración")}:</strong> {guide.breathing[lang]}
      </p>
      {guide.mistakes.length > 0 && (
        <p>
          <strong>{t("Evita")}:</strong> {new Intl.ListFormat(lang).format(guide.mistakes.map(mistake => mistake[lang]))}
        </p>
      )}
      <p>
        <strong>{t("Más fácil")}:</strong> {guide.easier[lang]}
      </p>
      <p>
        <strong>{t("Más difícil")}:</strong> {guide.harder[lang]}
      </p>
    </details>
  );
}

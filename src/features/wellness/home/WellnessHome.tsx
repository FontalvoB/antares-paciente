import { GOAL_LABEL, useWellnessOverview } from "./useWellnessOverview";
import { useState } from "react";
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonProgressBar } from "@ionic/react";
import { barbellOutline, calendarOutline, checkmark, clipboardOutline, flashOutline, flameOutline, headsetOutline, restaurantOutline } from "ionicons/icons";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { formatDateForDisplay, formatLocalizedDate, toLocalISODate } from "../../../utils/dates";
import { GENERATION_ARTIFACTS, type GenerationInboxItem } from "../generation/generation-store";
import type { PaidGeneration } from "../generation/wellness-journey-api";
import { MOTOR_PLAN_STATE } from "../calendar/motor-plan-api";
import { useMotorDay } from "../calendar/useMotorDay";
import { useGeneration } from "../generation/useGeneration";
import { WellnessFrame, WellnessPreview } from "./WellnessFrame";
import "./wellness-home.css";
import { VitaEntry } from "../vita";

const ARTIFACT_LABEL = {
  exercise: "Ejercicio",
  nutrition: "Nutrición",
  inbox: "Bandeja",
} as const;

const ARTIFACT_ERROR = {
  exercise: "No pudimos preparar tu plan de ejercicio",
  nutrition: "No pudimos preparar tu plan de nutrición",
  inbox: "No pudimos preparar tu bandeja",
} as const;

const INBOX_COPY = {
  welcome: [
    "Te damos la bienvenida",
    "Aquí recibirás novedades sobre tu plan de bienestar.",
  ],
  exercise: [
    "Tu plan de ejercicio está listo",
    "Abre Ejercicio para ver tu primera sesión.",
  ],
  nutrition: [
    "Tu plan de nutrición está listo",
    "Abre Nutrición para consultar tus comidas.",
  ],
  questionnaires: [
    "Tus cuestionarios",
    "Puedes completarlos a tu ritmo desde Inicio.",
  ],
} as const satisfies Record<
  GenerationInboxItem["id"],
  readonly [string, string]
>;

export function WellnessHome({ paidGeneration }: { paidGeneration?: PaidGeneration }) {
  const { user, navigate, openTests } = useApp();
  const { t, lang } = useI18n();
  const data = useWellnessOverview(user.nombre);
  const motor = useMotorDay();
  const syncedDay = motor.kind === "ready" ? motor.day : undefined;
  const planDay = motor.kind === "ready" ? motor.day.today : motor.kind === "legacy" ? data.day : null;
  const streak = motor.kind === "ready" ? motor.day.streak : motor.kind === "legacy" ? data.streakDays : null;
  const motorLabel = motor.kind === "ready" ? MOTOR_PLAN_STATE[motor.day.status.state]
    : motor.kind === "locked" ? MOTOR_PLAN_STATE.locked
      : motor.kind === "loading" ? "Consultando el plan…"
        : motor.kind === "unlinked" ? "Tu cuenta no tiene un plan vinculado." : "Día del plan no disponible";
  const [podcastOpen, setPodcastOpen] = useState(false);
  const local = useGeneration(!paidGeneration);
  const artifacts = paidGeneration?.job ?? local.job?.artifacts;
  const failed = GENERATION_ARTIFACTS.filter((id) => artifacts?.[id].status === "failed");
  const isRunning = GENERATION_ARTIFACTS.some((id) => {
    const status = artifacts?.[id].status;
    return status === "pending" || status === "running";
  });
  const isReady = GENERATION_ARTIFACTS.every((id) => artifacts?.[id].status === "ready");
  const inbox = paidGeneration?.job.inbox.items ?? local.job?.inbox.map((item) => {
    const [title, body] = INBOX_COPY[item.id];
    return { ...item, title: t(title), body: t(body) };
  });
  const inboxStatus = artifacts?.inbox.status;
  const number = new Intl.NumberFormat(lang === "en" ? "en-US" : "es-ES", {
    maximumFractionDigits: 0,
  });

  const percent = Math.round(data.protocolDone / data.protocol.length * 100);
  const tasks = [
    { id: "podcast", title: "Pódcast del día", subtitle: "Hábitos que transforman", icon: headsetOutline, done: false, action: () => setPodcastOpen(true) },
    { id: "exercise", title: "Ejercicio", subtitle: "Tu rutina de hoy", icon: barbellOutline, done: data.protocol.find(s => s.id === "exercise")!.done, action: () => navigate("wellness-exercise") },
    { id: "diet", title: "Nutrición", subtitle: "Registra tus comidas de hoy", icon: restaurantOutline, done: data.protocol.find(s => s.id === "diet")!.done, action: () => navigate("wellness-diet") },
  ];
  return (
    <WellnessFrame inbox={<>{/* Se conserva la bandeja y sus estados de generación. */}
        <section className="wh-card wh-inbox" aria-labelledby="wh-inbox-title">
          <div className="wh-card-head">
            <h2 id="wh-inbox-title">{t("Bandeja")}</h2>
          </div>
          {inboxStatus === "pending" || inboxStatus === "running" ? (
            <p className="wh-body">{t("Preparando tu bandeja")}</p>
          ) : inboxStatus === "failed" ? (
            <p className="wh-body">{t("No pudimos preparar tu bandeja")}</p>
          ) : inbox?.length ? (
            <IonList lines="full" className="wh-generation-list">
              {inbox.map((item) => {
                const date = toLocalISODate(new Date(item.createdAt));
                return (
                  <IonItem key={item.id}>
                    <IonLabel className="ion-text-wrap">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                      <time dateTime={item.createdAt}>
                        {formatDateForDisplay(date)}
                      </time>
                    </IonLabel>
                  </IonItem>
                );
              })}
            </IonList>
          ) : (
            <p className="wh-body">{t("No tienes mensajes nuevos")}</p>
          )}
        </section>

        {data.batteriesCompleted < data.batteriesTotal && (
          <section
            className="wh-card wh-batteries"
            aria-labelledby="wh-batteries-title"
          >
            <div className="wh-card-head">
              <h2 id="wh-batteries-title">{t("Cuestionarios de bienestar")}</h2>
              <span className="wh-counter">
                {t("{done} de {total}", {
                  done: String(data.batteriesCompleted),
                  total: String(data.batteriesTotal),
                })}
              </span>
            </div>
            <p className="wh-body">
              {t(
                "Complétalos a tu ritmo para personalizar mejor tu plan. No bloquean tu día.",
              )}
            </p>
            <div className="wh-progress" aria-hidden="true">
              <i
                style={{
                  width: `${(data.batteriesCompleted / data.batteriesTotal) * 100}%`,
                }}
              />
            </div>
            <IonButton
              fill="outline"
              expand="block"
              className="wh-secondary"
              onClick={openTests}
            >
              <IonIcon
                slot="start"
                icon={clipboardOutline}
                aria-hidden="true"
              />
              {t("Continuar cuestionarios")}
            </IonButton>
          </section>
        )}

    </>}>
      <section className="wh-daily" aria-labelledby="wh-protocol-title">
        <h2 id="wh-protocol-title">{t("Protocolo de hoy")}</h2>
        <IonButton fill="clear" className="wh-ring-button" onClick={() => navigate("wellness-plan")} aria-label={t("Ver mi plan de bienestar")}>
          <span className="wh-ring">
            <span className="wh-ring-copy"><span>{t("Progreso del día")}</span><strong>{percent}%</strong>
              <span className="wh-ring-count"><IonIcon icon={checkmark} aria-hidden="true" />{t("{done} de {total}", { done: String(data.protocolDone), total: String(data.protocol.length) })}</span>
            </span>
          </span>
        </IonButton>
      </section>
      <section className="wh-stats" aria-label={t("Tu progreso")}>
        <div className="wh-stat-day"><IonIcon icon={calendarOutline} aria-hidden="true" /><div>
          <strong className="wh-day">{planDay === null ? t(motorLabel) : t("Día {day} de {total}", { day: String(planDay), total: String(data.totalDays) })}</strong>
          <span>{motor.kind === "ready" ? t(motorLabel) : motor.kind === "legacy" ? `${t("Objetivo")}: ${t(GOAL_LABEL[data.plan.goal])}` : null}</span>
          {syncedDay && <time dateTime={syncedDay.todayLocalDate}>{formatLocalizedDate(syncedDay.todayLocalDate, lang)}</time>}
        </div></div>
        <div><IonIcon icon={flameOutline} aria-hidden="true" /><div><strong>{number.format(data.points)} XP</strong><span>{t("Acumulados")}</span></div></div>
        <div><IonIcon icon={flashOutline} aria-hidden="true" /><div><strong>{streak === null ? "—" : t("{count} días", { count: String(streak) })}</strong><span>{t("Racha")}</span></div></div>
      </section>
      {syncedDay?.syncedAt && syncedDay.engine_ver && syncedDay.params_version !== undefined && (
        <div className="wh-body" aria-label={t("Sincronización del Motor 365")}>
          <p><time dateTime={syncedDay.syncedAt}>{t("Última sincronización: {time}", {
            time: new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(new Date(syncedDay.syncedAt)),
          })}</time></p>
          <p>{t("Motor {engine} · Parámetros {params}", {
            engine: syncedDay.engine_ver, params: number.format(syncedDay.params_version),
          })}</p>
          {motor.kind === "ready" && motor.stale && <p role="status">{t("No se pudo actualizar el plan.")}</p>}
        </div>
      )}
      <section className="wh-task-list" aria-label={t("Actividades del día")}>
        {tasks.map(task => <IonButton key={task.id} fill="clear" className="wh-task" onClick={task.action}>
          <IonIcon className="wh-task-icon" icon={task.icon} aria-hidden="true" />
          <span className="wh-task-content"><span className="wh-task-heading"><strong>{t(task.title)}</strong><span className="wh-task-status">{t(task.id === "podcast" ? "Próximamente" : task.done ? "Completado" : "Incompleto")}</span></span>
            <span className="wh-task-subtitle">{t(task.subtitle)}</span>
            <span className="wh-task-progress"><IonProgressBar value={task.done ? 1 : 0} aria-label={t(task.title)} /><span>{task.id === "podcast" ? "—" : task.done ? "100%" : "0%"}</span></span>
          </span>
        </IonButton>)}
      </section>
      <section className="wh-card" aria-labelledby="wh-year-title">
        <div className="wh-card-head">
          <h2 id="wh-year-title">{t("Año 365")}</h2>
        </div>
        <p className="wh-body">{t("Tu calendario, resumen mensual y curvas")}</p>
        <IonButton
          expand="block"
          fill="outline"
          className="wh-secondary"
          onClick={() => navigate("wellness-year")}
        >
          <IonIcon slot="start" icon={calendarOutline} aria-hidden="true" />
          {t("Abrir Año 365")}
        </IonButton>
      </section>
        <div
          className="wh-generation-status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isReady && t("Tu plan y tu bandeja están listos")}
        </div>
        {artifacts && (isRunning || failed.length > 0) && (
          <section className="wh-card" aria-label={t("Preparación del plan")}>
            {isRunning && (
              <>
                <div className="wh-card-head">
                  <h2>{t("Estamos preparando tu plan")}</h2>
                </div>
                <IonList
                  lines="none"
                  className="wh-generation-list"
                  aria-label={t("Progreso de la generación")}
                >
                  {GENERATION_ARTIFACTS.map((id) => {
                    const artifact = artifacts[id];
                    const progress = "progress" in artifact ? artifact.progress : undefined;
                    const ready = artifact.status === "ready";
                    const failed = artifact.status === "failed";
                    const label = t(ARTIFACT_LABEL[id]);
                    return (
                      <IonItem key={id}>
                        <div className="wh-generation-row">
                          <div className="wh-generation-label">
                            <span>{label}</span>
                            <span>
                              {failed ? t("Falló") : ready ? t("Listo") : progress === undefined
                                ? t("En preparación")
                                : t("{percent}%", { percent: number.format(progress) })}
                            </span>
                          </div>
                          <IonProgressBar
                            color={
                              artifact.status === "failed"
                                ? "danger"
                                : "primary"
                            }
                            type={progress === undefined && !ready && !failed ? "indeterminate" : "determinate"}
                            value={ready ? 1 : (progress ?? 0) / 100}
                            aria-label={label}
                          />
                        </div>
                      </IonItem>
                    );
                  })}
                </IonList>
              </>
            )}
            {failed.length > 0 && (
              <>
                <div className="wh-generation-error" role="alert">
                  {failed.map((id) => (
                    <p key={id}>{t(ARTIFACT_ERROR[id])}</p>
                  ))}
                </div>
                <p className="wh-body">{t("Tus respuestas están guardadas")}</p>
                <IonButton
                  fill="outline"
                  expand="block"
                  className="wh-secondary"
                  disabled={isRunning || paidGeneration?.retrying}
                  onClick={paidGeneration?.retry ?? local.retry}
                >
                  {t("Reintentar")}
                </IonButton>
                {paidGeneration?.retryError && <p role="alert">{t("No pudimos reintentar la generación.")}</p>}
              </>
            )}
          </section>
        )}


      <WellnessPreview title="Pódcast del día" open={podcastOpen} onClose={() => setPodcastOpen(false)} icon={headsetOutline} />
      {/* KAN-167: panel único de Vita. Lo abren el orbe y el compositor de
          WellnessFrame (sin orbe flotante propio para no duplicar la entrada). */}
      <VitaEntry
        module="home"
        docked={false}
        summary={{
          day: data.day,
          totalDays: data.totalDays,
          adherencePct: data.adherencePct,
          streakDays: data.streakDays,
          level: data.level,
          protocolDone: data.protocolDone,
          protocolTotal: data.protocol.length,
        }}
      />
    </WellnessFrame>
  );
}

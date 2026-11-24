import {
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonProgressBar,
} from "@ionic/react";
import {
  barbellOutline,
  checkmarkCircle,
  clipboardOutline,
  flameOutline,
  giftOutline,
  happyOutline,
  leafOutline,
  micOutline,
  nutritionOutline,
  pulseOutline,
  ribbonOutline,
  restaurantOutline,
  shieldCheckmarkOutline,
  starOutline,
} from "ionicons/icons";
import type { Screen } from "../../../types";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { LanguageToggle } from "../../../components/LanguageToggle";
import { checkinOwner, loadCheckins } from "../checkin/checkin-store";
import { Screen as AppScreen, Scroll } from "../../../components/Screen";
import { formatDateForDisplay, toLocalISODate } from "../../../utils/dates";
import {
  GENERATION_ARTIFACTS,
  type GenerationInboxItem,
} from "../generation/generation-store";
import { useGeneration } from "../generation/useGeneration";
import {
  getWellnessHomeData,
  localISODate,
  type ProtocolStepId,
} from "../state/wellness-home-store";
import "../wellness.css";
import "./wellness-home.css";

const STEP_ICON: Record<ProtocolStepId, string> = {
  exercise: barbellOutline,
  diet: restaurantOutline,
  vitals: pulseOutline,
  emotional: happyOutline,
  chest: giftOutline,
};

/**
 * Destino provisional de cada paso mientras KAN-139/143/145/138 sustituyen los
 * módulos viejos. Evita botones muertos y se cambia en una sola tabla.
 */
const STEP_SCREEN: Record<ProtocolStepId, Screen> = {
  exercise: "protocol",
  diet: "protocol",
  vitals: "protocol",
  emotional: "protocol",
  chest: "protocol",
};

const GOAL_LABEL = {
  bajar: "Bajar de peso",
  masa: "Subir masa muscular",
  def: "Definir",
} as const;

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

export function WellnessHome() {
  const { user, navigate, openVoice, openTests } = useApp();
  const { t, lang } = useI18n();
  const data = getWellnessHomeData(user?.nombre ?? "");
  const { job, isRunning, retry } = useGeneration();
  const failed = job
    ? GENERATION_ARTIFACTS.filter((id) => job.artifacts[id].status === "failed")
    : [];
  const isReady =
    job &&
    GENERATION_ARTIFACTS.every((id) => job.artifacts[id].status === "ready");
  const closed = loadCheckins(checkinOwner(user))[localISODate(new Date())];
  const number = new Intl.NumberFormat(lang === "en" ? "en-US" : "es-ES", {
    maximumFractionDigits: 0,
  });
  const firstName =
    (data.plan.name || user?.nombre || "").trim().split(/\s+/)[0] || "";
  const nextStep = data.protocol.find((step) => !step.done) ?? data.protocol[0];

  const kpis = [
    {
      id: "adherence",
      label: t("Adherencia"),
      value: `${number.format(data.adherencePct)}%`,
      icon: shieldCheckmarkOutline,
    },
    {
      id: "points",
      label: t("Puntos"),
      value: number.format(data.points),
      icon: starOutline,
    },
    {
      id: "streak",
      label: t("Racha"),
      value:
        data.streakDays === 1
          ? t("1 día")
          : t("{count} días", { count: number.format(data.streakDays) }),
      icon: flameOutline,
    },
    {
      id: "level",
      label: t("Nivel"),
      value: number.format(data.level),
      icon: ribbonOutline,
    },
  ];

  return (
    <AppScreen>
      <Scroll className="wh-scroll">
        <header className="wh-hero">
          <div className="wh-hero-top">
            <span className="wh-brand">Copp Adresd</span>
            <LanguageToggle />
          </div>
          <p className="wh-greeting">
            {firstName ? t("Hola, {name}", { name: firstName }) : t("Hola")}
          </p>
          <div className="wh-day-row">
            <p className="wh-day">
              {t("Día")} <strong>{number.format(data.day)}</strong>{" "}
              {t("de {total}", { total: number.format(data.totalDays) })}
            </p>
            <IonBadge className="wh-goal" color="light">
              {t(GOAL_LABEL[data.plan.goal])}
            </IonBadge>
          </div>
          <IonProgressBar
            className="wh-day-progress"
            value={Math.min(1, data.day / data.totalDays)}
            aria-label={t("Progreso del plan: día {day} de {total}", {
              day: String(data.day),
              total: String(data.totalDays),
            })}
          />
          {data.isDemo && (
            <p className="wh-demo-note">
              {t("Vista previa con un plan de ejemplo.")}
            </p>
          )}
        </header>

        <div
          className="wh-generation-status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isReady && t("Tu plan y tu bandeja están listos")}
        </div>
        {job && (isRunning || failed.length > 0) && (
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
                    const artifact = job.artifacts[id];
                    const label = t(ARTIFACT_LABEL[id]);
                    return (
                      <IonItem key={id}>
                        <div className="wh-generation-row">
                          <div className="wh-generation-label">
                            <span>{label}</span>
                            <span>
                              {artifact.status === "failed"
                                ? t("Falló")
                                : t("{percent}%", {
                                    percent: number.format(artifact.progress),
                                  })}
                            </span>
                          </div>
                          <IonProgressBar
                            color={
                              artifact.status === "failed"
                                ? "danger"
                                : "primary"
                            }
                            value={artifact.progress / 100}
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
                  disabled={isRunning}
                  onClick={retry}
                >
                  {t("Reintentar")}
                </IonButton>
              </>
            )}
          </section>
        )}

        <section className="wh-kpis" aria-label={t("Tu progreso")}>
          {kpis.map((kpi) => (
            <article className="wh-kpi" key={kpi.id}>
              <IonIcon icon={kpi.icon} aria-hidden="true" />
              <strong>{kpi.value}</strong>
              <span>{kpi.label}</span>
            </article>
          ))}
        </section>

        <section
          className="wh-card wh-protocol"
          aria-labelledby="wh-protocol-title"
        >
          <div className="wh-card-head">
            <h2 id="wh-protocol-title">{t("Protocolo de hoy")}</h2>
            <span className="wh-counter" aria-live="polite">
              {t("{done}/{total}", {
                done: String(data.protocolDone),
                total: String(data.protocol.length),
              })}
            </span>
          </div>
          <ul className="wh-steps">
            {data.protocol.map((step) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={`wh-step${step.done ? " is-done" : ""}`}
                  onClick={() => navigate(STEP_SCREEN[step.id])}
                  aria-label={
                    step.done
                      ? t("{step}, completado", { step: t(step.label) })
                      : t("Ir a {step}", { step: t(step.label) })
                  }
                >
                  <span className="wh-step-ico" aria-hidden="true">
                    <IonIcon
                      icon={step.done ? checkmarkCircle : STEP_ICON[step.id]}
                    />
                  </span>
                  <span>{t(step.label)}</span>
                </button>
              </li>
            ))}
          </ul>
          <IonButton
            expand="block"
            className="wh-cta"
            onClick={() => navigate(STEP_SCREEN[nextStep.id])}
          >
            {data.protocolDone === 0
              ? t("Empezar mi día")
              : data.protocolDone >= data.protocol.length
                ? t("Día completo")
                : t("Continuar mi día")}
          </IonButton>
          <IonButton
            expand="block"
            fill="outline"
            className="wh-secondary"
            onClick={() => navigate("wellness-checkin")}
          >
            {closed ? t("Ver cierre del día") : t("Cerrar el día")}
          </IonButton>
        </section>

        <section className="wh-quick" aria-label={t("Accesos rápidos")}>
          <button
            type="button"
            className="wh-quick-btn"
            onClick={() => navigate("wellness-diet")}
          >
            <IonIcon icon={nutritionOutline} aria-hidden="true" />
            <span>{t("Nutrición")}</span>
          </button>
          <button
            type="button"
            className="wh-quick-btn"
            onClick={() => navigate("wellness-exercise")}
          >
            <IonIcon icon={barbellOutline} aria-hidden="true" />
            <span>{t("Ejercicio")}</span>
          </button>
          <button type="button" className="wh-quick-btn" onClick={openVoice}>
            <IonIcon icon={micOutline} aria-hidden="true" />
            <span>{t("Vita")}</span>
          </button>
        </section>

        <section className="wh-card wh-inbox" aria-labelledby="wh-inbox-title">
          <div className="wh-card-head">
            <h2 id="wh-inbox-title">{t("Bandeja")}</h2>
          </div>
          {job?.artifacts.inbox.status === "running" ? (
            <p className="wh-body">{t("Preparando tu bandeja")}</p>
          ) : job?.inbox.length ? (
            <IonList lines="full" className="wh-generation-list">
              {job.inbox.map((item) => {
                const [title, body] = INBOX_COPY[item.id];
                const date = toLocalISODate(new Date(item.createdAt));
                return (
                  <IonItem key={item.id}>
                    <IonLabel className="ion-text-wrap">
                      <h3>{t(title)}</h3>
                      <p>{t(body)}</p>
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

        <p className="wh-legal">
          <IonIcon icon={leafOutline} aria-hidden="true" />
          {t("Información general de bienestar. No es consejo médico.")}
        </p>
      </Scroll>
    </AppScreen>
  );
}

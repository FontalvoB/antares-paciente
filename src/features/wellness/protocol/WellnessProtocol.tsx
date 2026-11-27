import { useMemo, useState } from "react";
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonIcon,
  IonProgressBar,
} from "@ionic/react";
import {
  arrowBackOutline,
  barbellOutline,
  checkmarkCircle,
  giftOutline,
  happyOutline,
  lockClosedOutline,
  nutritionOutline,
  pulseOutline,
  starOutline,
} from "ionicons/icons";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { Screen, Scroll } from "../../../components/Screen";
import { useMotorDay } from "../calendar/useMotorDay";
import { useWellnessOverview } from "../home/useWellnessOverview";
import { closeProtocolDay, submitProtocolStep } from "./protocol-rewards-api";
import { checkinKey, checkinOwner, loadCheckins } from "../checkin/checkin-store";
import {
  completeProtocolStep,
  localISODate,
  type ProtocolStepId,
} from "../state/wellness-home-store";
import "../wellness.css";
import "./wellness-protocol.css";
import { VitaEntry } from "../vita";

const STEP_META: Record<
  ProtocolStepId,
  {
    icon: string;
    description: string;
    module?: "wellness-diet" | "wellness-exercise" | "wellness-vitals";
  }
> = {
  exercise: {
    icon: barbellOutline,
    description:
      "Muévete con la sesión de hoy. Si hoy toca una versión suave, también cuenta.",
    module: "wellness-exercise",
  },
  diet: {
    icon: nutritionOutline,
    description: "Sigue tu plan de comidas y registra el agua del día.",
    module: "wellness-diet",
  },
  vitals: {
    icon: pulseOutline,
    description: "Registra tus signos vitales de hoy, si te los tomaste.",
    module: "wellness-vitals",
  },
  emotional: {
    icon: happyOutline,
    description: "Un chequeo corto de cómo te sientes. Sin juicios.",
  },
  chest: {
    icon: giftOutline,
    description: "Se abre cuando completas los otros cuatro pasos del día.",
  },
};

const MOODS = [
  { id: "good", label: "Bien" },
  { id: "ok", label: "Normal" },
  { id: "low", label: "Bajo" },
] as const;

export function WellnessProtocol() {
  const { user, navigate, showToast } = useApp();
  const { t } = useI18n();
  const [chestOpen, setChestOpen] = useState(false);
  const [chestXp, setChestXp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const data = useWellnessOverview(user?.nombre ?? "");
  const { account, snapshot, unavailable, refresh } = data.rewards;
  const ready = !account || Boolean(snapshot);
  const chestUnlocked = data.protocolDone >= 4;
  const motor = useMotorDay();
  const remote = motor.kind === "ready" ? motor.day : undefined;
  const day = remote?.today ?? (motor.kind === "legacy" ? data.day : null);
  const closed = account ? snapshot?.today.closed || remote?.logStatus === "recorded"
    : Boolean(loadCheckins(checkinOwner(user))[checkinKey(localISODate(new Date()))]);
  const chestDone =
    data.protocol.find((step) => step.id === "chest")?.done ?? false;
  const missing = useMemo(
    () =>
      data.protocol
        .filter((step) => step.id !== "chest" && !step.done)
        .map((step) => step.id),
    [data],
  );

  const complete = async (id: ProtocolStepId) => {
    if (account) {
      if (busy || closed || !snapshot || snapshot.today.steps[id] !== undefined) return;
      setBusy(true);
      try {
        const updated = await submitProtocolStep(account, snapshot.today.localDate, id);
        if (!updated.receipt?.created) return;
        const points = updated.receipt.amount;
        if (id === "chest") {
          setChestXp(points);
          setChestOpen(true);
        } else if (points > 0) {
          showToast(t("+{points} puntos", { points: String(points) }), "ok");
        }
      } catch {
        refresh();
        showToast(t("No pudimos guardar el paso. Inténtalo de nuevo."), "warn");
      } finally {
        setBusy(false);
      }
      return;
    }
    const result = completeProtocolStep(id);
    if (!result.completed) {
      if (id === "chest" && !result.chestUnlocked) {
        showToast(t("Completa los otros pasos para abrir el cofre."), "warn");
      } else {
        showToast(t("Ese paso ya está completo hoy."), "info");
      }
      return;
    }
    if (id === "chest") {
      setChestXp(result.pointsEarned);
      setChestOpen(true);
    } else if (result.dayComplete) {
      showToast(t("Día completo. Ganaste el bonus de secuencia."), "ok");
    } else {
      showToast(t("+{points} puntos", { points: "10" }), "ok");
    }
  };

  const close = async () => {
    if (!account || motor.kind !== "unlinked") { navigate("wellness-checkin"); return; }
    if (busy || closed || !snapshot) return;
    setBusy(true);
    try { await closeProtocolDay(account, snapshot.today.localDate); }
    catch {
      refresh();
      showToast(t("No se pudo guardar el cierre. Inténtalo de nuevo."), "warn");
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Scroll className="wp-scroll">
        <header className="wp-hero">
          <div className="wp-hero-top">
            <IonButton
              className="wp-back"
              fill="outline"
              onClick={() => navigate("home")}
              aria-label={t("Volver al inicio")}
            >
              <IonIcon icon={arrowBackOutline} slot="icon-only" aria-hidden="true" />
            </IonButton>
            <div>
              <p className="wp-eyebrow">{t("Protocolo diario")}</p>
              <h1 className="wp-title">{t("Tu día de bienestar")}</h1>
            </div>
            <IonBadge className="wp-day" color="light">
              {day === null ? t("Día del plan no disponible") : t("Día {day}", { day: String(day) })}
            </IonBadge>
          </div>
          <div className="wp-progress-row">
            <span>
              {t("{done} de {total} pasos", {
                done: String(data.protocolDone),
                total: String(data.protocol.length),
              })}
            </span>
            <span className="wp-points">
              <IonIcon icon={starOutline} aria-hidden="true" />
              {ready ? t("{points} puntos", { points: String(data.points) }) : "—"}
            </span>
          </div>
          <IonProgressBar
            value={data.protocolDone / data.protocol.length}
            className="wp-progress"
            aria-label={t("Progreso del protocolo")}
          />
        </header>

        {unavailable && <section className="wp-card">
          <p role="status">{t("No pudimos cargar el protocolo. Inténtalo de nuevo.")}</p>
          <IonButton fill="clear" onClick={refresh}>{t("Actualizar")}</IonButton>
        </section>}

        <ol className="wp-steps">
          {data.protocol.map((step, index) => {
            const meta = STEP_META[step.id];
            const isChest = step.id === "chest";
            const locked = isChest && !chestUnlocked && !step.done;
            return (
              <li
                className={`wp-card${step.done ? " is-done" : ""}`}
                key={step.id}
              >
                <div className="wp-step-head">
                  <span className="wp-step-ico" aria-hidden="true">
                    <IonIcon icon={step.done ? checkmarkCircle : meta.icon} />
                  </span>
                  <div className="wp-step-body">
                    <h2>
                      {index + 1}. {t(step.label)}
                    </h2>
                    <p>{t(meta.description)}</p>
                  </div>
                  {step.done && <span className="wp-done">{t("Hecho")}</span>}
                </div>

                {isChest && locked && (
                  <p className="wp-note wp-note-warn" role="status">
                    <IonIcon icon={lockClosedOutline} aria-hidden="true" />
                    {t("Falta completar: {steps}", {
                      steps: missing.map((id) => t(labelsFor(id))).join(", "),
                    })}
                  </p>
                )}

                {step.id === "emotional" && !step.done && (
                  <div
                    className="wp-moods"
                    role="group"
                    aria-labelledby="wp-moods-label"
                  >
                    <span className="wp-moods-label" id="wp-moods-label">
                      {t("¿Cómo te sientes hoy?")}
                    </span>
                    <div className="wp-mood-row">
                      {MOODS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`wp-mood${mood === option.id ? " is-selected" : ""}`}
                          aria-pressed={mood === option.id}
                          disabled={!ready || busy || closed}
                          onClick={() => {
                            setMood(option.id);
                            complete("emotional");
                          }}
                        >
                          {t(option.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="wp-actions">
                  {!step.done && (
                    <IonButton
                      expand="block"
                      className="wp-primary"
                      disabled={locked || !ready || busy || closed}
                      onClick={() => complete(step.id)}
                    >
                      {isChest
                        ? locked
                          ? t("Cofre bloqueado")
                          : t("Abrir mi cofre")
                        : t("Marcar como hecho")}
                    </IonButton>
                  )}
                  {step.id === "exercise" && !step.done && (
                    <IonButton
                      fill="clear"
                      color="primary"
                      expand="block"
                      className="wp-secondary"
                      disabled={!ready || busy || closed}
                      onClick={() => void complete("exercise")}
                    >
                      {t("Hice la versión reducida")}
                    </IonButton>
                  )}
                  {meta.module && (!step.done || step.id === "diet" || step.id === "vitals") && (
                    <IonButton
                      fill="clear"
                      color="primary"
                      expand="block"
                      className="wp-secondary"
                      style={step.id === "vitals" ? { minHeight: 44 } : undefined}
                      onClick={() => navigate(meta.module!)}
                    >
                      {t(step.id === "vitals" ? "Abrir signos vitales" : "Abrir módulo")}
                    </IonButton>
                  )}
                  {isChest && chestDone && (
                    <p className="wp-chest-done">
                      <IonIcon icon={giftOutline} aria-hidden="true" />
                      {t("Cofre abierto hoy. Vuelve mañana.")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {data.protocolDone >= data.protocol.length && (
          <section className="wp-day-complete" role="status">
            <IonIcon icon={checkmarkCircle} aria-hidden="true" />
            <div>
              <strong>{t("Día completo")}</strong>
              <p>
                {account && !closed
                  ? t("El bonus de secuencia se suma al cerrar el día.")
                  : t("Tu secuencia sigue viva. El bonus de cierre ya está sumado.")}
              </p>
            </div>
          </section>
        )}

        {(chestDone || closed) && (!account || remote || !closed) && (
          <IonButton expand="block" className="wp-primary" disabled={busy} onClick={() => void close()}>
            {closed ? t("Ver cierre del día") : t("Cerrar el día")}
          </IonButton>
        )}

        <p className="wp-legal">
          {t("Información general de bienestar. Consulta a un profesional de la salud para recibir orientación personal.")}
        </p>
      </Scroll>

      <IonAlert
        isOpen={chestOpen}
        onDidDismiss={() => setChestOpen(false)}
        header={t("¡Cofre abierto!")}
        message={t("+{points} puntos", { points: String(chestXp) })}
        buttons={[
          {
            text: t("Seguir"),
            handler: () => setChestOpen(false),
          },
        ]}
      />
      <VitaEntry
        module="protocol"
        summary={{
          day: data.day,
          protocolDone: data.protocolDone,
          protocolTotal: data.protocol.length,
          pendingSteps: missing.join(","),
          chestUnlocked,
          closedToday: Boolean(closed),
        }}
      />
    </Screen>
  );
}

/** Etiqueta del paso a partir de su id (para el aviso de cofre bloqueado). */
function labelsFor(id: ProtocolStepId): string {
  switch (id) {
    case "exercise":
      return "Ejercicio";
    case "diet":
      return "Dieta";
    case "vitals":
      return "Vitales";
    case "emotional":
      return "Emocional";
    default:
      return "Cofre";
  }
}

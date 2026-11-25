import { BRAND_NAME } from "../../../utils/brand";
import { useEffect, useMemo, useRef, useState } from "react";
import { IonBadge, IonButton, IonIcon } from "@ionic/react";
import {
  arrowForwardOutline,
  checkmarkCircleOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { Screen } from "../../../components/Screen";
import { ObjectiveWizard } from "../components/objective";
import { buildPlanPreview, evaluateGate } from "../domain";
import type { GateResult, ObjectiveDraft, WellnessGoal } from "../domain";
import {
  TOTAL_PLAN_DAYS,
  loadPlanSnapshot,
  planDay,
} from "../state/wellness-home-store";
import {
  changePlanObjective,
  draftFromSnapshot,
  type GoalChangeResult,
  type PlanDiffField,
  type PlanDiffRow,
} from "../state/goal-change";
import "../wellness.css";

type Stage = "confirm" | "form" | "done";

const GOAL_LABEL: Record<WellnessGoal, string> = {
  bajar: "Bajar de peso",
  masa: "Subir masa muscular",
  def: "Definir",
};

const DIFF_LABEL: Record<PlanDiffField, string> = {
  goal: "Objetivo",
  kcal: "Energía",
  proteinG: "Proteína",
  carbsG: "Carbohidratos",
  fatG: "Grasas",
};

const DIFF_UNIT: Record<Exclude<PlanDiffField, "goal">, string> = {
  kcal: "kcal",
  proteinG: "g",
  carbsG: "g",
  fatG: "g",
};

/**
 * KAN-144 — cambiar objetivo desde Perfil. Genera una nueva versión del plan
 * sin reiniciar el día ni borrar puntos, racha, protocolo o mediciones.
 */
export function WellnessGoalPage() {
  const { user, navigate, showToast } = useApp();
  const { t, lang } = useI18n();
  const [current] = useState(() => loadPlanSnapshot());
  const [stage, setStage] = useState<Stage>("confirm");
  const [draft, setDraft] = useState<ObjectiveDraft>(() =>
    draftFromSnapshot(current, user?.nombre ?? ""),
  );
  const [gate, setGate] = useState<GateResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GoalChangeResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const day = current ? planDay(current.startDate) : 1;
  const format = useMemo(
    () => new Intl.NumberFormat(lang === "en" ? "en-US" : "es-ES"),
    [lang],
  );
  const dayParams = {
    day: format.format(day),
    total: format.format(TOTAL_PLAN_DAYS),
  };

  useEffect(() => {
    // Cada etapa arranca arriba y el foco va al título para lectores de pantalla.
    scrollRef.current?.scrollTo?.({ top: 0 });
    if (stage !== "form") titleRef.current?.focus();
  }, [stage]);

  const changeDraft = (patch: Partial<ObjectiveDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    if (gate) setGate(null);
  };

  const generate = () => {
    setGenerating(true);
    try {
      const localGate = evaluateGate(draft);
      if (!localGate.ok) {
        setGate(localGate);
        showToast(t("Revisa lo que falta para generar tu plan."), "warn");
        return;
      }
      const preview = buildPlanPreview(draft);
      if (!preview) {
        showToast(t("No pudimos generar tu plan. Intenta de nuevo."), "err");
        return;
      }
      setGate(localGate);
      setResult(changePlanObjective(draft, preview));
      setStage("done");
    } catch {
      showToast(t("No pudimos generar tu plan. Intenta de nuevo."), "err");
    } finally {
      setGenerating(false);
    }
  };

  const formatValue = (
    field: PlanDiffField,
    value: PlanDiffRow["before"],
  ): string => {
    if (value === null) return "—";
    if (field === "goal") return t(GOAL_LABEL[value as WellnessGoal]);
    return `${format.format(value as number)} ${DIFF_UNIT[field]}`;
  };

  const title =
    stage === "done"
      ? t("Tu plan se actualizó")
      : stage === "form"
        ? t("Actualiza tu objetivo")
        : t("Cambiar objetivo");

  return (
    <Screen hideNav className="onb-page">
      <header className="onb-head">
        <div className="onb-head-top">
          <div className="onb-head-brand">{BRAND_NAME}</div>
        </div>
        <h1 className="onb-head-title" ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
        <p className="onb-head-sub">
          {t("Sigues en el día {day} de {total}.", dayParams)}
        </p>
      </header>

      <div className="screen-scroll no-nav onb-body" ref={scrollRef}>
        <div className="onb-stack" key={stage}>
          {stage === "confirm" && (
            <section
              className="wl-summary"
              aria-labelledby="wl-goal-confirm-title"
            >
              <header className="wl-step-head">
                {current && (
                  <div className="wl-chips">
                    <IonBadge color="primary">
                      {t("Objetivo actual: {goal}", {
                        goal: t(GOAL_LABEL[current.goal]),
                      })}
                    </IonBadge>
                  </div>
                )}
                <h2 id="wl-goal-confirm-title" className="wl-title">
                  {t("Antes de cambiar tu objetivo")}
                </h2>
              </header>
              <ul className="wl-summary" style={{ margin: 0, padding: 0 }}>
                {[
                  t("Se genera un plan nuevo con tu objetivo actualizado."),
                  t("Tu historial, tus puntos y tu racha se conservan."),
                  t(
                    "Sigues en el día {day} de {total}; el plan no vuelve a empezar.",
                    dayParams,
                  ),
                ].map((line) => (
                  <li
                    key={line}
                    className="wl-note wl-note-info"
                    style={{ listStyle: "none" }}
                  >
                    <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="wl-sub">
                {t(
                  "Tus datos actuales ya están cargados. Volverás a responder las preguntas de seguridad y a aceptar el aviso de bienestar.",
                )}
              </p>
              <div className="wl-footer wl-footer-stack">
                <IonButton
                  expand="block"
                  style={{ minHeight: 48 }}
                  onClick={() => setStage("form")}
                >
                  {t("Cambiar objetivo")}
                  <IonIcon
                    slot="end"
                    icon={arrowForwardOutline}
                    aria-hidden="true"
                  />
                </IonButton>
                <IonButton
                  expand="block"
                  fill="clear"
                  style={{ minHeight: 48, "--color": "var(--teal-d)" }}
                  onClick={() => navigate("prof")}
                >
                  {t("Cancelar")}
                </IonButton>
              </div>
            </section>
          )}

          {stage === "form" && (
            <ObjectiveWizard
              draft={draft}
              onChange={changeDraft}
              gate={gate}
              generating={generating}
              onGenerate={generate}
              onExit={() => setStage("confirm")}
            />
          )}

          {stage === "done" && result && (
            <section
              className="wl-summary"
              aria-labelledby="wl-goal-done-title"
            >
              <header className="wl-step-head">
                <div className="wl-chips">
                  <IonBadge color="primary">
                    {t("Versión {version}", {
                      version: format.format(result.next.version),
                    })}
                  </IonBadge>
                </div>
                <h2 id="wl-goal-done-title" className="wl-title">
                  {t("Esto cambió en tu plan")}
                </h2>
                <p className="wl-sub">
                  {t(
                    "Tu historial y tus puntos se conservaron. Los valores son estimados.",
                  )}
                </p>
              </header>
              <dl className="wl-kpi-grid" style={{ margin: 0 }}>
                {result.diff.map((row) => (
                  <div key={row.field} className="wl-kpi">
                    <dt>
                      <span>{t(DIFF_LABEL[row.field])}</span>
                    </dt>
                    <dd style={{ margin: 0 }}>
                      <strong>{formatValue(row.field, row.after)}</strong>
                      <span>
                        {row.changed
                          ? t("Antes: {value}", {
                              value: formatValue(row.field, row.before),
                            })
                          : t("Sin cambios")}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="wl-footer">
                <IonButton
                  expand="block"
                  style={{ minHeight: 48 }}
                  onClick={() => navigate("home")}
                >
                  {t("Ir al inicio")}
                  <IonIcon
                    slot="end"
                    icon={arrowForwardOutline}
                    aria-hidden="true"
                  />
                </IonButton>
              </div>
            </section>
          )}

          <div className="wl-note wl-note-info" style={{ marginTop: 16 }}>
            <IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />
            <span>
              {t(
                "Información general de bienestar. Consulta a un profesional de la salud para recibir orientación personal. En una emergencia llama al 911.",
              )}
            </span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

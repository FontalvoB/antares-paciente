import { IonButton, IonIcon, IonProgressBar } from "@ionic/react";
import { arrowBackOutline, arrowForwardOutline, clipboardOutline, compassOutline, fitnessOutline, heartOutline, leafOutline, personOutline, restaurantOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../../../../i18n/I18nContext";
import { OBJECTIVE_STEP, evaluateGate } from "../../domain";
import type { GateIssue, GateResult, ObjectiveDraft, WellnessGoal } from "../../domain";
import { loadUnitPrefs } from "../../vitals/unit-prefs";
import { GateNotice } from "./GateNotice";
import { ActivityStep } from "./steps/ActivityStep";
import { DataStep, dataIssues, issueParams, readMeasurements } from "./steps/DataStep";
import { GenerateAction, GenerateStep } from "./steps/GenerateStep";
import { GoalStep } from "./steps/GoalStep";
import { NqsStep } from "./steps/NqsStep";
import { ParqStep } from "./steps/ParqStep";
import { PreferencesStep } from "./steps/PreferencesStep";
import { TermsStep, currentAcceptance, readTerms } from "./steps/TermsStep";
import "../../wellness.css";

const STEP_TITLES = {
  [OBJECTIVE_STEP.goal]: "Tu objetivo",
  [OBJECTIVE_STEP.data]: "Tus datos",
  [OBJECTIVE_STEP.activity]: "Actividad y ritmo",
  [OBJECTIVE_STEP.preferences]: "Preferencias de alimentación",
  [OBJECTIVE_STEP.parq]: "Seguridad del ejercicio",
  [OBJECTIVE_STEP.nqs]: "Seguridad de la nutrición",
  [OBJECTIVE_STEP.terms]: "Términos y aviso de bienestar",
  [OBJECTIVE_STEP.generate]: "Revisa tus elecciones",
} as const;

const TOTAL_STEPS = OBJECTIVE_STEP.generate + 1;
const STEP_ICONS = [compassOutline, personOutline, fitnessOutline, leafOutline,
  heartOutline, restaurantOutline, shieldCheckmarkOutline, clipboardOutline];
const STEP_TONES = ["teal", "blue", "violet", "green", "violet", "green", "amber", "blue"];
const PAID_STEP_INTRO = [
  "Empieza por la meta que quieres trabajar con tu plan de bienestar.",
  "Usamos tus medidas para ajustar el plan a tu punto de partida.",
  "Tu actividad habitual nos ayuda a elegir un punto de partida.",
  "Puedes marcar varias preferencias o continuar sin elegir ninguna.",
  "Estas preguntas ayudan a saber si necesitas orientación antes de hacer ejercicio.",
  "Estas preguntas ayudan a saber si necesitas orientación antes de cambiar tu alimentación.",
  "Revisa el aviso y confirma si estás de acuerdo antes de continuar.",
  "Comprueba los datos que usaremos para preparar tus planes.",
] as const;

function getLocalGate(draft: ObjectiveDraft): GateResult {
  const { issues } = evaluateGate({
    ...draft,
    parq: Array.from(draft.parq, (answer) => answer === 0 || answer === 1 ? answer : null),
    nqs: Array.from(draft.nqs, (answer) => answer === 0 || answer === 1 ? answer : null),
  });
  const validated = [
    ...issues.filter((issue) => issue.step !== OBJECTIVE_STEP.data),
    ...dataIssues(draft, issues),
  ];
  if (draft.pace !== "s" && draft.pace !== "m") {
    validated.push({
      code: "unanswered",
      step: OBJECTIVE_STEP.activity,
      field: "pace",
      messageKey: "Elige un ritmo suave o moderado.",
    });
  }
  if (!currentAcceptance(draft.terms) && !validated.some((issue) => issue.field === "terms")) {
    validated.push({
      code: "terms",
      step: OBJECTIVE_STEP.terms,
      field: "terms",
      messageKey: "Acepta la versión vigente de los términos y el aviso de bienestar.",
    });
  }
  return { ok: validated.length === 0, issues: validated };
}

export function ObjectiveWizard({ draft, onChange, gate, generating, onGenerate, onExit, unitOwner, allowedGoals, presentation }: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  gate: GateResult | null;
  generating: boolean;
  onGenerate: () => void;
  onExit?: () => void;
  /** Propietario de las preferencias de unidades; por defecto el email del draft. */
  unitOwner?: string;
  allowedGoals?: readonly WellnessGoal[];
  presentation?: "paid";
}) {
  const { t, lang } = useI18n();
  const prefs = loadUnitPrefs(unitOwner ?? (draft.email || "local"), lang);
  const headingId = useId();
  const errorId = useId();
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [navigation, setNavigation] = useState<{ step: number; field?: string }>({
    step: OBJECTIVE_STEP.goal,
  });
  const [error, setError] = useState<GateIssue | null>(null);
  const [dismissedGate, setDismissedGate] = useState<GateResult | null>(null);
  const paid = presentation === "paid";
  const { step } = navigation;
  const localGate = getLocalGate(draft);
  const reportedGate = gate && !gate.ok && gate !== dismissedGate ? gate : null;
  const finalGate = reportedGate
    ? {
        ...reportedGate,
        issues: [
          ...reportedGate.issues,
          ...localGate.issues.filter((issue) => !reportedGate.issues.some(
            (item) => item.step === issue.step && item.field === issue.field && item.messageKey === issue.messageKey,
          )),
        ],
      }
    : localGate;

  useEffect(() => {
    const field = error?.field ?? navigation.field;
    const control = field
      ? Array.from(content.current?.querySelectorAll<HTMLElement>("[data-wl-field]") ?? [])
          .find((element) => element.dataset.wlField === field)
      : undefined;

    if (
      control &&
      "getInputElement" in control && typeof control.getInputElement === "function" &&
      "setFocus" in control && typeof control.setFocus === "function"
    ) {
      let active = true;
      const focus = control.setFocus.bind(control);
      void Promise.resolve(control.getInputElement()).then(() => {
        if (active) void focus();
      });
      return () => { active = false; };
    }

    if (control) {
      const target = control.matches("button, ion-checkbox")
        ? control
        : control.querySelector<HTMLElement>("button");
      (target ?? heading.current)?.focus();
    } else if (paid) {
      const scroller = heading.current?.closest<HTMLElement>(".screen-scroll");
      if (scroller) scroller.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    } else {
      heading.current?.focus();
    }
  }, [navigation, error, paid]);

  const goToStep = (nextStep: number, field?: string) => {
    if (generating || !Number.isInteger(nextStep) || nextStep < 0 || nextStep > OBJECTIVE_STEP.generate) return;
    setError(null);
    setNavigation({ step: nextStep, field });
  };

  const changeDraft = (patch: Partial<ObjectiveDraft>) => {
    // A generation response describes the draft that was submitted.
    setDismissedGate(gate);
    onChange(patch);
  };

  const goForward = () => {
    // Ionic puede actualizar el control antes de entregar su evento a React.
    const patch = step === OBJECTIVE_STEP.data && content.current
      ? readMeasurements(content.current, draft, prefs)
      : {};
    const terms = content.current?.querySelector<HTMLIonCheckboxElement>('ion-checkbox[data-wl-field="terms"]');
    if (terms && typeof terms.checked === "boolean") {
      const acceptance = readTerms(terms.checked, draft.terms);
      if (acceptance !== draft.terms) patch.terms = acceptance;
    }
    if (Object.keys(patch).length) changeDraft(patch);
    const issue = getLocalGate({ ...draft, ...patch }).issues.find((item) => item.step === step);
    if (issue) {
      setError({ ...issue });
      return;
    }
    goToStep(step + 1);
  };

  const visibleError = error && localGate.issues.find(
    (issue) => issue.field === error.field && issue.step === error.step,
  );
  const bmiIssue = step === OBJECTIVE_STEP.data
    ? localGate.issues.find((issue) => issue.code === "bmi")
    : undefined;
  const count = t("Paso {current} de {total}", {
    current: String(step + 1),
    total: String(TOTAL_STEPS),
  });
  const stepProps = { draft, onChange: changeDraft, invalidField: visibleError?.field, errorId };

  const title = t(STEP_TITLES[step as keyof typeof STEP_TITLES]);
  const icon = <span className="wl-step-icon"><IonIcon icon={STEP_ICONS[step]} aria-hidden="true" /></span>;
  const progress = {
    role: "progressbar", "aria-label": t("Progreso del objetivo"), "aria-valuemin": 1,
    "aria-valuemax": TOTAL_STEPS, "aria-valuenow": step + 1, "aria-valuetext": count,
  };

  return (
    <section className={`wl-wizard${paid ? " wl-wizard--paid" : ""}`} data-tone={STEP_TONES[step]} aria-labelledby={headingId}>
      {paid ? (
        <>
          <div className="wl-paid-progress" {...progress}>
            <span className="wl-step-count" aria-hidden="true">{count}</span>
            <IonProgressBar value={(step + 1) / TOTAL_STEPS} aria-hidden="true" />
          </div>
          <div className="wl-paid-heading">
            {icon}
            <h1 ref={heading} id={headingId} className="wl-title" tabIndex={-1}>{title}</h1>
            <p>{t(PAID_STEP_INTRO[step])}</p>
          </div>
        </>
      ) : (
        <>
          <div className="wl-step-head">
            {icon}
            <div>
              <span className="wl-step-count" aria-hidden="true">{count}</span>
              <h2 ref={heading} id={headingId} className="wl-title" tabIndex={-1}>{title}</h2>
            </div>
          </div>
          <div className="wl-progress" {...progress}>
            <i style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
          </div>
        </>
      )}

      {visibleError && (
        <p id={errorId} className="wl-note wl-note-danger" role="alert">
          {t(visibleError.messageKey, issueParams(visibleError, lang, prefs))}
        </p>
      )}

      <div ref={content} className="wl-content">
        {step === OBJECTIVE_STEP.goal && <GoalStep {...stepProps} allowedGoals={allowedGoals} />}
        {step === OBJECTIVE_STEP.data && <DataStep {...stepProps} prefs={prefs} />}
        {step === OBJECTIVE_STEP.activity && <ActivityStep {...stepProps} />}
        {step === OBJECTIVE_STEP.preferences && <PreferencesStep {...stepProps} />}
        {step === OBJECTIVE_STEP.parq && <ParqStep {...stepProps} showAnswerCount={paid} />}
        {step === OBJECTIVE_STEP.nqs && <NqsStep {...stepProps} showAnswerCount={paid} />}
        {step === OBJECTIVE_STEP.terms && <TermsStep {...stepProps} />}
        {step === OBJECTIVE_STEP.generate && (
          <>
            <GateNotice
              prefs={prefs}
              gate={finalGate}
              onGoToStep={(target) => {
                const field = finalGate.issues.find((issue) => issue.step === target)?.field;
                goToStep(target, field);
              }}
            />
            <GenerateStep draft={draft} generating={generating} blocked={!finalGate.ok} onGenerate={onGenerate} hideAction={paid} prefs={prefs} />
          </>
        )}
      </div>
      {bmiIssue && (
        <GateNotice gate={{ ok: false, issues: [bmiIssue] }} onGoToStep={(target) => goToStep(target, bmiIssue.field)} prefs={prefs} />
      )}

      <div className="wl-footer">
        {(step !== OBJECTIVE_STEP.goal || onExit) && (
          <IonButton
            type="button"
            fill="clear"
            className={paid ? "wl-back" : undefined}
            style={paid ? undefined : { minHeight: 48, "--color": "var(--teal-d)", "--background-focused": "var(--teal-l)" }}
            disabled={generating}
            onClick={step === OBJECTIVE_STEP.goal ? onExit : () => goToStep(step - 1)}
          >
            <IonIcon slot="start" icon={arrowBackOutline} aria-hidden="true" />
            {t("Volver")}
          </IonButton>
        )}
        {step !== OBJECTIVE_STEP.generate && (
          <IonButton type="button" className="cta-pill" onClick={goForward}>
            {t("Continuar")}
            <IonIcon slot="end" icon={arrowForwardOutline} aria-hidden="true" />
          </IonButton>
        )}
        {paid && step === OBJECTIVE_STEP.generate && (
          <GenerateAction generating={generating} blocked={!finalGate.ok} onGenerate={onGenerate} />
        )}
      </div>
    </section>
  );
}

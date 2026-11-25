import { IonButton } from "@ionic/react";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../../../../i18n/I18nContext";
import { OBJECTIVE_STEP, evaluateGate } from "../../domain";
import type { GateIssue, GateResult, ObjectiveDraft } from "../../domain";
import { loadUnitPrefs } from "../../vitals/unit-prefs";
import { GateNotice } from "./GateNotice";
import { ActivityStep } from "./steps/ActivityStep";
import { DataStep, dataIssues, issueParams } from "./steps/DataStep";
import { GenerateStep } from "./steps/GenerateStep";
import { GoalStep } from "./steps/GoalStep";
import { NqsStep } from "./steps/NqsStep";
import { ParqStep } from "./steps/ParqStep";
import { PreferencesStep } from "./steps/PreferencesStep";
import { TermsStep, currentAcceptance } from "./steps/TermsStep";
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

export function ObjectiveWizard({ draft, onChange, gate, generating, onGenerate, onExit, unitOwner }: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  gate: GateResult | null;
  generating: boolean;
  onGenerate: () => void;
  onExit: () => void;
  unitOwner?: string;
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
    } else {
      heading.current?.focus();
    }
  }, [navigation, error]);

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
    const issue = localGate.issues.find((item) => item.step === step);
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

  return (
    <section aria-labelledby={headingId}>
      <div className="wl-step-head">
        <span className="wl-step-count" aria-hidden="true">{count}</span>
        <h2 ref={heading} id={headingId} className="wl-title" tabIndex={-1}>
          {t(STEP_TITLES[step as keyof typeof STEP_TITLES])}
        </h2>
      </div>
      <div
        className="wl-progress"
        role="progressbar"
        aria-label={t("Progreso del objetivo")}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step + 1}
        aria-valuetext={count}
      >
        <i style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
      </div>

      {visibleError && (
        <p id={errorId} className="wl-note wl-note-danger" role="alert">
          {t(visibleError.messageKey, issueParams(visibleError, lang, prefs))}
        </p>
      )}

      <div ref={content}>
        {step === OBJECTIVE_STEP.goal && <GoalStep {...stepProps} />}
        {step === OBJECTIVE_STEP.data && <DataStep {...stepProps} prefs={prefs} />}
        {step === OBJECTIVE_STEP.activity && <ActivityStep {...stepProps} />}
        {step === OBJECTIVE_STEP.preferences && <PreferencesStep {...stepProps} />}
        {step === OBJECTIVE_STEP.parq && <ParqStep {...stepProps} />}
        {step === OBJECTIVE_STEP.nqs && <NqsStep {...stepProps} />}
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
            <GenerateStep draft={draft} generating={generating} blocked={!finalGate.ok} onGenerate={onGenerate} prefs={prefs} />
          </>
        )}
      </div>
      {bmiIssue && (
        <GateNotice gate={{ ok: false, issues: [bmiIssue] }} onGoToStep={(target) => goToStep(target, bmiIssue.field)} prefs={prefs} />
      )}

      <div className="wl-footer">
        <IonButton
          type="button"
          fill="clear"
          style={{ minHeight: 48, "--color": "var(--teal-d)", "--background-focused": "var(--teal-l)" }}
          disabled={generating}
          onClick={step === OBJECTIVE_STEP.goal ? onExit : () => goToStep(step - 1)}
        >
          {t("Volver")}
        </IonButton>
        {step !== OBJECTIVE_STEP.generate && (
          <IonButton type="button" className="cta-pill" onClick={goForward}>
            {t("Continuar")}
          </IonButton>
        )}
      </div>
    </section>
  );
}

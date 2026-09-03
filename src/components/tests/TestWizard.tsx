import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IonButton, IonIcon, IonProgressBar, IonTextarea } from "@ionic/react";
import {
  arrowBackOutline,
  checkmarkCircle,
  chevronBack,
  chevronForward,
  sparkles,
  timeOutline,
} from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
import {
  isNoneLabel,
  itemTint,
  optionEmoji,
  sectionTone,
  type TestTheme,
  type WizardStep,
} from "./model";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface WizardExtras {
  openNotes: string[];
  onOpenNote: (i: number, value: string) => void;
}

export function TestWizard({
  theme,
  steps,
  answers,
  extras,
  onScale,
  onNum,
  onBackendMulti,
  onComplete,
}: {
  theme: TestTheme;
  steps: WizardStep[];
  answers: Record<number, number | number[] | string>;
  extras: WizardExtras;
  onScale: (index: number, value: number) => void;
  onNum: (index: number, value: number) => void;
  onBackendMulti: (index: number, option: number) => void;
  onComplete: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const questionSteps = steps.filter((s) => s.kind !== "intro").length;
  const questionIndex = Math.max(
    0,
    step - (steps[0]?.kind === "intro" ? 1 : 0),
  );
  const progress = steps.length <= 1 ? 1 : step / (steps.length - 1);

  const answered = useMemo(
    () => isStepAnswered(current, answers, extras),
    [current, answers, extras],
  );

  useEffect(() => {
    setStep(0);
    setDir(1);
  }, [steps]);

  // Fidelidad al HTML: la pregunta num responde con su valor por defecto en
  // cuanto se muestra (el stepper parte de ahí), sin exigir tocar +/−.
  useEffect(() => {
    if (current?.kind === "num" && typeof answers[current.index] !== "number") {
      onNum(current.index, current.def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  const go = (next: number) => {
    if (next < 0 || next >= steps.length) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const selectScale = (index: number, value: number) => {
    onScale(index, value);
    void tapHaptic();
    if (!isLast) {
      window.setTimeout(() => go(step + 1), reduce ? 0 : 380);
    }
  };

  const continueNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    go(step + 1);
  };

  const canContinue =
    current?.kind === "intro" ||
    current?.kind === "multi" ||
    current?.kind === "open" ||
    answered;

  return (
    <div className={`ht-wizard mood-${theme.mood}`}>
      {current?.kind !== "intro" && (
        <div className="ht-progress">
          <span>
            {t("Pregunta {n} de {total}", {
              n: String(Math.min(questionIndex + 1, questionSteps)),
              total: String(questionSteps),
            })}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      )}
      {current?.kind !== "intro" && (
        <IonProgressBar
          className="pb ht-bar"
          style={
            {
              "--background": "var(--ht-track)",
              "--progress-background": theme.accent,
            } as CSSProperties
          }
          value={progress}
        />
      )}

      <div className="ht-stage">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={current?.key ?? step}
            className="ht-step"
            custom={dir}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, x: dir * 36, scale: 0.98 }
            }
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, x: dir * -28, scale: 0.98 }
            }
            transition={{ duration: reduce ? 0.12 : 0.34, ease: EASE }}
          >
            {current && (
              <StepView
                step={current}
                theme={theme}
                answers={answers}
                extras={extras}
                onScale={selectScale}
                onNum={onNum}
                onBackendMulti={onBackendMulti}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="ht-foot">
        {current?.kind === "intro" ? (
          <IonButton
            expand="block"
            className="bt bt-teal ht-cta"
            onClick={() => go(1)}
          >
            {t("Comenzar evaluación")}
            <IonIcon icon={sparkles} slot="end" />
          </IonButton>
        ) : (
          <div className="ht-foot-row">
            <IonButton
              fill="solid"
              className="bt bt-ghost bt-round"
              aria-label={t("Anterior")}
              onClick={() => go(step - 1)}
            >
              <IonIcon
                slot="icon-only"
                icon={step === 0 ? arrowBackOutline : chevronBack}
              />
            </IonButton>
            <IonButton
              expand="block"
              className={`bt ht-cta ${isLast ? "bt-gold" : "bt-teal"}`}
              disabled={!canContinue}
              onClick={continueNext}
            >
              {isLast ? t("Guardar evaluación") : t("Continuar")}
              {!isLast && <IonIcon icon={chevronForward} slot="end" />}
            </IonButton>
          </div>
        )}
      </div>
    </div>
  );
}

function StepView({
  step,
  theme,
  answers,
  extras,
  onScale,
  onNum,
  onBackendMulti,
}: {
  step: WizardStep;
  theme: TestTheme;
  answers: Record<number, number | number[] | string>;
  extras: WizardExtras;
  onScale: (index: number, value: number) => void;
  onNum: (index: number, value: number) => void;
  onBackendMulti: (index: number, option: number) => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();

  if (step.kind === "intro") {
    return (
      <div className="ht-intro">
        <motion.div
          className="ht-intro-emoji"
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {step.emoji}
        </motion.div>
        <div className="ht-kicker">{t(theme.kicker)}</div>
        <h2 className="ht-intro-title display">{t(step.title)}</h2>
        <p className="ht-intro-sub">{t(step.sub)}</p>
        <div className="ht-intro-meta">
          <span>
            <IonIcon icon={sparkles} />
            {t("{n} preguntas", { n: String(step.count) })}
          </span>
          <span>
            <IonIcon icon={timeOutline} />
            {t("~{n} min", { n: String(step.minutes) })}
          </span>
        </div>
        <p className="ht-intro-hint">
          {t(
            "Una pregunta a la vez. Responde con honestidad, no hay respuestas incorrectas.",
          )}
        </p>
      </div>
    );
  }

  if (step.kind === "scale") {
    const value =
      typeof answers[step.index] === "number"
        ? (answers[step.index] as number)
        : undefined;
    const tone = sectionTone(step.section);
    return (
      <div className={`ht-q tone-${tone || theme.mood}`}>
        <div className="ht-q-emoji" aria-hidden="true">
          {step.emoji}
        </div>
        {step.section && <div className="ht-section">{t(step.section)}</div>}
        <h3 className="ht-q-text display">{t(step.text)}</h3>
        {step.hint && <p className="ht-hint">{t(step.hint)}</p>}
        <ScaleControl
          step={step}
          value={value}
          accent={theme.accent}
          onChange={(v) => onScale(step.index, v)}
        />
      </div>
    );
  }

  if (step.kind === "num") {
    const current =
      typeof answers[step.index] === "number"
        ? (answers[step.index] as number)
        : step.def;
    const clamp = (v: number) =>
      Math.min(step.max, Math.max(step.min, Math.round(v)));
    const change = (delta: number) => {
      const next = clamp(current + delta);
      void tapHaptic();
      onNum(step.index, next);
    };
    return (
      <div className="ht-q">
        <div className="ht-q-emoji" aria-hidden="true">
          {step.emoji}
        </div>
        {step.section && <div className="ht-section">{t(step.section)}</div>}
        <h3 className="ht-q-text display">{t(step.text)}</h3>
        {step.hint && <p className="ht-hint">{t(step.hint)}</p>}
        <div className="ht-num-row">
          <motion.button
            type="button"
            className="ht-num-btn"
            aria-label={t("Disminuir")}
            onClick={() => change(-1)}
            whileTap={reduce ? undefined : { scale: 0.9 }}
          >
            −
          </motion.button>
          <div className="ht-num-val">
            <strong>{current}</strong>
            {step.unit && <span className="ht-num-unit">{step.unit}</span>}
          </div>
          <motion.button
            type="button"
            className="ht-num-btn"
            aria-label={t("Aumentar")}
            onClick={() => change(1)}
            whileTap={reduce ? undefined : { scale: 0.9 }}
          >
            +
          </motion.button>
        </div>
        <p className="ht-num-range">
          {t("{min} – {max} {unit}", {
            min: String(step.min),
            max: String(step.max),
            unit: step.unit,
          })}
        </p>
      </div>
    );
  }

  if (step.kind === "multi") {
    const selected = selectedForMulti(step, answers, extras);
    const apply = (next: number[]) => {
      void tapHaptic();
      if (step.backendIndex !== undefined) {
        const prev = selected;
        const added = next.filter((x) => !prev.includes(x));
        const removed = prev.filter((x) => !next.includes(x));
        [...added, ...removed].forEach((vi) =>
          onBackendMulti(step.backendIndex!, vi),
        );
      }
    };
    const clinic = step.layout === "clinic";
    const marked = selected.filter(
      (i) => !isNoneLabel(step.items[i]?.label ?? ""),
    ).length;
    return (
      <div className={`ht-q ${clinic ? "ht-q-clinic" : ""}`}>
        <div className="ht-q-emoji" aria-hidden="true">
          {step.emoji}
        </div>
        <div className="ht-section">{t(step.title)}</div>
        {clinic && (
          <h3 className="ht-q-text display">
            {t("¿Cuáles de estas condiciones te han diagnosticado?")}
          </h3>
        )}
        <p className="ht-hint">
          {clinic
            ? t(
                "Toca cada una que aplique. Si no tienes ninguna, elige Ninguno.",
              )
            : t(step.hint)}
        </p>
        {clinic && (
          <div className="ht-count">
            {t("{n} condiciones marcadas", { n: String(marked) })}
          </div>
        )}
        <div className={clinic ? "ht-conds" : "ht-chips"}>
          {step.items.map((it, i) => {
            const on = selected.includes(i);
            const none = isNoneLabel(it.label);
            if (clinic) {
              const tint = itemTint(it.label);
              return (
                <motion.button
                  key={`${it.label}-${i}`}
                  type="button"
                  className={`ht-cond ${on ? "sel" : ""} ${none ? "none" : ""}`}
                  onClick={() => apply(exclusiveNext(selected, i, step.items))}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                >
                  <span
                    className="ht-cond-ico"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    {it.ico}
                  </span>
                  <span className="ht-cond-name">{t(it.label)}</span>
                  <span
                    className={`ht-cond-mark ${on ? "on" : ""}`}
                    aria-hidden="true"
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="ht-cond-sub">
                    {none
                      ? t("Ninguna de las anteriores")
                      : on
                        ? t("Lo tengo")
                        : t("Toca si te lo diagnosticaron")}
                  </span>
                </motion.button>
              );
            }
            return (
              <motion.button
                key={`${it.label}-${i}`}
                type="button"
                className={`ht-chip ${on ? "sel" : ""}`}
                onClick={() => apply(exclusiveNext(selected, i, step.items))}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                animate={on ? { scale: 1.02 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
              >
                <span className="ht-chip-ico">{it.ico}</span>
                <span className="ht-chip-label">{t(it.label)}</span>
                {on && (
                  <IonIcon icon={checkmarkCircle} className="ht-chip-check" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step.kind === "open") {
    const fromAnswers = answers[step.index];
    const value =
      typeof fromAnswers === "string"
        ? fromAnswers
        : (extras.openNotes[step.index] ?? "");
    return (
      <div className="ht-q ht-open">
        <div className="ht-q-emoji" aria-hidden="true">
          {step.emoji}
        </div>
        <div className="ht-section">{t("En tus palabras")}</div>
        <h3 className="ht-q-text display">{t(step.question)}</h3>
        {step.hint && <p className="ht-hint">{t(step.hint)}</p>}
        <IonTextarea
          className="fld ht-area"
          autoGrow
          rows={5}
          placeholder={t(step.placeholder)}
          value={value}
          onIonInput={(e) =>
            extras.onOpenNote(step.index, String(e.detail.value ?? ""))
          }
        />
      </div>
    );
  }

  return null;
}

function ScaleControl({
  step,
  value,
  accent,
  onChange,
}: {
  step: Extract<WizardStep, { kind: "scale" }>;
  value: number | undefined;
  accent: string;
  onChange: (v: number) => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const labels = step.optionLabels ?? step.scale;
  const picked = value !== undefined ? labels[value] : undefined;

  if (step.variant === "yesno" || step.variant === "cards") {
    return (
      <>
        <div className={`ht-cards cols-${Math.min(2, step.scale.length)}`}>
          {step.scale.map((s, i) => {
            const on = value === i;
            const label = step.optionLabels?.[i] ?? s;
            return (
              <motion.button
                key={`${s}-${i}`}
                type="button"
                className={`ht-card-opt ${on ? "sel" : ""}`}
                onClick={() => onChange(i)}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                animate={on ? { y: -2 } : { y: 0 }}
              >
                <span className="ht-card-ico" aria-hidden="true">
                  {optionEmoji(label)}
                </span>
                <span className="ht-card-lab">{t(label)}</span>
              </motion.button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="ht-likert-wrap">
      <div className="ht-likert" style={{ ["--ht-accent" as string]: accent }}>
        {step.scale.map((s, i) => {
          const on = value === i;
          const fill = value !== undefined && i <= value;
          return (
            <motion.button
              key={`${s}-${i}`}
              type="button"
              className={`ht-orb ${on ? "sel" : ""} ${fill ? "fill" : ""}`}
              aria-label={t(step.optionLabels?.[i] ?? s)}
              onClick={() => onChange(i)}
              whileTap={reduce ? undefined : { scale: 0.88 }}
              animate={on ? { scale: 1.12 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 480, damping: 22 }}
            >
              {s}
            </motion.button>
          );
        })}
      </div>
      <div className="ht-likert-labels">
        <span>{t(step.leftLabel)}</span>
        <span>{t(step.rightLabel)}</span>
      </div>
      <AnimatePresence>
        {step.optionLabels && picked && (
          <motion.p
            key={picked}
            className="ht-picked"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {t(picked)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function exclusiveNext(
  selected: number[],
  i: number,
  items: { label: string }[],
): number[] {
  const noneIdx = items.findIndex((it) => isNoneLabel(it.label));
  if (noneIdx === i) return selected.includes(i) ? [] : [i];
  const withoutNone = selected.filter((x) => x !== noneIdx);
  return withoutNone.includes(i)
    ? withoutNone.filter((x) => x !== i)
    : [...withoutNone, i];
}

function selectedForMulti(
  step: Extract<WizardStep, { kind: "multi" }>,
  answers: Record<number, number | number[] | string>,
  _extras: WizardExtras,
): number[] {
  if (step.backendIndex !== undefined) {
    const v = answers[step.backendIndex];
    return Array.isArray(v) ? v : [];
  }
  return [];
}

function isStepAnswered(
  step: WizardStep | undefined,
  answers: Record<number, number | number[] | string>,
  _extras: WizardExtras,
): boolean {
  if (!step) return false;
  if (step.kind === "intro" || step.kind === "multi" || step.kind === "open") {
    return true;
  }
  return typeof answers[step.index] === "number";
}

async function tapHaptic() {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* web: sin háptica */
  }
}

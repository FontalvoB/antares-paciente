import { IonCheckbox } from "@ionic/react";
import { useId } from "react";
import { useT } from "../../../../../i18n/I18nContext";
import { PARQ_QUESTIONS } from "../../../domain";
import type { ObjectiveDraft, WellnessQuestion, YesNo } from "../../../domain";

export interface QuestionStepProps {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  invalidField?: string;
  errorId: string;
  showAnswerCount?: boolean;
}

export function SafetyQuestions({
  draft,
  onChange,
  invalidField,
  errorId,
  showAnswerCount,
  questions,
  field,
  confirmationField,
}: QuestionStepProps & {
  questions: readonly WellnessQuestion[];
  field: "parq" | "nqs";
  confirmationField: "doctorConfirmed" | "nutritionistConfirmed";
}) {
  const t = useT();
  const confirmationId = useId();
  const answers = draft[field];
  const hasPositive = questions.some((_, index) => answers[index] === 1);
  const answered = questions.filter((_, index) => answers[index] === 0 || answers[index] === 1).length;

  const selectAnswer = (index: number, value: YesNo) => {
    if (answers.length === questions.length && answers[index] === value) return;
    onChange({
      [field]: questions.map((_, position) => position === index ? value : answers[position] ?? null),
      [confirmationField]: false,
    });
  };

  return (
    <div data-wl-field={field}>
      {showAnswerCount && (
        <p className="wl-safety-count" role="status">{t("{count} de {total} respondidas", {
          count: String(answered), total: String(questions.length),
        })}</p>
      )}
      {questions.map((question, index) => {
        const answerField = `${field}.${index}`;
        return (
          <fieldset
            key={question.id}
            className="wl-question"
            style={{ minWidth: 0, marginInline: 0 }}
            aria-describedby={invalidField === answerField ? errorId : undefined}
          >
            <legend className="wl-sub"><span className="wl-question-number" aria-hidden="true">{index + 1}</span>{t(question.es)}</legend>
            <div className="wl-answer-row">
              <button
                type="button"
                data-wl-field={answerField}
                className={`wl-answer${answers[index] === 1 ? " is-yes" : ""}`}
                aria-pressed={answers[index] === 1}
                onClick={() => selectAnswer(index, 1)}
              >
                {t("Sí")}
              </button>
              <button
                type="button"
                className={`wl-answer${answers[index] === 0 ? " is-no" : ""}`}
                aria-pressed={answers[index] === 0}
                onClick={() => selectAnswer(index, 0)}
              >
                {t("No")}
              </button>
            </div>
          </fieldset>
        );
      })}

      {hasPositive && (
        <div className="wl-note wl-note-warn" style={{ flexDirection: "column" }}>
          <strong id={confirmationId} role="status">{t("Consulta primero a tu profesional de la salud")}</strong>
          <IonCheckbox
            checked={draft[confirmationField]}
            required
            data-wl-field={confirmationField}
            className={invalidField === confirmationField ? "ion-invalid ion-touched" : undefined}
            aria-describedby={invalidField === confirmationField ? errorId : confirmationId}
            style={{ minHeight: 44, alignItems: "center", whiteSpace: "normal" }}
            onIonChange={(event) => onChange({ [confirmationField]: event.detail.checked })}
          >
            <span style={{ whiteSpace: "normal" }}>{t("Confirmo que ya hice la consulta.")}</span>
          </IonCheckbox>
        </div>
      )}
    </div>
  );
}

export function ParqStep(props: QuestionStepProps) {
  return <SafetyQuestions {...props} questions={PARQ_QUESTIONS} field="parq" confirmationField="doctorConfirmed" />;
}

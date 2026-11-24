import { useState } from "react";
import { IonInput } from "@ionic/react";
import { useT } from "../../../../../i18n/I18nContext";
import {
  MIN_AGE,
  OBJECTIVE_STEP,
  RANGES,
  parseNumberInput,
} from "../../../domain";
import type { GateIssue, ObjectiveDraft } from "../../../domain";

// oxlint-disable-next-line react/only-export-components -- Shared with the summary within the objective module.
export const SEX_OPTIONS = { F: "Femenino", M: "Masculino" } as const;
const NUMERIC_FIELDS = [
  { field: "age", label: "Edad (años)" },
  { field: "heightCm", label: "Estatura (cm)" },
  { field: "weightKg", label: "Peso actual (kg)" },
  { field: "waistCm", label: "Cintura (cm)" },
  { field: "targetWeightKg", label: "Peso meta (kg)" },
] as const;

// oxlint-disable-next-line react/only-export-components -- Keeps numeric validation next to the fields it validates.
export function dataIssues(
  draft: ObjectiveDraft,
  issues: readonly GateIssue[],
) {
  const step = OBJECTIVE_STEP.data;
  return [
    ...issues.filter((issue) => issue.field === "sex"),
    ...NUMERIC_FIELDS.flatMap(({ field }) => {
      const existing = issues.filter((issue) => issue.field === field);
      const value = parseNumberInput(draft[field]);
      if (
        existing.some((issue) => issue.code === "age") ||
        (value === null && existing.length)
      ) {
        return existing;
      }

      const { min, max } = RANGES[field];
      if (value === null || value < min || value > max) {
        return [
          {
            code: "unanswered",
            step,
            field,
            messageKey: "Ingresa un valor de {min} a {max}.",
          },
        ] satisfies GateIssue[];
      }
      if (field === "age" && !Number.isInteger(value)) {
        return [
          {
            code: "unanswered",
            step,
            field,
            messageKey: "Ingresa tu edad en años completos.",
          },
        ] satisfies GateIssue[];
      }
      return existing;
    }),
  ];
}

// oxlint-disable-next-line react/only-export-components -- Supplies the same range to inline errors and the gate notice.
export function issueParams(issue: GateIssue) {
  if (issue.messageKey !== "Ingresa un valor de {min} a {max}.")
    return undefined;
  const range = NUMERIC_FIELDS.find(({ field }) => field === issue.field);
  if (!range) return undefined;
  const { min, max } = RANGES[range.field];
  return { min: String(min), max: String(max) };
}

export function DataStep({
  draft,
  onChange,
  invalidField,
  errorId,
}: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  invalidField?: string;
  errorId: string;
}) {
  const t = useT();
  const [inputs, setInputs] = useState<
    Partial<Record<keyof typeof RANGES, string>>
  >({});

  return (
    <div className="onb-stack">
      <div className="field" style={{ minWidth: 0 }}>
        <IonInput
          type="text"
          label={t("Nombre")}
          labelPlacement="stacked"
          className="fld"
          autocomplete="given-name"
          style={{ minHeight: 48 }}
          data-wl-field="name"
          value={draft.name}
          onIonInput={(event) => onChange({ name: event.detail.value ?? "" })}
        />
      </div>
      <fieldset
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        aria-describedby={invalidField === "sex" ? errorId : undefined}
      >
        <legend className="wl-sub">
          {t("Sexo para el cálculo de energía")}
        </legend>
        <div className="wl-chips">
          {(["F", "M"] as const).map((sex) => (
            <button
              key={sex}
              type="button"
              className={`wl-chip${draft.sex === sex ? " is-selected" : ""}`}
              data-wl-field={sex === "F" ? "sex" : undefined}
              aria-pressed={draft.sex === sex}
              onClick={() => onChange({ sex })}
            >
              {t(SEX_OPTIONS[sex])}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="wl-field-grid">
        {NUMERIC_FIELDS.map(({ field, label }) => (
          <div className="field" key={field} style={{ minWidth: 0 }}>
            <IonInput
              type="text"
              inputmode={field === "age" ? "numeric" : "decimal"}
              label={t(label)}
              labelPlacement="stacked"
              required
              className={
                invalidField === field ? "fld ion-invalid ion-touched" : "fld"
              }
              style={{ minHeight: 48 }}
              data-wl-field={field}
              aria-describedby={invalidField === field ? errorId : undefined}
              value={
                inputs[field] ??
                (draft[field] === null ? "" : String(draft[field]))
              }
              onIonInput={(event) => {
                const raw = event.detail.value ?? "";
                setInputs((previous) => ({ ...previous, [field]: raw }));
                const normalized = raw.trim();
                const value = /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(normalized)
                  ? parseNumberInput(normalized)
                  : null;
                onChange({ [field]: value });
              }}
            />
          </div>
        ))}
      </div>
      <p className="wl-sub">
        {t("Este plan está disponible a partir de los {age} años.", {
          age: String(MIN_AGE),
        })}
      </p>
    </div>
  );
}

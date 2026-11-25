import { useState } from "react";
import { IonIcon, IonInput } from "@ionic/react";
import { bodyOutline, calendarOutline, flagOutline, informationCircleOutline, personOutline, resizeOutline, scaleOutline } from "ionicons/icons";
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
const NUMERIC_FIELDS: readonly {
  field: keyof typeof RANGES;
  label: string;
  hint?: string;
  icon: string;
}[] = [
  { field: "age", label: "Edad (años)", hint: "En años completos.", icon: calendarOutline },
  { field: "heightCm", label: "Estatura (cm)", hint: "1,65 m equivale a 165 cm.", icon: resizeOutline },
  { field: "weightKg", label: "Peso actual (kg)", icon: scaleOutline },
  { field: "waistCm", label: "Cintura (cm)", icon: bodyOutline },
  { field: "targetWeightKg", label: "Peso meta (kg)", icon: flagOutline },
];

function parseMeasurement(raw: string) {
  const normalized = raw.trim();
  return /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(normalized) ? parseNumberInput(normalized) : null;
}

// oxlint-disable-next-line react/only-export-components -- Reads Ionic controls before validating the step.
export function readMeasurements(root: HTMLElement, draft: ObjectiveDraft) {
  const patch: Partial<ObjectiveDraft> = {};
  for (const { field } of NUMERIC_FIELDS) {
    const input = root.querySelector<HTMLInputElement>(`ion-input[data-wl-field="${field}"] input`);
    if (!input) continue;
    const value = parseMeasurement(input.value);
    if (value !== draft[field]) patch[field] = value;
  }
  return patch;
}

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
          data-wl-field="name"
          value={draft.name}
          onIonInput={(event) => onChange({ name: event.detail.value ?? "" })}
        >
          <IonIcon slot="start" icon={personOutline} aria-hidden="true" />
        </IonInput>
      </div>
      <fieldset
        className="wl-fieldset wl-sex"
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
        {NUMERIC_FIELDS.map(({ field, label, hint, icon }) => (
          <div className="field" key={field} style={{ minWidth: 0 }}>
            <IonInput
              type="text"
              inputmode={field === "age" ? "numeric" : "decimal"}
              label={t(label)}
              labelPlacement="stacked"
              helperText={hint && t(hint)}
              required
              className={
                invalidField === field ? "fld ion-invalid ion-touched" : "fld"
              }
              data-wl-field={field}
              aria-describedby={invalidField === field ? errorId : undefined}
              value={
                inputs[field] ??
                (draft[field] === null ? "" : String(draft[field]))
              }
              onIonInput={(event) => {
                const raw = event.detail.value ?? "";
                setInputs((previous) => ({ ...previous, [field]: raw }));
                onChange({ [field]: parseMeasurement(raw) });
              }}
            >
              <IonIcon slot="start" icon={icon} aria-hidden="true" />
            </IonInput>
          </div>
        ))}
      </div>
      <p className="wl-note wl-note-info wl-adult-note">
        <IonIcon icon={informationCircleOutline} aria-hidden="true" />
        {t("Este plan está disponible a partir de los {age} años.", {
          age: String(MIN_AGE),
        })}
      </p>
    </div>
  );
}

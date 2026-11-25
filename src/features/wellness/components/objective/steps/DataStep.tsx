import { useState } from "react";
import { IonIcon, IonInput } from "@ionic/react";
import { bodyOutline, calendarOutline, femaleOutline, flagOutline, informationCircleOutline, maleOutline, personOutline, resizeOutline, scaleOutline } from "ionicons/icons";
import { useI18n } from "../../../../../i18n/I18nContext";
import type { MetricUnit } from "../../../../../utils/units";
import { formatWellnessMeasurement, parseWellnessMeasurement } from "../../../vitals/unit-prefs";
import type { UnitPrefs } from "../../../vitals/unit-prefs";
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
  /** Etiqueta cuando la persona prefiere unidades US (lb/in); null si el campo no tiene unidad. */
  usLabel: string | null;
  /** Unidad métrica canónica del draft; null para valores adimensionales (edad). */
  unit: MetricUnit | null;
  /** Ayuda expresada en unidades métricas: se oculta si el campo se muestra en US. */
  hint?: string;
  icon: string;
}[] = [
  { field: "age", label: "Edad (años)", usLabel: null, unit: null, hint: "En años completos.", icon: calendarOutline },
  { field: "heightCm", label: "Estatura (cm)", usLabel: "Estatura (in)", unit: "centimeter", hint: "1,65 m = 165 cm", icon: resizeOutline },
  { field: "weightKg", label: "Peso actual (kg)", usLabel: "Peso actual (lb)", unit: "kilogram", icon: scaleOutline },
  { field: "waistCm", label: "Cintura (cm)", usLabel: "Cintura (in)", unit: "centimeter", icon: bodyOutline },
  { field: "targetWeightKg", label: "Peso meta (kg)", usLabel: "Peso meta (lb)", unit: "kilogram", icon: flagOutline },
];

/** Convierte el texto del control a valor métrico según las preferencias de unidades. */
function parseMeasurement(raw: string, unit: MetricUnit | null, prefs: UnitPrefs) {
  const normalized = raw.trim();
  const value = /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(normalized) ? parseNumberInput(normalized) : null;
  return value !== null && unit ? parseWellnessMeasurement(value, unit, prefs) : value;
}

// oxlint-disable-next-line react/only-export-components -- Reads Ionic controls before validating the step.
export function readMeasurements(root: HTMLElement, draft: ObjectiveDraft, prefs: UnitPrefs) {
  const patch: Partial<ObjectiveDraft> = {};
  for (const { field, unit } of NUMERIC_FIELDS) {
    const input = root.querySelector<HTMLInputElement>(`ion-input[data-wl-field="${field}"] input`);
    if (!input) continue;
    const value = parseMeasurement(input.value, unit, prefs);
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
export function issueParams(issue: GateIssue, locale: string, prefs: UnitPrefs) {
  if (issue.messageKey !== "Ingresa un valor de {min} a {max}.")
    return undefined;
  const range = NUMERIC_FIELDS.find(({ field }) => field === issue.field);
  if (!range) return undefined;
  const { min, max } = RANGES[range.field];
  return range.unit ? {
    min: formatWellnessMeasurement(min, range.unit, locale, prefs, { rounding: "ceil" }),
    max: formatWellnessMeasurement(max, range.unit, locale, prefs, { rounding: "floor" }),
  } : { min: String(min), max: String(max) };
}

export function DataStep({
  draft,
  onChange,
  invalidField,
  errorId,
  prefs,
}: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  invalidField?: string;
  errorId: string;
  prefs: UnitPrefs;
}) {
  const { t, lang } = useI18n();
  const us = prefs.weight === "lb";
  const [inputs, setInputs] = useState<
    Partial<Record<keyof typeof RANGES, { raw: string; us: boolean }>>
  >({});

  return (
    <div className="onb-stack wl-data-step">
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
              <IonIcon icon={sex === "F" ? femaleOutline : maleOutline} aria-hidden="true" />
              <span>{t(SEX_OPTIONS[sex])}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="wl-field-grid">
        {NUMERIC_FIELDS.map(({ field, label, usLabel, unit, hint, icon }) => {
          const input = inputs[field];
          const metric = draft[field];
          // El texto tecleado solo se reutiliza si se escribió con el sistema de unidades vigente.
          const value = input && (!unit || input.us === us)
            ? input.raw
            : metric === null ? "" : unit
              ? formatWellnessMeasurement(metric, unit, lang, prefs, { withUnit: false })
              : String(metric);
          return (
            <div className="field" key={field} style={{ minWidth: 0 }}>
              <IonInput
                type="text"
                inputmode={field === "age" ? "numeric" : "decimal"}
                label={t(us && usLabel ? usLabel : label)}
                labelPlacement="stacked"
                helperText={hint && !(us && unit) ? t(hint) : undefined}
                required
                className={
                  invalidField === field ? "fld ion-invalid ion-touched" : "fld"
                }
                style={{ minHeight: 48 }}
                data-wl-field={field}
                aria-describedby={invalidField === field ? errorId : undefined}
                value={value}
                onIonInput={(event) => {
                  const raw = event.detail.value ?? "";
                  setInputs((previous) => ({ ...previous, [field]: { raw, us } }));
                  onChange({ [field]: parseMeasurement(raw, unit, prefs) });
                }}
              >
                <IonIcon slot="start" icon={icon} aria-hidden="true" />
              </IonInput>
            </div>
          );
        })}
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

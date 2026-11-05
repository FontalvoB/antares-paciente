import { IonButton, IonInput, IonIcon, IonSpinner } from "@ionic/react";
import { flameOutline, leafOutline, checkmarkOutline } from "ionicons/icons";
import { useState } from "react";
import { useT } from "../i18n/I18nContext";
import type { IntakeFormState } from "../utils/nutritionForm";

/**
 * Formulario de valores nutricionales (reutilizado por el registro manual y
 * por la revisión/edición del flujo con foto). Estilos: clases globales
 * `.nut-reg` (tokens del design system, sin CSS nuevo).
 */
const FIELDS: {
  key: keyof IntakeFormState;
  labelKey: string;
  inputmode: "numeric" | "decimal";
}[] = [
  { key: "calories", labelKey: "Calorías (kcal)", inputmode: "numeric" },
  { key: "proteinG", labelKey: "Proteínas (g)", inputmode: "decimal" },
  { key: "carbsG", labelKey: "Carbohidratos (g)", inputmode: "decimal" },
  { key: "fatG", labelKey: "Grasas (g)", inputmode: "decimal" },
  { key: "fiberG", labelKey: "Fibra (g)", inputmode: "decimal" },
];

interface Props {
  initial: IntakeFormState;
  submitLabel: string;
  pending?: boolean;
  /** Línea de referencia (objetivo del plan), nunca valores consumidos. */
  planReference?: string | null;
  onSubmit: (values: IntakeFormState) => void;
}

export function MealIntakeForm({
  initial,
  submitLabel,
  pending = false,
  planReference = null,
  onSubmit,
}: Props) {
  const t = useT();
  const [form, setForm] = useState<IntakeFormState>(initial);

  return (
    <div className="meal-intake-form">
      {planReference && <div className="meal-intake-reference"><IonIcon icon={leafOutline} aria-hidden="true" /><p>{planReference}</p></div>}
      <div className="meal-intake-grid">
      {FIELDS.map((f, i) => (
        <div key={f.key} className={`meal-intake-field meal-intake-${f.key}`}>
        {i === 0 && <span className="meal-intake-energy-icon"><IonIcon icon={flameOutline} aria-hidden="true" /></span>}
        <IonInput
          key={f.key}
          label={t(f.labelKey)}
          labelPlacement="stacked"
          fill="outline"
          type="number"
          placeholder="—"
          inputmode={f.inputmode}
          enterkeyhint={i === FIELDS.length - 1 ? "done" : "next"}
          value={form[f.key]}
          disabled={pending}
          onIonInput={(e) =>
            setForm((prev) => ({
              ...prev,
              [f.key]: String(e.target.value ?? ""),
            }))
          }
        />
        </div>
      ))}
      </div>
      <IonButton
        className="nut-intake-submit"
        expand="block"
        disabled={pending}
        onClick={() => onSubmit(form)}
      >
        {pending ? <IonSpinner slot="start" name="crescent" /> : <IonIcon slot="start" icon={checkmarkOutline} />}
        {pending ? t("Guardando…") : submitLabel}
      </IonButton>
    </div>
  );
}

import { IonButton, IonInput } from "@ionic/react";
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
    <>
      {planReference && <div className="nut-reg-sub">{planReference}</div>}
      {FIELDS.map((f, i) => (
        <IonInput
          key={f.key}
          label={t(f.labelKey)}
          labelPlacement="stacked"
          fill="outline"
          type="number"
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
      ))}
      <IonButton
        expand="block"
        style={
          {
            marginTop: 16,
            "--background": "var(--teal)",
          } as React.CSSProperties
        }
        disabled={pending}
        onClick={() => onSubmit(form)}
      >
        {pending ? t("Guardando…") : submitLabel}
      </IonButton>
    </>
  );
}

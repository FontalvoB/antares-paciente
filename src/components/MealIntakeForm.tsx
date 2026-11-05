import { IonButton, IonInput, IonIcon, IonChip } from "@ionic/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { flameOutline, barbellOutline, restaurantOutline, waterOutline, leafOutline, informationCircleOutline, checkmarkOutline } from "ionicons/icons";
import { foodScene, FOOD_SPRING } from "./nutrition/foodMotion";
import { useState } from "react";
import { useT } from "../i18n/I18nContext";
import type { IntakeFormState } from "../utils/nutritionForm";

/**
 * Formulario de valores nutricionales (reutilizado por el registro manual y
 * por la revisión/edición del flujo con foto). Estilos: clases globales
 * `.nut-intake` (identidad compartida en ambos montajes).
 */
const FIELDS: {
  key: keyof IntakeFormState;
  labelKey: string;
  inputmode: "numeric" | "decimal";
  icon: string;
}[] = [
  { icon: flameOutline, key: "calories", labelKey: "Calorías (kcal)", inputmode: "numeric" },
  { icon: barbellOutline, key: "proteinG", labelKey: "Proteínas (g)", inputmode: "decimal" },
  { icon: restaurantOutline, key: "carbsG", labelKey: "Carbohidratos (g)", inputmode: "decimal" },
  { icon: waterOutline, key: "fatG", labelKey: "Grasas (g)", inputmode: "decimal" },
  { icon: leafOutline, key: "fiberG", labelKey: "Fibra (g)", inputmode: "decimal" },
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
  const reduced = useReducedMotion();
  const [form, setForm] = useState<IntakeFormState>(initial);

  return (
    <motion.div className="nut-intake" {...foodScene(reduced)}>
      <AnimatePresence>
        {planReference && <motion.div key="reference" {...foodScene(reduced)}><IonChip className="nut-intake-reference"><IonIcon icon={informationCircleOutline} aria-hidden="true" />{planReference}</IonChip></motion.div>}
      </AnimatePresence>
      <div className="nut-intake-grid">
      {FIELDS.map((f, i) => (
        <IonInput
          key={f.key}
          label={t(f.labelKey)}
          labelPlacement="stacked"
          className={i === 0 ? "nut-intake-calories" : undefined}
          fill="solid"
          type="number"
          placeholder="0"
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
        ><IonIcon slot="start" icon={f.icon} aria-hidden="true" /></IonInput>
      ))}
      </div>
      <motion.div whileTap={reduced || pending ? undefined : { scale: 0.98 }} transition={FOOD_SPRING}>
      <IonButton
        className="nut-intake-submit"
        expand="block"
        disabled={pending}
        onClick={() => onSubmit(form)}
      >
        <IonIcon icon={checkmarkOutline} slot="start" />
        {pending ? t("Guardando…") : submitLabel}
      </IonButton>
      </motion.div>
    </motion.div>
  );
}

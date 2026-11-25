import { IonIcon } from "@ionic/react";
import { checkmarkCircleOutline, desktopOutline, flashOutline, speedometerOutline, walkOutline } from "ionicons/icons";
import { useT } from "../../../../../i18n/I18nContext";
import type { ObjectiveDraft, WellnessActivity } from "../../../domain";

export const ACTIVITY_OPTIONS = [
  { value: 1, label: "Sedentario", description: "Paso la mayor parte del día sentado y casi nunca hago ejercicio." },
  { value: 2, label: "Ligero", description: "Camino con frecuencia o hago ejercicio ligero de 1 a 3 días por semana." },
  { value: 3, label: "Moderado", description: "Hago ejercicio de intensidad moderada de 3 a 5 días por semana." },
  { value: 4, label: "Alto", description: "Entreno con intensidad casi a diario o tengo un trabajo con mucho esfuerzo físico." },
] as const satisfies readonly { value: WellnessActivity; label: string; description: string }[];

// oxlint-disable-next-line react/only-export-components -- Shared with the summary within the objective module.
export const PACE_OPTIONS = { s: "Suave", m: "Moderado" } as const;
const ACTIVITY_ICONS = [desktopOutline, walkOutline, speedometerOutline, flashOutline];

export function ActivityStep({ draft, onChange }: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
}) {
  const t = useT();

  return (
    <div className="onb-stack">
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className="wl-sub">{t("¿Cuánto te mueves habitualmente?")}</legend>
        <div className="wl-options">
          {ACTIVITY_OPTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              className={`wl-option${draft.activity === value ? " is-selected" : ""}`}
              data-wl-field={value === 1 ? "activity" : undefined}
              aria-pressed={draft.activity === value}
              onClick={() => onChange({ activity: value })}
            >
              <span className="wl-option-ico"><IonIcon icon={ACTIVITY_ICONS[value - 1]} aria-hidden="true" /></span>
              <span className="wl-option-body">
                <b>{t(label)}</b>
                <span>{t(description)}</span>
              </span>
              {draft.activity === value && <IonIcon className="wl-option-selected" icon={checkmarkCircleOutline} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className="wl-sub">{t("Ritmo del plan")}</legend>
        <div className="wl-chips">
          {(["s", "m"] as const).map((pace) => (
            <button
              key={pace}
              type="button"
              className={`wl-chip${draft.pace === pace ? " is-selected" : ""}`}
              data-wl-field={pace === "s" ? "pace" : undefined}
              aria-pressed={draft.pace === pace}
              onClick={() => onChange({ pace })}
            >
              {t(PACE_OPTIONS[pace])}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

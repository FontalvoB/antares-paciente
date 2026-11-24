import { IonIcon } from "@ionic/react";
import { barbellOutline, fitnessOutline, trendingDownOutline } from "ionicons/icons";
import { useT } from "../../../../../i18n/I18nContext";
import type { ObjectiveDraft, WellnessGoal } from "../../../domain";

// oxlint-disable-next-line react/only-export-components -- Shared with the summary within the objective module.
export const GOAL_OPTIONS = {
  bajar: {
    label: "Bajar de peso",
    icon: trendingDownOutline,
  },
  masa: {
    label: "Subir masa muscular",
    icon: barbellOutline,
  },
  def: {
    label: "Definir",
    icon: fitnessOutline,
  },
} as const;

export function GoalStep({ draft, onChange, allowedGoals = Object.keys(GOAL_OPTIONS) as WellnessGoal[] }: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  allowedGoals?: readonly WellnessGoal[];
}) {
  const t = useT();

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="wl-sub">{t("Elige una meta para tu plan.")}</legend>
      <div className="wl-options">
        {allowedGoals.map((goal, index) => {
          const { label, icon } = GOAL_OPTIONS[goal];
          const selected = draft.goal === goal;
          return (
            <button
              key={goal}
              type="button"
              className={`wl-option${selected ? " is-selected" : ""}`}
              style={{ alignItems: "center" }}
              data-wl-field={index === 0 ? "goal" : undefined}
              aria-label={t(label)}
              aria-pressed={selected}
              onClick={() => onChange({ goal })}
            >
              <span className="wl-option-ico" aria-hidden="true"><IonIcon icon={icon} /></span>
              <span className="wl-option-body">
                <b>{t(label)}</b>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

import { IonCheckbox } from "@ionic/react";
import { useT } from "../../../../../i18n/I18nContext";
import type { ObjectiveDraft } from "../../../domain";

// oxlint-disable-next-line react/only-export-components -- Shared with the summary within the objective module.
export const PREFERENCE_OPTIONS = [
  { field: "vegetarian", label: "Alimentación vegetariana" },
  { field: "dairyFree", label: "Sin lácteos" },
] as const;

export function PreferencesStep({ draft, onChange }: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
}) {
  const t = useT();

  return (
    <div className="onb-stack">
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className="wl-sub">{t("Marca las opciones que prefieras.")}</legend>
        {PREFERENCE_OPTIONS.map(({ field, label }) => (
          <IonCheckbox
            key={field}
            checked={draft[field]}
            onIonChange={(event) => onChange({ [field]: event.detail.checked })}
            style={{ display: "flex", minHeight: 44, alignItems: "center" }}
          >
            {t(label)}
          </IonCheckbox>
        ))}
      </fieldset>
      <p className="wl-note wl-note-warn">
        {t("Estas preferencias no gestionan alergias ni intolerancias alimentarias.")}
      </p>
    </div>
  );
}

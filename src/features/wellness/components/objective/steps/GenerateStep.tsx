import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { sparklesOutline } from "ionicons/icons";
import { useI18n } from "../../../../../i18n/I18nContext";
import type { ObjectiveDraft } from "../../../domain";
import { ACTIVITY_OPTIONS, PACE_OPTIONS } from "./ActivityStep";
import { SEX_OPTIONS } from "./DataStep";
import { GOAL_OPTIONS } from "./GoalStep";
import { PREFERENCE_OPTIONS } from "./PreferencesStep";

interface GenerateActionProps {
  generating: boolean;
  blocked: boolean;
  onGenerate: () => void;
}

export function GenerateAction({ generating, blocked, onGenerate, block }: GenerateActionProps & { block?: boolean }) {
  const { t } = useI18n();
  return (
    <IonButton className="cta-pill" type="button" expand={block ? "block" : undefined}
      disabled={blocked || generating} onClick={onGenerate}>
      {generating ? <IonSpinner slot="start" name="crescent" aria-hidden="true" />
        : <IonIcon slot="start" icon={sparklesOutline} aria-hidden="true" />}
      {t("Generar mi plan")}
    </IonButton>
  );
}

export function GenerateStep({ draft, generating, blocked, onGenerate, hideAction = false }: GenerateActionProps & {
  draft: ObjectiveDraft;
  hideAction?: boolean;
}) {
  const { lang, t } = useI18n();
  const numberFormat = new Intl.NumberFormat(lang);
  const activity = ACTIVITY_OPTIONS.find(({ value }) => value === draft.activity);
  const goal = draft.goal && GOAL_OPTIONS[draft.goal];
  const sex = draft.sex && SEX_OPTIONS[draft.sex];
  const preferences = PREFERENCE_OPTIONS.filter(({ field }) => draft[field])
    .map(({ label }) => t(label));
  const weight = (value: number | null) => value === null ? null : t("{value} kg", { value: numberFormat.format(value) });
  const rows = [
    [t("Tu objetivo"), goal ? t(goal.label) : null],
    [t("Actividad"), activity ? t(activity.label) : null],
    [t("Ritmo del plan"), draft.pace === "s" || draft.pace === "m" ? t(PACE_OPTIONS[draft.pace]) : null],
    [t("Sexo para el cálculo de energía"), sex ? t(sex) : null],
    [t("Edad (años)"), draft.age === null ? null : numberFormat.format(draft.age)],
    [t("Estatura (cm)"), draft.heightCm === null ? null : numberFormat.format(draft.heightCm)],
    [t("Cintura (cm)"), draft.waistCm === null ? null : numberFormat.format(draft.waistCm)],
    [t("Peso actual"), weight(draft.weightKg)],
    [t("Peso meta"), weight(draft.targetWeightKg)],
    [t("Preferencias de alimentación"), preferences.length ? new Intl.ListFormat(lang).format(preferences) : t("Sin preferencias")],
  ];

  return (
    <div className="wl-summary">
      <dl className="wl-kpi-grid" style={{ margin: 0 }}>
        {rows.map(([label, value]) => (
          <div className="wl-kpi" key={label}>
            <dt className="wl-sub">{label}</dt>
            <dd style={{ margin: 0 }}>{value ?? t("Pendiente")}</dd>
          </div>
        ))}
      </dl>
      {!hideAction && <GenerateAction generating={generating} blocked={blocked} onGenerate={onGenerate} block />}
      {generating && <div className="wl-sub" role="status">{t("Generando tu plan…")}</div>}
    </div>
  );
}

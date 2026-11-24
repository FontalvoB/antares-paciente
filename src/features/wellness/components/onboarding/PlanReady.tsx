import { IonBadge, IonButton, IonIcon } from "@ionic/react";
import { arrowForwardOutline } from "ionicons/icons";
import { useI18n } from "../../../../i18n/I18nContext";
import type { PlanPreview } from "../../domain";

export function PlanReady({
  plan,
  firstName,
  onEnter,
}: {
  plan: PlanPreview;
  firstName: string;
  onEnter: () => void;
}) {
  const { t, lang } = useI18n();
  const format = new Intl.NumberFormat(lang === "en" ? "en-US" : "es-ES", {
    maximumFractionDigits: 1,
  });
  const metrics = [
    { label: t("Energía"), value: `${format.format(plan.kcal)} kcal` },
    { label: t("Proteína"), value: `${format.format(plan.proteinG)} g` },
    { label: t("Carbohidratos"), value: `${format.format(plan.carbsG)} g` },
    { label: t("Grasas"), value: `${format.format(plan.fatG)} g` },
    { label: t("Fibra"), value: `${format.format(plan.fiberG)} g` },
    { label: t("Agua"), value: `${format.format(plan.waterMl)} mL` },
  ];
  const name = firstName.trim();

  return (
    <section className="wl-summary">
      <header className="wl-step-head">
        <div className="wl-chips">
          <IonBadge color="primary">
            {t("Día {day}/{total}", {
              day: format.format(plan.day),
              total: format.format(plan.totalDays),
            })}
          </IonBadge>
        </div>
        <h2 className="wl-title">
          {name
            ? t("{name}, tu plan de bienestar está listo", { name })
            : t("Tu plan de bienestar está listo")}
        </h2>
        <p className="wl-sub">
          {t("Vista previa del primer día. Los valores son estimados.")}
        </p>
      </header>
      <dl className="wl-kpi-grid" style={{ margin: 0 }}>
        {metrics.map(({ label, value }) => (
          <div key={label} className="wl-kpi">
            <dt>
              <span>{label}</span>
            </dt>
            <dd style={{ margin: 0 }}>
              <strong>{value}</strong>
            </dd>
          </div>
        ))}
      </dl>
      <div className="wl-footer">
        <IonButton expand="block" onClick={onEnter} style={{ minHeight: 44 }}>
          {t("Entrar")}
          <IonIcon slot="end" icon={arrowForwardOutline} aria-hidden="true" />
        </IonButton>
      </div>
    </section>
  );
}

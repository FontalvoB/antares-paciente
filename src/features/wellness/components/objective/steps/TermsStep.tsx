import { IonCheckbox } from "@ionic/react";
import { useI18n } from "../../../../../i18n/I18nContext";
import { WELLNESS_TERMS_VERSION } from "../../../domain";
import type { ObjectiveDraft } from "../../../domain";

// oxlint-disable-next-line react/only-export-components -- Shares the acceptance check with the wizard.
export function currentAcceptance(terms: ObjectiveDraft["terms"]) {
  if (terms?.version !== WELLNESS_TERMS_VERSION) return null;
  const date = new Date(terms.acceptedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function TermsStep({ draft, onChange, invalidField, errorId }: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  invalidField?: string;
  errorId: string;
}) {
  const { lang, t } = useI18n();
  const acceptedAt = currentAcceptance(draft.terms);

  return (
    <div className="onb-stack">
      <p className="wl-sub">{t("El plan usa tus datos y preferencias para ofrecerte una guía de bienestar.")}</p>
      <p className="wl-sub">{t("La guía no reemplaza la orientación de un profesional.")}</p>
      <p className="wl-sub">{t("Versión {version}", { version: WELLNESS_TERMS_VERSION })}</p>
      <IonCheckbox
        checked={Boolean(acceptedAt)}
        required
        data-wl-field="terms"
        className={invalidField === "terms" ? "ion-invalid ion-touched" : undefined}
        aria-describedby={invalidField === "terms" ? errorId : undefined}
        style={{ minHeight: 44, alignItems: "center", whiteSpace: "normal" }}
        onIonChange={(event) => onChange({
          terms: event.detail.checked
            ? { version: WELLNESS_TERMS_VERSION, acceptedAt: new Date().toISOString() }
            : null,
        })}
      >
        <span style={{ whiteSpace: "normal" }}>{t("Acepto los términos y el aviso de bienestar.")}</span>
      </IonCheckbox>
      <p className="wl-sub">
        {acceptedAt ? (
          <time dateTime={acceptedAt.toISOString()}>
            {t("Aceptado el {date}", {
              date: new Intl.DateTimeFormat(lang, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(acceptedAt),
            })}
          </time>
        ) : t("Pendiente de aceptación.")}
      </p>
    </div>
  );
}

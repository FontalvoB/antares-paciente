import { IonCheckbox, IonIcon } from "@ionic/react";
import { shieldCheckmarkOutline } from "ionicons/icons";
import { useI18n } from "../../../../../i18n/I18nContext";
import { WELLNESS_TERMS_VERSION } from "../../../domain";
import type { ObjectiveDraft } from "../../../domain";

// oxlint-disable-next-line react/only-export-components -- Shares the acceptance check with the wizard.
export function currentAcceptance(terms: ObjectiveDraft["terms"]) {
  if (terms?.version !== WELLNESS_TERMS_VERSION) return null;
  const date = new Date(terms.acceptedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

// oxlint-disable-next-line react/only-export-components -- Shared with immediate step validation.
export function readTerms(checked: boolean, terms: ObjectiveDraft["terms"]) {
  if (!checked) return null;
  return currentAcceptance(terms) ? terms : {
    version: WELLNESS_TERMS_VERSION, acceptedAt: new Date().toISOString(),
  };
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
      <div className="wl-terms-card">
        <IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />
        <div>
          <p>{t("Usamos tus respuestas para adaptar tu guía de bienestar.")}</p>
          <p>{t("La guía no reemplaza la orientación de un profesional.")}</p>
          <small>{t("Versión {version}", { version: WELLNESS_TERMS_VERSION })}</small>
        </div>
      </div>
      <IonCheckbox
        checked={Boolean(acceptedAt)}
        required
        data-wl-field="terms"
        className={`wl-accept${invalidField === "terms" ? " ion-invalid ion-touched" : ""}`}
        aria-describedby={invalidField === "terms" ? errorId : undefined}
        style={{ minHeight: 44, alignItems: "center", whiteSpace: "normal" }}
        onIonChange={(event) => onChange({
          terms: readTerms(event.detail.checked, draft.terms),
        })}
      >
        <span style={{ whiteSpace: "normal" }}>{t("Acepto los términos y el aviso de bienestar.")}</span>
      </IonCheckbox>
      {acceptedAt && (
        <p className="wl-sub">
          <time dateTime={acceptedAt.toISOString()}>
            {t("Aceptado el {date}", {
              date: new Intl.DateTimeFormat(lang, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(acceptedAt),
            })}
          </time>
        </p>
      )}
    </div>
  );
}

import { useId, useState } from "react";
import { IonButton, IonIcon } from "@ionic/react";
import { warningOutline } from "ionicons/icons";
import { EmergencyContactsForm } from "../../../../components/EmergencyContactsForm";
import { useT } from "../../../../i18n/I18nContext";
import { emergencyContactsError } from "../../../../utils/emergencyContacts";
import type { WellnessEmergencyContact } from "../../domain";

export function EmergencyStep({
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
  onContinue,
  onBack,
  disabled = false,
}: {
  primary: WellnessEmergencyContact;
  secondary: WellnessEmergencyContact;
  onPrimaryChange: (v: WellnessEmergencyContact) => void;
  onSecondaryChange: (v: WellnessEmergencyContact) => void;
  onContinue: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const prefix = useId();
  const [submitted, setSubmitted] = useState(false);
  const error = submitted ? emergencyContactsError(primary, secondary) : null;

  return (
    <form
      className="wl-summary"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        setSubmitted(true);
        if (!emergencyContactsError(primary, secondary)) onContinue();
      }}
    >
      <h2 className="wl-title">{t("Contactos de emergencia")}</h2>
      <p className="wl-note wl-note-warn">
        <IonIcon icon={warningOutline} aria-hidden="true" />
        {t("Si tienes una emergencia, llama a los servicios de emergencia de tu localidad.")}
      </p>
      <EmergencyContactsForm
        prefix={prefix}
        primary={primary}
        secondary={secondary}
        onPrimaryChange={onPrimaryChange}
        onSecondaryChange={onSecondaryChange}
        disabled={disabled}
      />
      {error && <p className="wl-note wl-note-danger" role="alert">{t(error)}</p>}
      <div className="wl-footer">
        <IonButton fill="outline" disabled={disabled} onClick={onBack} style={{ minHeight: 44 }}>
          {t("Volver")}
        </IonButton>
        <IonButton type="submit" disabled={disabled} style={{ minHeight: 44 }}>
          {t("Continuar")}
        </IonButton>
      </div>
    </form>
  );
}

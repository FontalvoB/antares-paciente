import { useState } from "react";
import { IonBadge, IonButton, IonCard, IonCardContent, IonIcon } from "@ionic/react";
import { addOutline, peopleOutline, personOutline, shieldCheckmarkOutline, trashOutline } from "ionicons/icons";
import { useT } from "../i18n/I18nContext";
import { emptyEmergencyContact } from "../utils/emergencyContacts";
import type { PatientEmergencyContact } from "../utils/patientProfileApi";
import { EmergencyContactFields } from "./EmergencyContactFields";

/** Las dos pantallas comparten la captura y el borrado explícito del respaldo. */
export function EmergencyContactsForm({ primary, secondary, onPrimaryChange, onSecondaryChange, prefix, disabled = false }: {
  primary: PatientEmergencyContact; secondary: PatientEmergencyContact;
  onPrimaryChange: (value: PatientEmergencyContact) => void; onSecondaryChange: (value: PatientEmergencyContact) => void;
  prefix: string; disabled?: boolean;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded || Object.values(secondary).some(value => value.trim());
  const focus = (id: string) => requestAnimationFrame(() => {
    const el = document.getElementById(id) as HTMLIonInputElement | null;
    if (el?.tagName === "ION-INPUT") void el.setFocus();
    else (el?.shadowRoot?.querySelector("button") as HTMLButtonElement | null)?.focus();
  });
  return <div className="emergency-contacts-form">
    <p className="emergency-contacts-intro"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />{t("Si activas SOS, avisaremos a tus contactos registrados por llamada y SMS. También por correo si lo registras.")}</p>
    <IonCard className="emergency-contact-card emergency-contact-card-primary">
      <IonCardContent>
        <div className="emergency-contact-card-heading">
          <span className="emergency-contact-card-icon"><IonIcon icon={personOutline} aria-hidden="true" /></span>
          <div className="emergency-contact-card-title"><h4>{t("Contacto principal")}</h4><p>{t("Tu primera persona de apoyo")}</p></div>
          <IonBadge className="emergency-contact-required">{t("Obligatorio")}</IonBadge>
        </div>
        <EmergencyContactFields prefix={prefix} value={primary} onChange={onPrimaryChange} disabled={disabled} required countryLabel="País del contacto principal" />
      </IonCardContent>
    </IonCard>
    {visible ? <IonCard id={`${prefix}-optional-card`} className="emergency-contact-card emergency-contact-card-optional">
      <IonCardContent>
        <div className="emergency-contact-card-heading">
          <span className="emergency-contact-card-icon"><IonIcon icon={peopleOutline} aria-hidden="true" /></span>
          <div className="emergency-contact-card-title"><h4>{t("Contacto opcional")}</h4><p>{t("Otra persona que puede ayudarte")}</p></div>
          <IonBadge className="emergency-contact-optional-badge">{t("Opcional")}</IonBadge>
        </div>
        <EmergencyContactFields prefix={`${prefix}2`} value={secondary} onChange={value => { setExpanded(true);onSecondaryChange(value); }} disabled={disabled} countryLabel="País del contacto opcional" />
        <IonButton fill="clear" className="emergency-contact-remove" disabled={disabled} onClick={() => { onSecondaryChange(emptyEmergencyContact());setExpanded(false);focus(`${prefix}-add-optional`); }}><IonIcon slot="start" icon={trashOutline} aria-hidden="true" />{t("Quitar contacto opcional")}</IonButton>
      </IonCardContent>
    </IonCard> : <IonButton id={`${prefix}-add-optional`} fill="outline" expand="block" className="emergency-contact-add" disabled={disabled} aria-expanded={false} aria-controls={`${prefix}-optional-card`} onClick={() => { setExpanded(true);focus(`${prefix}2-name`); }}>
      <IonIcon slot="start" icon={addOutline} aria-hidden="true" />{t("Añadir contacto opcional")}
    </IonButton>}
  </div>;
}

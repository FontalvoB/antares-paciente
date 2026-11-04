import { IonInput, IonSelect, IonSelectOption } from "@ionic/react";
import { PARENTESCO } from "../data/emergencyContact";
import { useT } from "../i18n/I18nContext";
import type { PatientEmergencyContact } from "../utils/patientProfileApi";

/** Mismos campos y límites en onboarding y edición posterior del perfil. */
export function EmergencyContactFields({ value, onChange, prefix, disabled = false }: {
  value: PatientEmergencyContact;
  onChange: (contact: PatientEmergencyContact) => void;
  prefix: string;
  disabled?: boolean;
}) {
  const t = useT();
  const set = (key: keyof PatientEmergencyContact, next: string) => onChange({ ...value, [key]: next });
  return <div className="emergency-contact-fields">
    <div className="field"><label htmlFor={`${prefix}-name`}>{t("Nombre")}</label>
      <IonInput id={`${prefix}-name`} className="fld" value={value.name} maxlength={200} disabled={disabled} autocomplete="name" enterkeyhint="next" onIonInput={e => set("name", e.detail.value ?? "")} />
    </div>
    <div className="field"><label htmlFor={`${prefix}-relationship`}>{t("Parentesco")}</label>
      <IonSelect id={`${prefix}-relationship`} className="fld" value={value.relationship} disabled={disabled} interface="popover" placeholder={t("Selecciona el parentesco")} onIonChange={e => set("relationship", String(e.detail.value ?? ""))}>
        {value.relationship && !PARENTESCO.includes(value.relationship as typeof PARENTESCO[number]) && <IonSelectOption value={value.relationship}>{t(value.relationship)}</IonSelectOption>}
        {PARENTESCO.map(relation => <IonSelectOption key={relation} value={relation}>{t(relation)}</IonSelectOption>)}
      </IonSelect>
    </div>
    <div className="field"><label htmlFor={`${prefix}-cel`}>{t("Celular")}</label>
      <IonInput id={`${prefix}-cel`} className="fld" type="tel" inputmode="tel" value={value.phone} maxlength={20} disabled={disabled} enterkeyhint="next" onIonInput={e => set("phone", e.detail.value ?? "")} />
    </div>
    <div className="field"><label htmlFor={`${prefix}-mail`}>{t("Correo (opcional)")}</label>
      <IonInput id={`${prefix}-mail`} className="fld" type="email" inputmode="email" value={value.email} maxlength={320} disabled={disabled} enterkeyhint="done" onIonInput={e => set("email", e.detail.value ?? "")} />
    </div>
  </div>;
}

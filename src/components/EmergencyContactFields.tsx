import { useState } from "react";
import { IonInput, IonSelect, IonSelectOption } from "@ionic/react";
import { PARENTESCO } from "../data/emergencyContact";
import { useT } from "../i18n/I18nContext";
import { composeEmergencyPhone, splitEmergencyPhone, type ContactPhoneCountry } from "../utils/emergencyPhone";
import type { PatientEmergencyContact } from "../utils/patientProfileApi";

/** Campos compartidos; el número persistido incluye el prefijo internacional. */
export function EmergencyContactFields({ value, onChange, prefix, disabled = false, countryLabel = "País del teléfono", required = false }: {
  value: PatientEmergencyContact; onChange: (contact: PatientEmergencyContact) => void;
  prefix: string; disabled?: boolean; countryLabel?: string; required?: boolean;
}) {
  const t = useT();
  const [emptyCountry, setEmptyCountry] = useState<ContactPhoneCountry>("57");
  const split = splitEmergencyPhone(value.phone);
  const country = value.phone ? split.country : emptyCountry;
  const set = (key: keyof PatientEmergencyContact, next: string) => onChange({ ...value, [key]: next });
  return <div className="emergency-contact-fields">
    <div className="field"><label htmlFor={`${prefix}-name`}>{t("Nombre")}{required && <span aria-hidden="true"> *</span>}</label>
      <IonInput id={`${prefix}-name`} className="fld" value={value.name} maxlength={200} disabled={disabled} required={required} autocomplete="off" enterkeyhint="next" onIonInput={e => set("name", e.detail.value ?? "")} />
    </div>
    <div className="field"><label htmlFor={`${prefix}-relationship`}>{t("Parentesco (opcional)")}</label>
      <IonSelect id={`${prefix}-relationship`} className="fld" value={value.relationship} disabled={disabled} interface="popover" placeholder={t("Selecciona el parentesco")} onIonChange={e => set("relationship", String(e.detail.value ?? ""))}>
        <IonSelectOption value="">{t("Sin especificar")}</IonSelectOption>
        {value.relationship && !PARENTESCO.includes(value.relationship as typeof PARENTESCO[number]) && <IonSelectOption value={value.relationship}>{t(value.relationship)}</IonSelectOption>}
        {PARENTESCO.map(relation => <IonSelectOption key={relation} value={relation}>{t(relation)}</IonSelectOption>)}
      </IonSelect>
    </div>
    <div className="field emergency-contact-phone-field"><label htmlFor={`${prefix}-cel`}>{t("Celular")}{required && <span aria-hidden="true"> *</span>}</label>
      <div className="emergency-contact-phone">
        <IonSelect aria-label={t(countryLabel)} className="fld emergency-contact-country" value={country} selectedText={country === "other" ? t("Otro") : `+${country}`} disabled={disabled} interface="popover" onIonChange={e => {
          const next = String(e.detail.value) as ContactPhoneCountry;setEmptyCountry(next);set("phone", composeEmergencyPhone(next, split.number));
        }}>
          <IonSelectOption value="57">{t("Colombia (+57)")}</IonSelectOption>
          <IonSelectOption value="1">{t("EE. UU. (+1)")}</IonSelectOption>
          <IonSelectOption value="other">{t("Otro país")}</IonSelectOption>
        </IonSelect>
        <IonInput id={`${prefix}-cel`} className="fld" type="tel" inputmode="tel" value={split.number} maxlength={20} disabled={disabled} required={required} autocomplete="off" placeholder={country === "other" ? t("+ código y número") : t("Número de celular")} enterkeyhint="next" onIonInput={e => set("phone", composeEmergencyPhone(country, e.detail.value ?? ""))} />
      </div>
      <p className="emergency-contact-field-hint">{t(country === "other" ? "Incluye + y el código internacional." : "10 dígitos, sin repetir el código de país.")}</p>
    </div>
    <div className="field"><label htmlFor={`${prefix}-mail`}>{t("Correo (opcional)")}</label>
      <IonInput id={`${prefix}-mail`} className="fld" type="email" inputmode="email" value={value.email} maxlength={320} disabled={disabled} autocomplete="off" enterkeyhint="done" onIonInput={e => set("email", e.detail.value ?? "")} />
    </div>
  </div>;
}

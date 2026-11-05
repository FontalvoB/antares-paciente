import { IonBadge, IonCheckbox, IonIcon } from "@ionic/react";
import { documentTextOutline } from "ionicons/icons";
import { useT } from "../i18n/I18nContext";
import { CONSENT_SCROLL_TEST_SECTIONS } from "../data/consentScrollTest";
import { ConsentReadGate } from "./ConsentReadGate";

/** El onboarding y la prueba usan exactamente el mismo documento y controles. */
export function InformedConsentSection({ read, checks, onRead, onChecked, testDocument = false }: {
  read: boolean; checks: readonly boolean[]; onRead: () => void; testDocument?: boolean;
  onChecked: (index: number, checked: boolean) => void;
}) {
  const t = useT();
  const showTestText = typeof __DEV_TOOLS__ !== "undefined" && __DEV_TOOLS__ && testDocument;
  return <section className="onb-card tone-teal">
    <div className="onb-card-head">
      <span className="onb-card-ico tone-teal"><IonIcon icon={documentTextOutline} /></span>
      <div><strong>{t("Consentimiento informado")}</strong><span>{t("COPP-ADRESD · 24 semanas")}</span></div>
    </div>
    {showTestText && <div className="onb-consent-test-note">
      <IonBadge>{t("Texto largo de prueba")}</IonBadge>
      <p>{t("Temporal: para comprobar el desbloqueo al llegar al final.")}</p>
    </div>}
    <ConsentReadGate alreadyRead={read} onRead={onRead}>
      <strong style={{ color: "var(--tx)" }}>{t("Programa de medicina preventiva")}</strong>
      <p style={{ margin: "8px 0 0" }}>{t("Tus datos son PHI según HIPAA. FYA TECH SAS actúa como Business Associate. Los datos biométricos se cifran con AES-256. Las fotos de comida se eliminan en 24 h. Autorizas el contacto de emergencia si activas SOS.")}</p>
      {showTestText && <div className="onb-consent-test-copy">
        {CONSENT_SCROLL_TEST_SECTIONS.map(section => <section key={section.title}><h4>{t(section.title)}</h4><p>{t(section.body)}</p></section>)}
        <strong>{t("Fin del texto de prueba")}</strong>
        <p>{t("Ya llegaste al final. Ahora puedes marcar las casillas y continuar.")}</p>
      </div>}
    </ConsentReadGate>
    {[
      t("He leído y acepto el consentimiento informado."),
      t("Autorizo el manejo de mis datos de salud según HIPAA."),
      t("Autorizo notificar a mis contactos de emergencia."),
    ].map((label, index) => <IonCheckbox key={label} className="onb-consent-check" labelPlacement="end" justify="start" disabled={!read} checked={checks[index] ?? false} onIonChange={event => onChecked(index, event.detail.checked)}>{label}</IonCheckbox>)}
  </section>;
}

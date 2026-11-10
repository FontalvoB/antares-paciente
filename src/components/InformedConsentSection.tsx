import { IonBadge, IonCheckbox, IonIcon } from "@ionic/react";
import { documentTextOutline } from "ionicons/icons";
import { useT } from "../i18n/I18nContext";
import { CONSENT_SCROLL_TEST_SECTIONS } from "../data/consentScrollTest";
import { ConsentReadGate } from "./ConsentReadGate";

/** Controles de lectura para la vista local de prueba; no representa una autorización. */
export function InformedConsentSection({ read, checks, onRead, onChecked, testDocument = false }: {
  read: boolean; checks: readonly boolean[]; onRead: () => void; testDocument?: boolean;
  onChecked: (index: number, checked: boolean) => void;
}) {
  const t = useT();
  const showTestText = typeof __DEV_TOOLS__ !== "undefined" && __DEV_TOOLS__ && testDocument;
  return <section className="onb-card tone-teal">
    <div className="onb-card-head">
      <span className="onb-card-ico tone-teal"><IonIcon icon={documentTextOutline} /></span>
      <div><strong>{t("Prueba de lectura")}</strong><span>{t("Documento de prueba")}</span></div>
    </div>
    {showTestText && <div className="onb-consent-test-note">
      <IonBadge>{t("Texto largo de prueba")}</IonBadge>
      <p>{t("Temporal: para comprobar el desbloqueo al llegar al final.")}</p>
    </div>}
    <ConsentReadGate alreadyRead={read} onRead={onRead}>
      <strong style={{ color: "var(--tx)" }}>{t("Documento de prueba")}</strong>
      <p style={{ margin: "8px 0 0" }}>{t("Texto de prueba para comprobar la lectura y los controles. No es una autorización.")}</p>
      {showTestText && <div className="onb-consent-test-copy">
        {CONSENT_SCROLL_TEST_SECTIONS.map(section => <section key={section.title}><h4>{t(section.title)}</h4><p>{t(section.body)}</p></section>)}
        <strong>{t("Fin del texto de prueba")}</strong>
        <p>{t("Ya llegaste al final. Ahora puedes marcar las casillas y continuar.")}</p>
      </div>}
    </ConsentReadGate>
    {[0, 1, 2].map(index => <IonCheckbox key={index} className="onb-consent-check" labelPlacement="end" justify="start" disabled={!read} checked={checks[index] ?? false} onIonChange={event => onChecked(index, event.detail.checked)}>{t("Casilla de prueba {number}", { number: String(index + 1) })}</IonCheckbox>)}
  </section>;
}

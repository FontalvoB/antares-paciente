import { useState } from "react";
import { IonButton } from "@ionic/react";
import { InformedConsentSection } from "../components/InformedConsentSection";
import { LanguageToggle } from "../components/LanguageToggle";
import { useT } from "../i18n/I18nContext";

/** Vista local de prueba: no monta Auth, no consulta pacientes ni guarda aceptaciones. */
export function ConsentPreviewPage({ longText = false }: { longText?: boolean }) {
  const t = useT();
  const [round, setRound] = useState(0);
  const [read, setRead] = useState(false);
  const [checks, setChecks] = useState([false, false, false]);
  const [complete, setComplete] = useState(false);
  return <div className="screen onb-page consent-preview">
    <header className="onb-head">
      <div className="onb-head-top"><span className="onb-head-brand">Copp Adresd</span><LanguageToggle /></div>
      <h1>{t("Prueba de consentimiento")}</h1>
      <p>{t("Desliza dentro del texto hasta llegar al final.")}</p>
    </header>
    <div className="screen-scroll no-nav onb-body">
      <InformedConsentSection testDocument={longText} key={round} read={read} checks={checks} onRead={() => setRead(true)} onChecked={(index, checked) => setChecks(current => current.map((value, i) => i === index ? checked : value))} />
      {complete && <p className="consent-preview-complete" role="status">{t("Prueba completada. No se ha guardado ninguna aceptación.")}</p>}
    </div>
    <footer className="onb-foot"><div className="onb-foot-row">
      <IonButton fill="clear" className="bt bt-ghost" onClick={() => { setRead(false); setChecks([false, false, false]); setComplete(false); setRound(value => value + 1); }}>{t("Reiniciar prueba")}</IonButton>
      <IonButton className="bt bt-primary" disabled={!read || !checks.every(Boolean)} onClick={() => setComplete(true)}>{t("Continuar")}</IonButton>
    </div></footer>
  </div>;
}

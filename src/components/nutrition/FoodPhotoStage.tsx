import type { ReactNode } from "react";
import { IonIcon, IonSpinner } from "@ionic/react";
import { scanOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";

/** Composición de dominio compartida por revisión y análisis; el barrido es decorativo. */
export function FoodPhotoStage({ src, analyzing = false, children }: {
  src: string; analyzing?: boolean; children?: ReactNode;
}) {
  const t = useT();
  return <section className={`food-photo-stage${analyzing ? ' is-analyzing' : ''}`}>
    <header className="food-photo-heading">
      <span className="food-photo-brand"><IonIcon icon={scanOutline} aria-hidden="true" /> FOOD AI</span>
      <h3>{analyzing ? t("Analizando tu comida…") : t("Revisa tu foto")}</h3>
      <p>{analyzing ? t("Estamos estimando los alimentos, las porciones y sus nutrientes.") : t("Un plato completo. Una foto clara.")}</p>
    </header>
    <div className="food-photo-frame">
      <img src={src} alt={t("Fotografía de la comida")} />
      <div className="food-photo-corners" aria-hidden="true" />
      {analyzing && <div className="food-photo-scan" aria-hidden="true" />}
      <span className="food-photo-caption">{analyzing ? t("Análisis en curso") : t("Vista previa")}</span>
    </div>
    {analyzing ? <div className="food-photo-status" role="status">
      <IonSpinner name="crescent" aria-hidden="true" />
      <div><strong>{t("Preparando tu resumen nutricional")}</strong><p>{t("Esto puede tardar unos segundos.")}</p></div>
    </div> : <p className="food-photo-privacy"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />{t("Tu foto se enviará solo cuando pulses analizar.")}</p>}
    {children}
  </section>;
}

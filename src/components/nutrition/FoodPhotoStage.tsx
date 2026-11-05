import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IonIcon, IonSpinner } from "@ionic/react";
import { scanOutline, shieldCheckmarkOutline, restaurantOutline, scaleOutline, nutritionOutline } from "ionicons/icons";
import { FOOD_SPRING } from "./foodMotion";
import { useT } from "../../i18n/I18nContext";

/** Composición de dominio compartida por revisión y análisis; el barrido es decorativo. */
export function FoodPhotoStage({ src, analyzing = false, children }: {
  src: string; analyzing?: boolean; children?: ReactNode;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!analyzing || reduced) return;
    const timer = window.setInterval(() => setStep(value => (value + 1) % 3), 1200);
    return () => window.clearInterval(timer);
  }, [analyzing, reduced]);
  const steps = [
    { label: t("Detectando alimentos"), icon: restaurantOutline },
    { label: t("Estimando porciones"), icon: scaleOutline },
    { label: t("Calculando nutrición"), icon: nutritionOutline },
  ];
  return <section className={`food-photo-stage${analyzing ? ' is-analyzing' : ''}`}>
    <header className="food-photo-heading">
      <span className="food-photo-brand"><IonIcon icon={scanOutline} aria-hidden="true" /> FOOD AI</span>
      <h3>{analyzing ? t("Analizando tu comida…") : t("Revisa tu foto")}</h3>
      <p>{analyzing ? t("Estamos estimando los alimentos, las porciones y sus nutrientes.") : t("Un plato completo. Una foto clara.")}</p>
    </header>
    <div className="food-photo-frame">
      <img className="food-photo-backdrop" src={src} alt="" aria-hidden="true" />
      <img src={src} alt={t("Fotografía de la comida")} />
      <div className="food-photo-corners" aria-hidden="true" />
      {analyzing && <div className="food-photo-scan" aria-hidden="true" />}
      <span className="food-photo-caption">{analyzing && <IonSpinner name="crescent" aria-hidden="true" />}{analyzing ? t("Análisis en curso") : t("Vista previa")}</span>
    </div>
    {analyzing ? <div className="food-photo-status" role="status">
      <strong>{t("Preparando tu resumen nutricional")}</strong>
      <ol className="food-analysis-steps" aria-label={t("Análisis en curso")}>
        {steps.map((item, index) => <li key={item.label} className={index === step ? 'is-active' : ''} aria-current={index === step ? 'step' : undefined}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={`${index}-${index === step}`} className="food-step-icon"
              initial={{ opacity: 0, ...(reduced ? {} : { scale: 0.85, y: 4 }) }}
              animate={{ opacity: 1, ...(reduced ? {} : { scale: 1, y: 0 }) }}
              exit={{ opacity: 0 }} transition={reduced ? { duration: 0.18 } : FOOD_SPRING}>
              <IonIcon icon={item.icon} aria-hidden="true" />
            </motion.span>
          </AnimatePresence>
          <span>{item.label}</span>
          <span className="food-step-dot" aria-hidden="true" />
        </li>)}
      </ol>
      <p>{t("Esto puede tardar unos segundos.")}</p>
    </div> : <p className="food-photo-privacy"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />{t("Tu foto se enviará solo cuando pulses analizar.")}</p>}
    {children}
  </section>;
}

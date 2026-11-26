import { WellnessModuleArt } from "./WellnessModuleArt";
import { GOAL_LABEL, useWellnessOverview } from "./useWellnessOverview";
import { useState } from "react";
import { IonButton, IonIcon, IonProgressBar } from "@ionic/react";
import { arrowForward, barbellOutline, barChartOutline, checkmark, chevronForward, flagOutline, leafOutline, medicalOutline, moonOutline, peopleOutline, restaurantOutline, trophyOutline } from "ionicons/icons";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { WellnessFrame, WellnessPreview } from "./WellnessFrame";
import { VitaEntry } from "../vita";

export function WellnessPlan() {
  const { user, navigate, openTests, openPanic } = useApp();
  const { t } = useI18n();
  const data = useWellnessOverview(user.nombre);
  const [preview, setPreview] = useState("");
  const progress = Math.round(data.day / data.totalDays * 100);
  const stages = [
    { title: "Evaluación", icon: checkmark, done: data.batteriesCompleted === data.batteriesTotal, action: openTests },
    { title: "Nutrición", icon: restaurantOutline, done: false, action: () => navigate("wellness-diet") },
    { title: "Actividad", icon: barbellOutline, done: false, action: () => navigate("wellness-exercise") },
    { title: "Bienestar", icon: moonOutline, done: false, action: () => navigate("wellness-checkin") },
    { title: "Seguimiento", icon: barChartOutline, done: false, action: () => navigate("wellness-vitals") },
  ];
  const modules = [
    { title: "Nutrición", copy: "Planes, menús y seguimiento con IA.", icon: leafOutline, action: () => navigate("wellness-diet") },
    { title: "Medicamentos", copy: "Recordatorios, control y adherencia.", icon: medicalOutline, action: () => setPreview("Medicamentos") },
    { title: "Comunidad", copy: "Retos, soporte y avanza juntos.", icon: peopleOutline, action: () => setPreview("Comunidad") },
    { title: "SOS", copy: "Atención y orientación inmediata 24/7.", icon: medicalOutline, action: openPanic },
  ];
  return <WellnessFrame back>
    <section className="wh-plan-card" aria-labelledby="wh-plan-title">
      <div className="wh-plan-top"><h2 id="wh-plan-title"><IonIcon icon={flagOutline} />{t("Tu Plan de Bienestar")}</h2><span>{t("Semana {week} de {total}", { week: String(Math.ceil(data.day / 7)), total: String(Math.ceil(data.totalDays / 7)) })}</span></div>
      <div className="wh-plan-objective"><div><h3>{t("Objetivo")}: <span>{t(GOAL_LABEL[data.plan.goal])}</span></h3><p>{t("Plan personalizado con IA")}</p></div>
        <div className="wh-mini-ring"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="37" /><circle cx="45" cy="45" r="37" pathLength="100" strokeDasharray={`${data.protocolDone / data.protocol.length * 78} 100`} /></svg><strong>{data.protocolDone} / {data.protocol.length}</strong><span>{t("Actividades completadas")}</span><IonIcon icon={trophyOutline} /></div>
      </div>
      <div className="wh-plan-stages">{stages.map(stage => <IonButton fill="clear" className={stage.done ? "is-done" : ""} key={stage.title} onClick={stage.action}><span><i><IonIcon icon={stage.icon} /></i><span>{t(stage.title)}</span></span></IonButton>)}</div>
      <IonButton className="wh-continue" onClick={() => navigate("protocol")}>{t("Continuar mi plan")}<IonIcon slot="end" icon={arrowForward} /></IonButton>
    </section>
    <IonButton fill="clear" className="wh-plan-progress" onClick={() => navigate("protocol")}>
      <span className="wh-bars" aria-hidden="true"><i /><i /><i /></span>
      <span className="wh-plan-progress-copy"><strong>{t("Tu Progreso")}</strong><span>{t("{day} de {total} días", { day: String(data.day), total: String(data.totalDays) })} · {t("{percent}% del objetivo", { percent: String(progress) })}</span><IonProgressBar value={data.day / data.totalDays} aria-label={t("Progreso del plan")} /></span><IonIcon icon={chevronForward} />
    </IonButton>
    <section className="wh-modules" aria-label={t("Accesos rápidos")}>{modules.map(module => <IonButton fill="clear" className={`wh-module${module.title === "SOS" ? " wh-module-sos" : ""}`} key={module.title} onClick={module.action}><span className="wh-module-copy"><IonIcon icon={module.icon} /><strong>{t(module.title)}</strong><span>{t(module.copy)}</span></span><span className="wh-module-art" aria-hidden="true"><WellnessModuleArt kind={module.title} /></span></IonButton>)}</section>
    <WellnessPreview title={preview} open={!!preview} onClose={() => setPreview("")} />
    {/* KAN-167: panel único de Vita, abierto por el orbe y el compositor de WellnessFrame. */}
    <VitaEntry module="plan" docked={false} />
  </WellnessFrame>;
}

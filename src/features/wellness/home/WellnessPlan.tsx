import { changeMotorAiAdjustment, motorPlanUserId, type MotorDay } from "../calendar/motor-plan-api";
import { useMotorDay } from "../calendar/useMotorDay";
import { WellnessModuleArt } from "./WellnessModuleArt";
import { GOAL_LABEL, useWellnessOverview } from "./useWellnessOverview";
import { useEffect, useRef, useState } from "react";
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
  const motor = useMotorDay();
  const account = motorPlanUserId();
  const day = motor.kind === "ready" ? motor.day.today : motor.kind === "legacy" ? data.day : null;
  const progress = day === null ? null : Math.round(day / data.totalDays * 100);
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
      <div className="wh-plan-top"><h2 id="wh-plan-title"><IonIcon icon={flagOutline} />{t("Tu Plan de Bienestar")}</h2><span>{day === null ? t("Día del plan no disponible") : t("Semana {week} de {total}", { week: String(Math.ceil(day / 7)), total: String(Math.ceil(data.totalDays / 7)) })}</span></div>
      <div className="wh-plan-objective"><div><h3>{t("Objetivo")}: <span>{t(GOAL_LABEL[data.plan.goal])}</span></h3><p>{motor.kind === "ready" ? t("Plan del Motor 365") : t("Plan personalizado con IA")}</p></div>
        <div className="wh-mini-ring"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="37" /><circle cx="45" cy="45" r="37" pathLength="100" strokeDasharray={`${data.protocolDone / data.protocol.length * 78} 100`} /></svg><strong>{data.protocolDone} / {data.protocol.length}</strong><span>{t("Actividades completadas")}</span><IonIcon icon={trophyOutline} /></div>
      </div>
      <div className="wh-plan-stages">{stages.map(stage => <IonButton fill="clear" className={stage.done ? "is-done" : ""} key={stage.title} onClick={stage.action}><span><i><IonIcon icon={stage.icon} /></i><span>{t(stage.title)}</span></span></IonButton>)}</div>
      <IonButton className="wh-continue" onClick={() => navigate("protocol")}>{t("Continuar mi plan")}<IonIcon slot="end" icon={arrowForward} /></IonButton>
    </section>
    {account && motor.kind === "ready" && !motor.stale && (motor.day.aiAdjustmentAvailable || motor.day.aiAdjustment) && (
      <PlanAiAdjustment key={account + ":" + motor.day.todayLocalDate} account={account} day={motor.day} />
    )}
    <IonButton fill="clear" className="wh-plan-progress" onClick={() => navigate("protocol")}>
      <span className="wh-bars" aria-hidden="true"><i /><i /><i /></span>
      <span className="wh-plan-progress-copy"><strong>{t("Tu Progreso")}</strong><span>{day === null ? t("Día del plan no disponible") : `${t("{day} de {total} días", { day: String(day), total: String(data.totalDays) })} · ${t("{percent}% del objetivo", { percent: String(progress) })}`}</span>{day !== null && <IonProgressBar value={day / data.totalDays} aria-label={t("Progreso del plan")} />}</span><IonIcon icon={chevronForward} />
    </IonButton>
    <section className="wh-modules" aria-label={t("Accesos rápidos")}>{modules.map(module => <IonButton fill="clear" className={`wh-module${module.title === "SOS" ? " wh-module-sos" : ""}`} key={module.title} onClick={module.action}><span className="wh-module-copy"><IonIcon icon={module.icon} /><strong>{t(module.title)}</strong><span>{t(module.copy)}</span></span><span className="wh-module-art" aria-hidden="true"><WellnessModuleArt kind={module.title} /></span></IonButton>)}</section>
    <WellnessPreview title={preview} open={!!preview} onClose={() => setPreview("")} />
    {/* KAN-167: panel único de Vita, abierto por el orbe y el compositor de WellnessFrame. */}
    <VitaEntry module="plan" docked={false} />
  </WellnessFrame>;
}


function PlanAiAdjustment({ account, day }: { account: string; day: MotorDay }) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const applied = day.aiAdjustment?.status === "applied";
  const change = async () => {
    if (request.current || !navigator.onLine) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setFailed(false);
    try {
      await changeMotorAiAdjustment(account, day.today, applied ? "DELETE" : "POST", controller.signal);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <section className="wh-card" aria-labelledby="wh-ai-adjustment-title" aria-busy={busy}>
    <div className="wh-card-head"><h2 id="wh-ai-adjustment-title">{t("Ajuste de plan con IA")}</h2></div>
    <p className="wh-body" role="status">
      {busy ? t("Actualizando tu plan…") : failed
        ? t("No pudimos actualizar tu plan. Intenta de nuevo.")
        : day.aiAdjustment?.reason[lang] ?? t("El motor revisa cada propuesta. Puedes volver al plan base.")}
    </p>
    {day.aiAdjustmentAvailable && <IonButton size="default" disabled={busy} onClick={() => void change()}>
      {applied ? t("Volver al plan base") : t("Solicitar ajuste")}
    </IonButton>}
  </section>;
}

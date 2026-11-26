import { useEffect, useState } from "react";
import { IonButton, IonDatetime, IonIcon, IonItem, IonList, IonPopover, IonToggle } from "@ionic/react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { arrowBackOutline, notificationsOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { checkinOwner } from "../checkin/checkin-store";
import {
  isReminderTime,
  loadReminderPreferences,
  REMINDER_TYPES,
  subscribeReminderPreferences,
  updateReminderPreference,
  type ReminderPreference,
  type ReminderType,
} from "./reminder-preferences";
import { supportsNativeReminders } from "./reminder-scheduler";
import "./wellness-notifications.css";
import { VitaEntry } from "../vita";

const DETAILS = {
  protocol: ["Recordatorio del protocolo", "A la hora elegida, si aún no has empezado."],
  chest: ["Cofre listo", "Al completar los primeros cuatro pasos y cuando ya sea la hora elegida."],
  streak: ["Racha en riesgo", "A la hora de cierre, si todavía te faltan pasos."],
  ai: ["Pregunta de la IA", "Hasta una vez al día. Puedes posponer el aviso."],
} as const;

type TimeField = "time" | "quietStart" | "quietEnd";
const TIME_FIELDS = {
  time: "Hora del aviso",
  quietStart: "Inicio del silencio",
  quietEnd: "Fin del silencio",
} as const;

export function WellnessNotifications() {
  const { navigate, showToast, user } = useApp();
  const { lang, t } = useI18n();
  const owner = checkinOwner(user);
  const [prefs, setPrefs] = useState(() => loadReminderPreferences(owner));
  const [picker, setPicker] = useState<{ type: ReminderType; field: TimeField; event: Event }>();
  const [nativeGranted, setNativeGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const snoozeUntil = prefs.ai.snoozeUntil;
  const locale = lang === "es" ? "es-CO" : "en-US";
  const native = supportsNativeReminders();

  useEffect(() => {
    const refresh = () => setPrefs(loadReminderPreferences(owner));
    refresh();
    return subscribeReminderPreferences(owner, refresh);
  }, [owner]);

  useEffect(() => {
    const remaining = (snoozeUntil ?? 0) - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setPrefs(loadReminderPreferences(owner)), remaining);
    return () => window.clearTimeout(timer);
  }, [owner, snoozeUntil]);

  useEffect(() => {
    if (!native) return;
    let active = true;
    void LocalNotifications.checkPermissions().then(({ display }) => {
      if (active) setNativeGranted(display === "granted");
    }).catch(() => {});
    return () => { active = false; };
  }, [native]);

  function save(type: ReminderType, change: Partial<ReminderPreference>) {
    try {
      setPrefs(updateReminderPreference(owner, type, change));
    } catch {
      showToast(t("No se pudieron guardar las preferencias de notificaciones."), "err");
    }
  }

  async function enableNative() {
    setRequesting(true);
    try {
      const { display } = await LocalNotifications.requestPermissions();
      setNativeGranted(display === "granted");
      if (display !== "granted") showToast(t("Puedes permitir los avisos en los ajustes del dispositivo."), "info");
    } catch {
      showToast(t("Puedes permitir los avisos en los ajustes del dispositivo."), "info");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Screen className="wn-screen">
      <Scroll className="wn-scroll">
        <main className="wn-content">
          <header className="wn-header">
            <IonButton fill="clear" className="wn-back" onClick={() => navigate("prof")}>
              <IonIcon slot="start" icon={arrowBackOutline} aria-hidden="true" />
              {t("Volver al perfil")}
            </IonButton>
            <h1>{t("Preferencias de notificaciones")}</h1>
            <p><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />{t("En la pantalla de bloqueo solo verás un aviso genérico.")}</p>
            <p>{t("Usamos la hora local del dispositivo. Si las horas de silencio coinciden, no hay silencio.")}</p>
          </header>

          {REMINDER_TYPES.map((type) => {
            const [label, description] = DETAILS[type];
            const pref = prefs[type];
            return (
              <section className="wn-card" key={type} aria-labelledby={`wn-${type}`}>
                <h2 className="wn-card-heading" id={`wn-${type}`}>
                  <IonToggle
                    labelPlacement="start"
                    justify="space-between"
                    checked={pref.enabled}
                    onIonChange={(event) => save(type, { enabled: event.detail.checked })}
                  >{t(label)}</IonToggle>
                </h2>
                <p>{t(description)}</p>
                {pref.enabled && (
                  <IonList className="wn-times" lines="none">
                    {(Object.keys(TIME_FIELDS) as TimeField[]).map((field) => (
                      <IonItem key={field}>
                        <IonButton
                          fill="clear"
                          expand="block"
                          className="wn-time"
                          aria-label={t("{field} de {type}, {time}", {
                            field: t(TIME_FIELDS[field]), type: t(label), time: pref[field],
                          })}
                          aria-haspopup="dialog"
                          onClick={(event) => setPicker({ type, field, event: event.nativeEvent })}
                        >
                          <span className="wn-time-content">
                            <span>{t(TIME_FIELDS[field])}</span>
                            <strong>{pref[field]}</strong>
                          </span>
                        </IonButton>
                      </IonItem>
                    ))}
                  </IonList>
                )}
                {type === "ai" && pref.enabled && (
                  <div className="wn-snooze">
                    {pref.snoozeUntil && pref.snoozeUntil > Date.now() ? (
                      <>
                        <p role="status">
                          {t("Pregunta pospuesta hasta {time}.", {
                            time: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(pref.snoozeUntil),
                          })}
                        </p>
                        <IonButton fill="clear" onClick={() => save(type, { snoozeUntil: null })}>{t("Quitar el aplazamiento")}</IonButton>
                      </>
                    ) : (
                      <IonButton fill="clear" onClick={() => save(type, { snoozeUntil: Date.now() + 60 * 60_000 })}>{t("Posponer la pregunta 1 hora")}</IonButton>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          <div className="wn-actions">
            {native && !nativeGranted && (
              <IonButton expand="block" fill="outline" disabled={requesting} onClick={() => void enableNative()}>
                {t("Permitir avisos del dispositivo")}
              </IonButton>
            )}
            <IonButton expand="block" onClick={() => showToast(t("Aviso de prueba en la app."), "info")}>
              <IonIcon slot="start" icon={notificationsOutline} aria-hidden="true" />
              {t("Probar aviso en la app")}
            </IonButton>
          </div>
          <IonPopover
            isOpen={Boolean(picker)}
            event={picker?.event}
            aria-label={picker ? t(TIME_FIELDS[picker.field]) : undefined}
            onDidDismiss={() => setPicker(undefined)}
          >
            {picker && (
              <IonDatetime
                presentation="time"
                hourCycle="h23"
                locale={locale}
                value={prefs[picker.type][picker.field]}
                showDefaultButtons
                doneText={t("Guardar")}
                cancelText={t("Cancelar")}
                onIonChange={({ detail }) => {
                  const value = typeof detail.value === "string"
                    ? /(?:^|T)(\d\d:\d\d)/.exec(detail.value)?.[1]
                    : undefined;
                  if (isReminderTime(value)) save(picker.type, { [picker.field]: value });
                }}
              />
            )}
          </IonPopover>
        </main>
      </Scroll>
      <VitaEntry module="notifications" />
    </Screen>
  );
}

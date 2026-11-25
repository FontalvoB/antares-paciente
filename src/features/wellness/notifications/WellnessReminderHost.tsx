import { useEffect, useRef, useState } from "react";
import { IonToast } from "@ionic/react";
import { App as NativeApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useApp } from "../../../context/AppContext";
import { useT } from "../../../i18n/I18nContext";
import { checkinOwner, subscribeCheckins } from "../checkin/checkin-store";
import { subscribeProtocolHistory } from "../state/wellness-home-store";
import { subscribeReminderPreferences, type ReminderType } from "./reminder-preferences";
import { cancelNativeReminders, reconcileReminders, reminderTypeForNativeId, supportsNativeReminders } from "./reminder-scheduler";

const IN_APP_COPY: Record<ReminderType, string> = {
  protocol: "Ya puedes empezar tu protocolo de hoy.",
  chest: "Tu cofre del día está listo.",
  streak: "Todavía puedes completar el protocolo de hoy.",
  ai: "¿Qué pequeño paso te gustaría dar hoy?",
};

export function WellnessReminderHost() {
  const { user, navigate, openTests, panicOpen, voiceOpen } = useApp();
  const t = useT();
  const owner = checkinOwner(user);
  const [message, setMessage] = useState<ReminderType>();
  const toastInFlight = useRef(false);
  const callbacks = useRef({ t, navigate, openTests, panicOpen, voiceOpen });
  const refreshRef = useRef<() => void>(undefined);

  useEffect(() => {
    callbacks.current = { t, navigate, openTests, panicOpen, voiceOpen };
  }, [t, navigate, openTests, panicOpen, voiceOpen]);

  useEffect(() => {
    let active = true;
    let timer: number;
    const show = (type: ReminderType) => {
      toastInFlight.current = true;
      setMessage(type);
    };
    const session = {
      owner,
      active: () => active,
      mayShowToast: () => !toastInFlight.current && !callbacks.current.panicOpen && !callbacks.current.voiceOpen,
      show,
      translate: (source: string) => callbacks.current.t(source),
    };
    const refresh = () => {
      window.clearTimeout(timer);
      void reconcileReminders(session);
      // Re-evaluate at the next clock minute, including local midnight.
      timer = window.setTimeout(refresh, 60_000 - (Date.now() % 60_000) + 10);
    };
    refreshRef.current = refresh;
    const unsubscribe = [
      subscribeReminderPreferences(owner, refresh),
      subscribeProtocolHistory(refresh),
      subscribeCheckins(owner, refresh),
    ];
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const listeners = supportsNativeReminders() ? [
      NativeApp.addListener("appStateChange", refresh),
      LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        const type = reminderTypeForNativeId(notification.id);
        if (!active || !type) return;
        if (type === "ai") {
          show(type);
        } else {
          callbacks.current.navigate("protocol");
        }
      }),
    ] : [];
    refresh();
    return () => {
      active = false;
      refreshRef.current = undefined;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      unsubscribe.forEach((remove) => remove());
      listeners.forEach((listener) => {
        void listener.then((handle) => handle.remove()).catch(() => {});
      });
      cancelNativeReminders(owner);
    };
  }, [owner]);

  useEffect(() => {
    refreshRef.current?.();
  }, [t, panicOpen, voiceOpen]);

  if (!message) return null;
  return (
    <IonToast
      isOpen
      className="app-toast wellness-reminder-toast"
      position="top"
      message={t(IN_APP_COPY[message])}
      duration={6000}
      onDidDismiss={() => {
        toastInFlight.current = false;
        setMessage(undefined);
        refreshRef.current?.();
      }}
      buttons={[{
        text: message === "ai" ? t("Ver evaluaciones") : t("Ver protocolo"),
        handler: () => {
          if (message === "ai") openTests();
          else navigate("protocol");
        },
      }]}
    />
  );
}

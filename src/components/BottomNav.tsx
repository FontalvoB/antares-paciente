import {APPOINTMENTS_ENABLED} from "../utils/appointmentsVisibility";
import { IonBadge, IonButton, IonIcon } from "@ionic/react";
import {
  calendar,
  calendarOutline,
  nutrition,
  nutritionOutline,
  chatbubbleEllipses,
  chatbubbleEllipsesOutline,
  home,
  homeOutline,
  medkit,
  micOutline,
  person,
  personOutline,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import type { Screen } from "../types";

export function BottomNav({ dark = false }: { dark?: boolean }) {
  const { screen, navigate, openPanic, openVoice, chatUnread } = useApp();
  const t = useT();

  const items: {
    id: Screen;
    label: string;
    icon: string;
    iconOn: string;
    vita?: boolean;
  }[] = [
    { id: "home", label: t("Inicio"), icon: homeOutline, iconOn: home },
    APPOINTMENTS_ENABLED
      ? { id: "book", label: t("Citas"), icon: calendarOutline, iconOn: calendar }
      : { id: "nut", label: t("Nutrición"), icon: nutritionOutline, iconOn: nutrition },
    //{ id: 'nut', label: t('Nutrición'), icon: leafOutline, iconOn: leaf },
    { id: "chat", label: "Vita", icon: micOutline, iconOn: micOutline, vita: true },
    {
      id: "chat",
      label: t("Chat"),
      icon: chatbubbleEllipsesOutline,
      iconOn: chatbubbleEllipses,
    },
    { id: "prof", label: t("Perfil"), icon: personOutline, iconOn: person },
  ];

  return (
    <nav className={`bnav premium-nav ${dark ? "bnav-dark" : ""}`} aria-label={t('Navegación principal')}>
      {items.map((it, i) => {
        if (it.vita) {
          return (
            <IonButton
              key="vita"
              type="button"
              className="ni ni-vita"
              fill="clear"
              onClick={openVoice}
              aria-label={t("Hablar con Vita")}
            >
              <span className="premium-nav-content"><span className="ni-ico">
                <IonIcon icon={micOutline} aria-hidden="true" />
              </span>
              <span>Vita</span></span>
            </IonButton>
          );
        }
        const on = screen === it.id;
        return (
          <IonButton
            key={`${it.id}-${i}`}
            type="button"
            fill="clear"
            className={`ni ${on ? "on" : ""}`}
            onClick={() => navigate(it.id)}
            aria-current={on ? "page" : undefined}
          >
            <span className="premium-nav-content"><span className="ni-ico">
              <IonIcon icon={on ? it.iconOn : it.icon} aria-hidden="true" />
              {it.id === "chat" && Boolean(chatUnread) && (
                <IonBadge
                  className="ni-dot"
                  aria-label={t("Nuevos mensajes")}
                />
              )}
            </span>
            <span>{it.label}</span></span>
          </IonButton>
        );
      })}
      <IonButton className="premium-sos" fill="clear" onClick={openPanic} aria-label={t('Botón de pánico')}><IonIcon icon={medkit} slot="start" aria-hidden="true" />SOS</IonButton>
    </nav>
  );
}

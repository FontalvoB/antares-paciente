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
  person,
  personOutline,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import type { Screen } from "../types";

export function BottomNav({ dark = false }: { dark?: boolean }) {
  const { screen, navigate, openPanic, chatUnread } = useApp();
  const t = useT();

  const items: {
    id: Screen;
    label: string;
    icon: string;
    iconOn: string;
    sos?: boolean;
  }[] = [
    { id: "home", label: t("Inicio"), icon: homeOutline, iconOn: home },
    APPOINTMENTS_ENABLED
      ? { id: "book", label: t("Citas"), icon: calendarOutline, iconOn: calendar }
      : { id: "nut", label: t("Nutrición"), icon: nutritionOutline, iconOn: nutrition },
    //{ id: 'nut', label: t('Nutrición'), icon: leafOutline, iconOn: leaf },
    { id: "home", label: t("SOS"), icon: medkit, iconOn: medkit, sos: true },
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
        if (it.sos) {
          return (
            <IonButton
              key="sos"
              type="button"
              className="ni ni-center"
              fill="clear"
              onClick={openPanic}
              aria-label={t("Botón de pánico")}
            >
              <span className="premium-nav-content"><span className="ni-ico">
                <IonIcon icon={medkit} aria-hidden="true" />
              </span>
              <span>SOS</span></span>
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
    </nav>
  );
}

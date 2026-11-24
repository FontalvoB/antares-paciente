import { IonButton, IonIcon } from "@ionic/react";
import {
  barbell,
  barbellOutline,
  nutrition,
  nutritionOutline,
  home,
  homeOutline,
  medkit,
  person,
  personOutline,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import type { TabId } from "../types";

export function BottomNav({ dark = false }: { dark?: boolean }) {
  const { screen, navigate, openPanic } = useApp();
  const t = useT();

  const items: {
    id: TabId;
    label: string;
    icon: string;
    iconOn: string;
  }[] = [
    { id: "home", label: t("Inicio"), icon: homeOutline, iconOn: home },
    { id: "wellness-diet", label: t("Nutrición"), icon: nutritionOutline, iconOn: nutrition },
    { id: "sos", label: t("SOS"), icon: medkit, iconOn: medkit },
    { id: "wellness-exercise", label: t("Ejercicio"), icon: barbellOutline, iconOn: barbell },
    { id: "prof", label: t("Perfil"), icon: personOutline, iconOn: person },
  ];

  return (
    <nav className={`bnav premium-nav ${dark ? "bnav-dark" : ""}`} aria-label={t('Navegación principal')}>
      {items.map((it) => {
        if (it.id === "sos") {
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
              <span>{it.label}</span></span>
            </IonButton>
          );
        }
        const target = it.id;
        const on = screen === target;
        return (
          <IonButton
            key={it.id}
            type="button"
            fill="clear"
            className={`ni ${on ? "on" : ""}`}
            onClick={() => navigate(target)}
            aria-current={on ? "page" : undefined}
          >
            <span className="premium-nav-content"><span className="ni-ico">
              <IonIcon icon={on ? it.iconOn : it.icon} aria-hidden="true" />
            </span>
            <span>{it.label}</span></span>
          </IonButton>
        );
      })}
    </nav>
  );
}

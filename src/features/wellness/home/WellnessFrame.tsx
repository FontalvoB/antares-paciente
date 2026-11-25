import { useState, type ReactNode } from "react";
import { IonButton, IonIcon, IonModal, IonPopover, IonList, IonItem } from "@ionic/react";
import { addOutline, arrowBackOutline, closeOutline, ellipsisHorizontal, notifications, sparklesOutline } from "ionicons/icons";
import { Screen, Scroll } from "../../../components/Screen";
import { LanguageToggle } from "../../../components/LanguageToggle";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import "./wellness-home.css";

/** Layout compartido de las dos referencias. El orbe y la órbita son decorativos. */
export function WellnessFrame({ children, inbox, back = false }: { children: ReactNode; inbox?: ReactNode; back?: boolean }) {
  const { user, navigate, openVoice, openTests, openPanic } = useApp();
  const { t } = useI18n();
  const [menuEvent, setMenuEvent] = useState<Event>();
  const [inboxOpen, setInboxOpen] = useState(false);
  const name = user.nombre?.trim().split(/\s+/)[0];
  return <Screen hideNav className="wh-screen">
    <Scroll noNav className="wh-scroll">
      <div className="wh-content">
        <header className="wh-header">
          <div className="wh-toolbar">
            {back && <IonButton fill="clear" className="wh-icon-button wh-back" onClick={() => navigate("home")} aria-label={t("Volver a Inicio")}><IonIcon icon={arrowBackOutline} /></IonButton>}
            <IonButton fill="clear" className="wh-header-sos" data-sos-access onClick={openPanic} aria-label={t("Abrir SOS de emergencia")}>SOS</IonButton>
            <IonButton fill="clear" className="wh-icon-button" aria-label={t(inbox ? "Bandeja" : "Notificaciones")} onClick={() => inbox ? setInboxOpen(true) : navigate("wellness-notifications")}><IonIcon icon={notifications} /></IonButton>
            <IonButton fill="clear" className="wh-icon-button" aria-label={t("Más opciones")} onClick={e => setMenuEvent(e.nativeEvent)}><IonIcon icon={ellipsisHorizontal} /></IonButton>
          </div>
          <div className="wh-welcome">
            <IonButton fill="clear" className="wh-orb-button" onClick={openVoice} aria-label={t("Hablar con Vita")}><span className="wh-orb" /></IonButton>
            <div className="wh-bubble"><p>{t("Tu Agente de Bienestar IA")}</p><h1>{name ? t("¡Hola, {name}!", { name }) : t("¡Hola!")}</h1><span className="wh-orbit" aria-hidden="true" /></div>
          </div>
        </header>
        {children}
      </div>
    </Scroll>
    <div className="wh-composer">
      <IonButton fill="clear" className="wh-add" aria-label={t("Accesos rápidos")} onClick={e => setMenuEvent(e.nativeEvent)}><IonIcon icon={addOutline} /></IonButton>
      <IonButton fill="clear" className="wh-ask" onClick={openVoice}>{t("Pregúntame o cuéntame cómo te sientes...")}</IonButton>
    </div>
    <IonPopover isOpen={!!menuEvent} event={menuEvent} onDidDismiss={() => setMenuEvent(undefined)} dismissOnSelect>
      <IonList lines="none">
        <IonItem button onClick={() => navigate("home")}>{t("Inicio")}</IonItem>
        <IonItem button onClick={() => navigate("wellness-plan")}>{t("Tu Plan de Bienestar")}</IonItem>
        <IonItem button onClick={() => navigate("protocol")}>{t("Protocolo de hoy")}</IonItem>
        <IonItem button onClick={() => navigate("wellness-checkin")}>{t("Cerrar el día")}</IonItem>
        <IonItem button onClick={openTests}>{t("Continuar cuestionarios")}</IonItem>
        <IonItem button onClick={() => navigate("prof")}>{t("Perfil")}</IonItem>
        <IonItem button onClick={() => navigate("wellness-notifications")}>{t("Notificaciones")}</IonItem>
        <IonItem button onClick={openPanic}>{t("SOS")}</IonItem>
        <IonItem><LanguageToggle /></IonItem>
      </IonList>
    </IonPopover>
    <IonModal isOpen={inboxOpen} onDidDismiss={() => setInboxOpen(false)} className="wh-detail-modal">
      <div className="wh-modal-content"><IonButton fill="clear" className="wh-modal-close" onClick={() => setInboxOpen(false)} aria-label={t("Cerrar")}><IonIcon icon={closeOutline} /></IonButton>{inbox}</div>
    </IonModal>
  </Screen>;
}

export function WellnessPreview({ title, open, onClose, icon = sparklesOutline }: { title: string; open: boolean; onClose: () => void; icon?: string }) {
  const { t } = useI18n();
  return <IonModal isOpen={open} onDidDismiss={onClose} className="wh-detail-modal">
    <div className="wh-preview wh-modal-content"><IonButton fill="clear" className="wh-modal-close" onClick={onClose} aria-label={t("Cerrar")}><IonIcon icon={closeOutline} /></IonButton>
      <IonIcon className="wh-preview-icon" icon={icon} /><h2>{t(title)}</h2><p>{t("Próximamente")}</p><p>{t("Estamos preparando este espacio para ti. Por ahora, puedes continuar con las actividades de tu plan.")}</p><IonButton onClick={onClose}>{t("Volver")}</IonButton>
    </div>
  </IonModal>;
}

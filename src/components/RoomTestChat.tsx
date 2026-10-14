import { IonButton, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar, IonButtons } from "@ionic/react";
import { chatbubblesOutline, closeOutline, lockClosedOutline, arrowBackOutline } from "ionicons/icons";
import { useT } from "../i18n/I18nContext";

export function RoomTestChat({ onClose }: { onClose: () => void }) {
  const t = useT();
  return <IonModal isOpen onDidDismiss={onClose} className="room-test-chat" initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
    <IonHeader className="ion-no-border"><IonToolbar>
      <IonTitle>{t("Chat de prueba")}</IonTitle>
      <IonButtons slot="end"><IonButton aria-label={t("Cerrar")} onClick={onClose}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton></IonButtons>
    </IonToolbar></IonHeader>
    <IonContent>
      <div className="room-test-chat-body">
        <div className="room-test-chat-illustration" aria-hidden="true"><IonIcon icon={chatbubblesOutline} /><span>···</span></div>
        <span className="room-test-chat-badge">{t("En preparación")}</span>
        <h2>{t("Un espacio para conversar")}</h2>
        <p>{t("Estamos preparando el chat de la consulta. Todavía no puedes enviar ni recibir mensajes aquí.")}</p>
        <div className="room-test-chat-note"><IonIcon icon={lockClosedOutline} /><span>{t("Esta vista es de prueba. No se envían mensajes al profesional.")}</span></div>
        <IonButton expand="block" className="bt bt-teal" onClick={onClose}><IonIcon slot="start" icon={arrowBackOutline} />{t("Volver a la consulta")}</IonButton>
      </div>
    </IonContent>
  </IonModal>;
}

import { IonIcon } from "@ionic/react";
import { chatbubbleEllipses } from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";

/**
 * Botón flotante de acceso rápido al chat (FAB).
 * Aparece en la esquina inferior derecha de las pantallas de la app
 * (no en login/onboarding/tests) y abre la vista de chat.
 */
export function ChatFab() {
  const { flow, screen, navigate } = useApp();
  const t = useT();

  // Solo en la app y cuando no estás ya en el chat.
  if (flow !== "app" || screen === "chat" || screen === "com") return null;

  return (
    <button
      type="button"
      className="chat-fab"
      onClick={() => navigate("chat")}
      aria-label={t("Abrir chat")}
    >
      <IonIcon icon={chatbubbleEllipses} style={{ fontSize: 26 }} />
    </button>
  );
}

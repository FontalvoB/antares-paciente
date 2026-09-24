/**
 * Acción de feedback clínico al pie de las respuestas del bot (Fase 9).
 *
 * Componente de dominio: compone `IonButton` + `IonIcon` (Ionic-first, sin
 * HTML custom para botones) y delega el envío a `sendChatFeedback` enlazado
 * al `executionId` de la respuesta. Sin `executionId` no se renderiza nada.
 *
 * - Pulgar arriba = rating 5, pulgar abajo = rating 1.
 * - Micro-feedback visual: spinner al enviar, check + agradecimiento sutil al
 *   confirmar, sin recargar ni navegar.
 * - Accesibilidad: aria-label descriptivo y touch targets ≥44px.
 * - Textos visibles vía `t()` + `es.json`/`en.json` (skill `i18n-translations`).
 */

import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { checkmarkCircle, thumbsDown, thumbsUp } from "ionicons/icons";
import { useState, type CSSProperties } from "react";
import { useT } from "../../i18n/I18nContext";
import { sendChatFeedback } from "../../services/chat/chat-service";

interface ChatFeedbackActionProps {
  /** Id de ejecución de la respuesta del bot. Sin él no se renderiza. */
  executionId?: string | null;
  /** Callback opcional tras registrar el feedback (rating enviado). */
  onSent?: (rating: number) => void;
}

type Status = "idle" | "sending" | "sent";

const RATING_UP = 5;
const RATING_DOWN = 1;

/** Botón táctil mínimo 44px (WCAG 2.5.8 / Ionic-first). */
const touchStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  margin: 0,
  "--padding-start": "10px",
  "--padding-end": "10px",
} as CSSProperties;

export function ChatFeedbackAction({
  executionId,
  onSent,
}: ChatFeedbackActionProps) {
  const t = useT();
  const [status, setStatus] = useState<Status>("idle");
  const [sentRating, setSentRating] = useState<number | null>(null);

  const sending = status === "sending";

  const rate = async (rating: number) => {
    if (!executionId || sending) return;
    setStatus("sending");
    try {
      await sendChatFeedback({ executionId, rating });
      setSentRating(rating);
      setStatus("sent");
      onSent?.(rating);
    } catch {
      // Fallo de red/backend: se vuelve a idle para permitir reintento
      // sin romper la conversación.
      setStatus("idle");
    }
  };

  if (!executionId) return null;

  if (status === "sent") {
    return (
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 6,
          fontSize: 12,
          color: "var(--mu)",
        }}
      >
        <IonIcon
          icon={checkmarkCircle}
          aria-hidden="true"
          style={{ fontSize: 16, color: "var(--teal, #0e9f6e)" }}
        />
        <span>{t("¡Gracias por tu calificación!")}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginTop: 6,
        opacity: sending ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--mu)" }}>
        {t("¿Te resultó útil esta respuesta?")}
      </span>
      {sending && sentRating == null ? (
        <IonSpinner
          name="crescent"
          aria-label={t("Enviando calificación")}
          style={{ width: 16, height: 16 }}
        />
      ) : null}
      <IonButton
        fill="clear"
        size="small"
        style={touchStyle}
        aria-label={t("Calificar respuesta como útil")}
        disabled={sending}
        onClick={() => void rate(RATING_UP)}
      >
        <IonIcon icon={thumbsUp} style={{ fontSize: 18 }} />
      </IonButton>
      <IonButton
        fill="clear"
        size="small"
        style={touchStyle}
        aria-label={t("Calificar respuesta como no útil")}
        disabled={sending}
        onClick={() => void rate(RATING_DOWN)}
      >
        <IonIcon icon={thumbsDown} style={{ fontSize: 18 }} />
      </IonButton>
    </div>
  );
}

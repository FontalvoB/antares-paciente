import { type CSSProperties, useEffect, useRef, useState } from "react";
import { IonButton, IonIcon, IonModal } from "@ionic/react";
import { call, mic, micOff } from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import { useSpeechAssistant } from "../hooks/useSpeechAssistant";

/**
 * Agente de voz real — Fase 1 MVP (change agente-asistente-citas, D4):
 * Web Speech API en el WebView. Escucha en español con transcripción en
 * vivo, envía el turno al asistente clínico al detectar la pausa y
 * vocaliza la respuesta con speechSynthesis. Silenciar/colgar detienen
 * micrófono y audio al instante. Sin soporte → aviso y chat de texto.
 */
export function VoiceOverlay() {
  const { voiceOpen, closeVoice, showToast, sendVoiceMessage } = useApp();
  const t = useT();
  const [botLine, setBotLine] = useState("");
  // Turno en vuelo: evita doble envío mientras el bot procesa/habla.
  const busyRef = useRef(false);

  const assistant = useSpeechAssistant({
    onFinalTranscript: (text) => {
      if (busyRef.current) return;
      busyRef.current = true;
      assistant.setProcessing();
      void (async () => {
        try {
          const botMessage = await sendVoiceMessage(text);
          if (botMessage) {
            setBotLine(botMessage.text);
            await assistant.speak(botMessage.text);
          } else {
            setBotLine(t("No pude escuchar bien. Inténtalo de nuevo."));
            await assistant.speak(
              t("No pude escuchar bien. Inténtalo de nuevo."),
            );
          }
        } catch {
          setBotLine(
            t("Hubo un problema con el asistente. Inténtalo de nuevo."),
          );
          await assistant.speak(
            t("Hubo un problema con el asistente. Inténtalo de nuevo."),
          );
        } finally {
          busyRef.current = false;
          // Fin del turno: vuelve a escuchar (modo voz conversacional).
          assistant.startListening();
        }
      })();
    },
    onError: () => {
      showToast(t("La voz no está disponible en este momento."), "err");
    },
  });

  // Al abrir el overlay arranca la escucha; al cerrar, la limpieza total
  // del hook (micrófono + speechSynthesis) corre por el desmontaje.
  useEffect(() => {
    if (voiceOpen && assistant.supported) {
      assistant.startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen, assistant.supported]);

  const hangUp = () => {
    assistant.cancelSpeech();
    assistant.teardown();
    closeVoice();
    showToast(t("Llamada de voz finalizada"), "ok");
  };

  const muted = assistant.muted;
  const showTranscript =
    assistant.state === "listening" || assistant.state === "processing";
  const speaking = assistant.state === "speaking";

  if (assistant.supported === false) {
    // Fallback D4: WebView sin Web Speech API → aviso no bloqueante.
    return (
      <IonModal
        isOpen={voiceOpen}
        onDidDismiss={closeVoice}
        className="voice-modal"
      >
        <div className="overlay overlay-voice">
          <div className="voice-orb">
            <IonIcon
              icon={micOff}
              style={{ fontSize: 56, color: "var(--ice)" }}
            />
          </div>
          <div
            className="display"
            style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}
          >
            {t("Voz no disponible en este dispositivo")}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,.6)",
              textAlign: "center",
              maxWidth: 300,
              lineHeight: 1.6,
            }}
          >
            {t(
              "Tu navegador o WebView no soporta reconocimiento de voz. Usa el chat de texto: el asistente responde igual.",
            )}
          </div>
          <IonButton
            expand="block"
            className="bt"
            style={
              {
                "--background": "rgba(255,255,255,.12)",
                "--color": "#fff",
              } as CSSProperties
            }
            onClick={closeVoice}
          >
            {t("Usar chat de texto")}
          </IonButton>
        </div>
      </IonModal>
    );
  }

  return (
    <IonModal
      isOpen={voiceOpen}
      onDidDismiss={closeVoice}
      className="voice-modal"
    >
      <div className="overlay overlay-voice">
        <div className="voice-orb">
          <IonIcon
            icon={muted ? micOff : mic}
            style={{ fontSize: 56, color: "var(--ice)" }}
          />
        </div>
        <div
          className="display"
          style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}
        >
          {t("Agente de voz Copp Adresd")}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,.6)",
            textAlign: "center",
            maxWidth: 280,
            lineHeight: 1.6,
          }}
        >
          {t(
            "Habla con naturalidad sobre síntomas, citas, medicamentos o tu plan nutricional.",
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--ice)",
            fontSize: 13,
          }}
        >
          <div className={`waves${speaking ? " live" : ""}`}>
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
          </div>
          {assistant.state === "processing"
            ? t("Procesando…")
            : assistant.state === "speaking"
              ? t("Respondiendo…")
              : muted
                ? t("Micrófono silenciado")
                : t("Escuchando…")}
        </div>
        <div
          style={{
            background: "rgba(255,255,255,.07)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 14,
            padding: 14,
            width: "100%",
            fontSize: 13,
            color: "rgba(255,255,255,.78)",
            lineHeight: 1.65,
            minHeight: 84,
          }}
          aria-live="polite"
        >
          {showTranscript && assistant.transcript
            ? assistant.transcript
            : botLine ||
              t("Presiona el micrófono y háblame: te escucho en tiempo real.")}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <IonButton
            className="bt bt-round-lg"
            style={
              {
                "--background": "rgba(255,255,255,.12)",
                "--color": "#fff",
                "--border-color": "rgba(255,255,255,.2)",
                "--border-width": "1px",
                "--border-style": "solid",
              } as CSSProperties
            }
            aria-label={
              muted ? t("Activar micrófono") : t("Silenciar micrófono")
            }
            onClick={assistant.toggleMute}
          >
            <IonIcon icon={muted ? micOff : mic} style={{ fontSize: 24 }} />
          </IonButton>
          <IonButton
            className="bt bt-round-lg"
            style={
              {
                "--background": "var(--panic)",
                "--color": "#fff",
              } as CSSProperties
            }
            aria-label={t("Colgar")}
            onClick={hangUp}
          >
            <IonIcon icon={call} style={{ fontSize: 24 }} />
          </IonButton>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,.4)",
            textAlign: "center",
          }}
        >
          {t("Cuando cuelgas, la conversación queda en tu chat.")}
        </div>
      </div>
    </IonModal>
  );
}

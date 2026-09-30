import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonIcon, IonModal, IonSpinner } from "@ionic/react";
import { call, mic, micOff } from "ionicons/icons";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import { useSpeechAssistant } from "../hooks/useSpeechAssistant";
import {
  requestVoiceSession,
  toolCancelAppointment,
  toolGetAvailabilitySlots,
  toolGetMyRequests,
  toolGetUpcomingAppointments,
  toolListProfessionals,
  toolListSpecialties,
  toolRequestAppointment,
  toolRescheduleAppointment,
} from "../utils/voiceApi";

/**
 * Agente de voz — integración ElevenLabs (change integración-elevenlabs).
 *
 * Dos motores, una misma cápsula visual:
 *  1. `eleven` — sesión del SDK oficial (`@elevenlabs/react`) con signed URL
 *     emitido por el backend (la API key jamás llega al cliente). Las client
 *     tools de negocio las ejecuta el dispositivo con el JWT del paciente
 *     contra endpoints reales (`utils/voiceApi.ts`); identidad a prueba de
 *     suplantación (ElevenLabs nunca define quién es el paciente).
 *  2. `webspeech` — fallback MVP (change agente-asistente-citas D4): Web
 *     Speech API del WebView + chat IA. Se activa si el backend no tiene voz
 *     configurada o ElevenLabs no arranca; degradación invisible al usuario.
 *
 * Sin mensajes técnicos al paciente: los fallos se traducen a frases
 * amigables y opciones claras (reintentar / chat de texto).
 */

type VoiceMode = "idle" | "eleven" | "webspeech";

/** Fase visual del turno: alimenta el orb, el punto de estado y las ondas. */
type VoicePhase =
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "unavailable";

/** Props de la cápsula visual compartida por ambos motores. */
interface VoiceShellProps {
  phase: VoicePhase;
  statusLabel: string;
  transcriptLine: string;
  muted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
}

/** Cápsula visual única: pantalla de llamada inmersiva (estilo llamada de
 * WhatsApp/ChatGPT). Orb reactivo a la fase, estado con punto pulsante,
 * transcripción en tarjeta glass y controles circulares grandes (mute +
 * colgar) con regreso claro al chat de texto. Solo presentación. */
function VoiceShell({
  phase,
  statusLabel,
  transcriptLine,
  muted,
  onToggleMute,
  onHangUp,
}: VoiceShellProps) {
  const t = useT();
  const orbClass = `voice-orb vc-orb is-${phase}`;
  return (
    <>
      {/* Encabezado de la llamada */}
      <div className="vc-head">
        <div className="vc-head-brand" aria-hidden="true">
          <IonIcon icon={mic} />
        </div>
        <div className="display vc-title">{t("Agente de voz Copp Adresd")}</div>
        <div className="vc-sub">
          {t(
            "Habla con naturalidad sobre síntomas, citas, medicamentos o tu plan nutricional.",
          )}
        </div>
      </div>

      {/* Orb reactivo: escucha (anillo rotatorio), habla (ondas), piensa
          (spinner), conecta (pulso suave) o silenciado (gris). */}
      <div className={orbClass} aria-hidden="true">
        {phase === "connecting" || phase === "thinking" ? (
          <IonSpinner name="crescent" className="vc-orb-spin" />
        ) : (
          <IonIcon icon={muted ? micOff : mic} className="vc-orb-ico" />
        )}
      </div>

      {/* Estado: punto de color + etiqueta existente (t()) + ondas sutiles
          que solo animan al responder. */}
      <div className={`vc-status is-${phase}`}>
        <span className="vc-status-dot" aria-hidden="true" />
        <span
          className={`waves vc-status-waves${phase === "speaking" ? " live" : ""}`}
          aria-hidden="true"
        >
          <span className="wave" />
          <span className="wave" />
          <span className="wave" />
          <span className="wave" />
          <span className="wave" />
        </span>
        {statusLabel}
      </div>

      {/* Transcripción en vivo (tarjeta glass). */}
      <div className="vc-transcript" aria-live="polite">
        {transcriptLine ||
          t("Presiona el micrófono y háblame: te escucho en tiempo real.")}
      </div>

      {/* Controles de llamada: mute + colgar (72px, targets generosos). */}
      <div className="vc-controls">
        <IonButton
          className="bt vc-btn vc-mute"
          aria-pressed={muted}
          aria-label={muted ? t("Activar micrófono") : t("Silenciar micrófono")}
          onClick={onToggleMute}
        >
          <IonIcon icon={muted ? micOff : mic} />
        </IonButton>
        <IonButton
          className="bt vc-btn vc-hang"
          aria-label={t("Colgar")}
          onClick={onHangUp}
        >
          <IonIcon icon={call} />
        </IonButton>
      </div>

      {/* Regreso claro al chat de texto: termina la llamada igual que
          colgar (mismo handler), con affordance textual accesible. */}
      <IonButton fill="clear" className="vc-back" onClick={onHangUp}>
        {t("Volver al chat")}
      </IonButton>
    </>
  );
}

export function VoiceOverlay() {
  const {
    voiceOpen,
    closeVoice,
    showToast,
    sendVoiceMessage,
    appendChatMessages,
  } = useApp();
  const t = useT();
  const [mode, setMode] = useState<VoiceMode>("idle");
  // Estado del turno en curso en modo ElevenLabs.
  const [thinking, setThinking] = useState(false);
  const [userLine, setUserLine] = useState("");
  const [botLine, setBotLine] = useState("");
  const lastUserRef = useRef("");
  const wasConnectedRef = useRef(false);

  // ── Fallback Web Speech (misma lógica del MVP D4) ──────────────────────────
  const assistantBusyRef = useRef(false);
  const assistant = useSpeechAssistant({
    onFinalTranscript: (text) => {
      if (assistantBusyRef.current) return;
      assistantBusyRef.current = true;
      assistant.setProcessing();
      void (async () => {
        try {
          const botMessage = await sendVoiceMessage(text);
          const answer = botMessage?.text ?? "";
          if (answer) {
            setBotLine(answer);
            await assistant.speak(answer);
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
          assistantBusyRef.current = false;
          // Fin del turno: vuelve a escuchar (modo voz conversacional).
          assistant.startListening();
        }
      })();
    },
    onError: () => {
      showToast(t("La voz no está disponible en este momento."), "err");
    },
  });

  // ── Client tools (FASE 7/8): ejecutadas por el dispositivo con el JWT ─────
  const clientTools = useMemo(() => {
    // Marca "pensando" mientras el dispositivo ejecuta la tool real.
    const withThinking =
      (fn: (params: Record<string, unknown>) => Promise<string>) =>
      async (params: Record<string, unknown>) => {
        setThinking(true);
        try {
          return await fn(params);
        } finally {
          setThinking(false);
        }
      };
    return {
      get_my_upcoming_appointments: withThinking(() =>
        toolGetUpcomingAppointments(),
      ),
      get_my_requests: withThinking(() => toolGetMyRequests()),
      list_specialties: withThinking(() => toolListSpecialties()),
      list_professionals: withThinking(() => toolListProfessionals()),
      get_availability_slots: withThinking((params) =>
        toolGetAvailabilitySlots(
          params as {
            date: string;
            specialty_id?: string;
            professional_id?: string;
          },
        ),
      ),
      request_appointment: withThinking((params) =>
        toolRequestAppointment(
          params as {
            specialty_id: string;
            reason: string;
            professional_id?: string;
            preferred_start?: string;
          },
        ),
      ),
      reschedule_appointment: withThinking((params) =>
        toolRescheduleAppointment(
          params as {
            appointment_id: string;
            new_start: string;
            reason?: string;
          },
        ),
      ),
      cancel_appointment: withThinking((params) =>
        toolCancelAppointment(
          params as { appointment_id: string; reason: string },
        ),
      ),
    };
  }, []);

  // Espeja el intercambio de voz al chat del paciente (queda en el hilo).
  const mirrorTurn = useCallback(
    (agentText: string) => {
      const userText = lastUserRef.current.trim();
      if (!userText || !agentText) return;
      appendChatMessages([
        { role: "user", text: userText },
        { role: "bot", text: agentText },
      ]);
      lastUserRef.current = "";
    },
    [appendChatMessages],
  );

  const handleVoiceMessage = useCallback(
    (raw: unknown) => {
      const msg = raw as {
        type?: string;
        user_transcript?: string;
        agent_response?: string;
      };
      if (
        msg?.type === "user_transcript" &&
        typeof msg.user_transcript === "string"
      ) {
        lastUserRef.current = msg.user_transcript;
        setUserLine(msg.user_transcript);
      } else if (
        msg?.type === "agent_response" &&
        typeof msg.agent_response === "string"
      ) {
        setBotLine(msg.agent_response);
        mirrorTurn(msg.agent_response);
      }
    },
    [mirrorTurn],
  );

  const onDisconnect = useCallback(() => {
    if (!wasConnectedRef.current) return;
    wasConnectedRef.current = false;
    // Corte inesperado del agente: cierre amigable (el paciente puede reabrir).
    showToast(t("Se perdió la conexión con el asistente."), "err");
    closeVoice();
  }, [closeVoice, showToast, t]);

  const onError = useCallback(() => {
    showToast(
      t("No pudimos conectar con el asistente. Intenta nuevamente."),
      "err",
    );
  }, [showToast, t]);

  // ── Ciclo de vida del overlay ──────────────────────────────────────────────
  useEffect(() => {
    if (!voiceOpen) {
      wasConnectedRef.current = false;
      setMode("idle");
      setThinking(false);
      setUserLine("");
      setBotLine("");
      return;
    }
    if (mode === "idle") {
      // Intenta ElevenLabs siempre; el body degrada a Web Speech si falla.
      setMode("eleven");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen]);

  // Fallback Web Speech: arranca la escucha al activarse.
  useEffect(() => {
    if (voiceOpen && mode === "webspeech" && assistant.supported) {
      assistant.startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen, mode, assistant.supported]);

  const hangUp = () => {
    if (mode === "webspeech") {
      assistant.cancelSpeech();
      assistant.teardown();
    }
    setMode("idle");
    closeVoice();
    showToast(t("Llamada de voz finalizada"), "ok");
  };

  if (assistant.supported === false && mode === "webspeech") {
    // Fallback D4: WebView sin Web Speech API y ElevenLabs no disponible.
    return (
      <IonModal
        isOpen={voiceOpen}
        onDidDismiss={closeVoice}
        className="voice-modal"
      >
        <div className="overlay overlay-voice">
          <div className="voice-orb vc-orb is-unavailable">
            <IonIcon icon={micOff} className="vc-orb-ico" />
          </div>
          <div className="display vc-title">
            {t("Voz no disponible en este dispositivo")}
          </div>
          <div className="vc-sub vc-sub-wide">
            {t(
              "Tu navegador o WebView no soporta reconocimiento de voz. Usa el chat de texto: el asistente responde igual.",
            )}
          </div>
          <IonButton
            expand="block"
            className="bt vc-use-chat"
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
        {mode === "eleven" ? (
          <ConversationProvider
            clientTools={clientTools}
            onMessage={handleVoiceMessage}
            onDisconnect={onDisconnect}
            onError={onError}
          >
            <ElevenVoiceBody
              onHangUp={hangUp}
              thinking={thinking}
              userLine={userLine}
              botLine={botLine}
              onFallback={() => {
                // Degradación profesional: Web Speech si el WebView la soporta.
                wasConnectedRef.current = false;
                setMode(assistant.supported ? "webspeech" : "eleven");
                if (!assistant.supported) {
                  showToast(
                    t(
                      "No pudimos conectar con el asistente. Intenta nuevamente.",
                    ),
                    "err",
                  );
                }
              }}
            />
          </ConversationProvider>
        ) : (
          <VoiceShell
            phase={
              assistant.state === "processing"
                ? "thinking"
                : assistant.state === "speaking"
                  ? "speaking"
                  : assistant.muted
                    ? "muted"
                    : "listening"
            }
            statusLabel={
              assistant.state === "processing"
                ? t("Procesando…")
                : assistant.state === "speaking"
                  ? t("Respondiendo…")
                  : assistant.muted
                    ? t("Micrófono silenciado")
                    : t("Escuchando…")
            }
            transcriptLine={
              (assistant.state === "listening" ||
                assistant.state === "processing") &&
              assistant.transcript
                ? assistant.transcript
                : botLine
            }
            muted={assistant.muted}
            onToggleMute={assistant.toggleMute}
            onHangUp={hangUp}
          />
        )}
        <div className="vc-foot">{t("La conversación queda en tu chat.")}</div>
      </div>
    </IonModal>
  );
}

// ── Cuerpo de la sesión ElevenLabs (consume useConversation del provider) ──

interface ElevenVoiceBodyProps {
  thinking: boolean;
  onHangUp: () => void;
  userLine: string;
  botLine: string;
  onFallback: () => void;
}

function ElevenVoiceBody({
  thinking,
  onHangUp,
  userLine,
  botLine,
  onFallback,
}: ElevenVoiceBodyProps) {
  const eleven = useConversation();
  const t = useT();

  const start = useCallback(async () => {
    try {
      // Permiso de micrófono primero (falla temprano con degradación clara).
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const session = await requestVoiceSession();
      if (!session) {
        onFallback();
        return;
      }
      eleven.startSession({ signedUrl: session.signedUrl });
    } catch {
      onFallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  const phase: VoicePhase =
    eleven.status === "connecting"
      ? "connecting"
      : thinking
        ? "thinking"
        : eleven.isSpeaking
          ? "speaking"
          : eleven.isMuted
            ? "muted"
            : "listening";

  const label =
    eleven.status === "connecting"
      ? t("Conectando…")
      : thinking
        ? t("Pensando…")
        : eleven.isSpeaking
          ? t("Respondiendo…")
          : eleven.isMuted
            ? t("Micrófono silenciado")
            : t("Escuchando…");

  return (
    <VoiceShell
      phase={phase}
      statusLabel={label}
      transcriptLine={eleven.isSpeaking ? botLine : userLine}
      muted={eleven.isMuted}
      onToggleMute={() => eleven.setMuted(!eleven.isMuted)}
      onHangUp={onHangUp}
    />
  );
}

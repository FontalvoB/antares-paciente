import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { IonButton, IonIcon, IonModal } from "@ionic/react";
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

/** Props de la cápsula visual compartida por ambos motores. */
interface VoiceShellProps {
  statusLabel: string;
  transcriptLine: string;
  live: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
}

/** Cápsula visual única (misma estética del MVP D4, sin duplicar markup). */
function VoiceShell({
  statusLabel,
  transcriptLine,
  live,
  muted,
  onToggleMute,
  onHangUp,
}: VoiceShellProps) {
  const t = useT();
  return (
    <>
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
        <div className={`waves${live ? " live" : ""}`}>
          <span className="wave" />
          <span className="wave" />
          <span className="wave" />
          <span className="wave" />
          <span className="wave" />
        </div>
        {statusLabel}
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
        {transcriptLine ||
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
          aria-label={muted ? t("Activar micrófono") : t("Silenciar micrófono")}
          onClick={onToggleMute}
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
          onClick={onHangUp}
        >
          <IonIcon icon={call} style={{ fontSize: 24 }} />
        </IonButton>
      </div>
    </>
  );
}

interface VoiceShellProps {
  statusLabel: string;
  transcriptLine: string;
  live: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
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
            live={assistant.state === "speaking"}
            muted={assistant.muted}
            onToggleMute={assistant.toggleMute}
            onHangUp={hangUp}
          />
        )}
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,.4)",
            textAlign: "center",
          }}
        >
          {t("La conversación queda en tu chat.")}
        </div>
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
      statusLabel={label}
      transcriptLine={eleven.isSpeaking ? botLine : userLine}
      live={eleven.isSpeaking}
      muted={eleven.isMuted}
      onToggleMute={() => eleven.setMuted(!eleven.isMuted)}
      onHangUp={onHangUp}
    />
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonIcon, IonInput, IonModal, IonSpinner } from "@ionic/react";
import { call, chevronBack, mic, micOff } from "ionicons/icons";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { createVoiceMicLevel } from "../utils/voiceMicLevel";
import { readAgentOutputLevel } from "../utils/agentLevel";
import { VoiceOrb } from "./VoiceOrb";
import type { VoicePhase } from "./VoiceOrb";
import { useApp } from "../context/AppContext";
import { useI18n, useT } from "../i18n/I18nContext";
import { useSpeechAssistant } from "../hooks/useSpeechAssistant";
import { consentFailure, isLegalConsentError, legalConsentMessage, onLegalConsentChange, requireLegalConsent, verifyLegalConsent } from "../utils/legalConsents";
import { getAccessToken } from "../utils/authApi";
import { sessionUserId } from "../utils/sessionIdentity";
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
 *     configurada o ElevenLabs no arranca; requiere una elección explícita
 *     y autorizaciones vigentes de voz y chat antes de arrancar.
 *
 * Sin mensajes técnicos al paciente: los fallos se traducen a frases
 * amigables y opciones claras (reintentar / chat de texto).
 */

type VoiceMode = "idle" | "eleven" | "fallback-choice" | "webspeech";
interface ActiveVoiceSession { generation: number; owner: string | null; controller: AbortController }

/** Props de la cápsula visual compartida por ambos motores. */
interface VoiceShellProps {
  active: boolean;
  micLevel: ReturnType<typeof createVoiceMicLevel>;
  getOutputVolume?: () => number;
  phase: VoicePhase;
  statusLabel: string;
  transcriptLine: string;
  muted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
  onSendText?: (text: string) => void;
}

/** Cápsula visual única: pantalla de llamada inmersiva (estilo llamada de
 * WhatsApp/ChatGPT). Orb reactivo a la fase, estado con punto pulsante,
 * transcripción en tarjeta glass y controles circulares grandes (mute +
 * colgar) con regreso claro al chat de texto. Solo presentación. */
function VoiceShell({
  active,
  micLevel,
  getOutputVolume,
  phase,
  statusLabel,
  transcriptLine,
  muted,
  onToggleMute,
  onHangUp,
  onSendText,
}: VoiceShellProps) {
  const t = useT();
  const [text, setText] = useState("");
  useEffect(() => {
    micLevel.setMuted(muted);
  }, [micLevel, muted]);
  const orbClass = `voice-orb vc-orb is-${phase}`;
  const submitText = (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || !onSendText) return;
    onSendText(message);
    setText("");
  };
  return (
    <div className="vc-shell">
      <div className="vc-header">
        <IonButton
          fill="clear"
          className="vc-back"
          aria-label={t("Volver al chat")}
          onClick={onHangUp}
        >
          <IonIcon icon={chevronBack} />
        </IonButton>
        <span className="vc-brand">
          COPP-ADRESD<span>{t("Asistente de voz")}</span>
        </span>
      </div>
      <div className="vc-center">
        <div className={orbClass} aria-hidden="true">
          <VoiceOrb
            phase={phase}
            active={active}
            getInputVolume={micLevel.getVolume}
            getOutputVolume={getOutputVolume}
          />
        </div>
        <div className={`vc-status is-${phase}`} aria-live="polite">
          {statusLabel}
        </div>
        <div className="vc-transcript" aria-live="polite">
          {transcriptLine || t("Estoy aquí para acompañarte.")}
        </div>
      </div>
      <form className="vc-controls" onSubmit={submitText}>
        <IonInput
          className="vc-input"
          value={text}
          disabled={!onSendText}
          onIonInput={(event) => setText(event.detail.value ?? "")}
          placeholder={t("Escribe un mensaje…")}
          aria-label={t("Escribe un mensaje…")}
          enterkeyhint="send"
        />
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
      </form>
    </div>
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
  const { t, lang } = useI18n();
  const micLevel = useMemo(() => createVoiceMicLevel(), []);
  useEffect(() => {
    if (!voiceOpen) return;
    return () => micLevel.release();
  }, [voiceOpen, micLevel]);
  const [mode, setMode] = useState<VoiceMode>("idle");
  const modeRef = useRef(mode); modeRef.current = mode;
  const openRef = useRef(voiceOpen); openRef.current = voiceOpen;
  const voiceGeneration = useRef(0);
  const activeSession = useRef<ActiveVoiceSession | null>(null);
  const consentRequest = useRef<AbortController | null>(null);
  const invalidateSession = useCallback(() => {
    voiceGeneration.current += 1;
    activeSession.current = null;
    consentRequest.current?.abort();
  }, []);
  const assertSession = useCallback((session: ActiveVoiceSession | null, requireSdk = false) => {
    if (!session || !openRef.current || activeSession.current !== session
      || voiceGeneration.current !== session.generation || session.controller.signal.aborted
      || session.owner !== sessionUserId(getAccessToken()) || (requireSdk && modeRef.current !== "eleven")) {
      throw consentFailure("CONSENT_CANCELLED");
    }
  }, []);
  const speechActive = useRef(false);
  speechActive.current = voiceOpen && mode === "webspeech";
  // Estado del turno en curso en modo ElevenLabs.
  const [thinking, setThinking] = useState(false);
  const [userLine, setUserLine] = useState("");
  const [botLine, setBotLine] = useState("");
  const lastUserRef = useRef("");
  const wasConnectedRef = useRef(false);

  // ── Fallback Web Speech (misma lógica del MVP D4) ──────────────────────────
  const assistantBusyRef = useRef(false);
  const assistant = useSpeechAssistant({
    // STT/TTS siguen al selector de idioma de la app (cambio en caliente
    // soportado: el recognizer se relanza con el locale nuevo).
    lang,
    onFinalTranscript: (text) => {
      if (assistantBusyRef.current || !speechActive.current) return;
      assistantBusyRef.current = true;
      assistant.setProcessing();
      void (async () => {
        try {
          const botMessage = await sendVoiceMessage(text);
          if (!speechActive.current) return;
          if (!botMessage) {
            speechActive.current = false;
            assistant.teardown(); micLevel.release(); closeVoice();
            return;
          }
          await verifyLegalConsent("voice", lang);
          if (!speechActive.current) return;
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
        } catch (error) {
          speechActive.current = false;
          assistant.teardown(); micLevel.release(); closeVoice();
          showToast(t(isLegalConsentError(error) ? legalConsentMessage(error) : "Hubo un problema con el asistente. Inténtalo de nuevo."), "err");
        } finally {
          assistantBusyRef.current = false;
          // Fin del turno: vuelve a escuchar (modo voz conversacional).
          if (speechActive.current) assistant.startListening();
        }
      })();
    },
    onError: () => {
      showToast(t("La voz no está disponible en este momento."), "err");
    },
  });

  // ── Client tools (FASE 7/8): ejecutadas por el dispositivo con el JWT ─────
  const clientTools = useMemo(() => {
    const session = mode === "eleven" ? activeSession.current : null;
    // Marca "pensando" mientras el dispositivo ejecuta la tool real.
    const withThinking =
      (fn: (params: Record<string, unknown>, assertActive: () => void) => Promise<string>) =>
      async (params: Record<string, unknown>) => {
        const assertActive = () => assertSession(session, true);
        assertActive();
        setThinking(true);
        try {
          assertActive();
          await verifyLegalConsent("voice", lang, session!.controller.signal);
          assertActive();
          const result = await fn(params, assertActive);
          assertActive();
          await verifyLegalConsent("voice", lang, session!.controller.signal);
          assertActive();
          return result;
        } catch (error) {
          if (isLegalConsentError(error) && activeSession.current === session) {
            invalidateSession(); micLevel.release(); closeVoice();
          }
          throw error;
        } finally {
          if (activeSession.current === session) setThinking(false);
        }
      };
    return {
      get_my_upcoming_appointments: withThinking(() =>
        toolGetUpcomingAppointments(),
      ),
      get_my_requests: withThinking(() => toolGetMyRequests()),
      list_specialties: withThinking(() => toolListSpecialties()),
      list_professionals: withThinking(() => toolListProfessionals()),
      get_availability_slots: withThinking((params, assertActive) =>
        toolGetAvailabilitySlots(
          params as {
            date: string;
            specialty_id?: string;
            professional_id?: string;
          }, assertActive,
        ),
      ),
      request_appointment: withThinking((params, assertActive) =>
        toolRequestAppointment(
          params as {
            specialty_id: string;
            reason: string;
            professional_id?: string;
            preferred_start?: string;
          }, assertActive,
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
  }, [lang, mode, micLevel, closeVoice, assertSession, invalidateSession]);

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
      invalidateSession();
      assistant.cancelSpeech(); assistant.teardown();
      wasConnectedRef.current = false;
      setMode("idle");
      setThinking(false);
      setUserLine("");
      setBotLine("");
      return;
    }
    if (mode === "idle") {
      let cancelled = false;
      const controller = new AbortController();
      consentRequest.current = controller;
      const session = { generation: ++voiceGeneration.current, owner: sessionUserId(getAccessToken()), controller };
      activeSession.current = session;
      void requireLegalConsent("voice", lang, controller.signal).then(() => {
        if (!cancelled) { assertSession(session); setMode("eleven"); }
      }).catch(error => {
        if (!cancelled) { showToast(t(legalConsentMessage(error)), "warn"); closeVoice(); }
      });
      return () => {
        cancelled = true;
        if (activeSession.current === session) invalidateSession();
        controller.abort();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen]);

  useEffect(() => {
    if (!voiceOpen) return;
    const stop = () => {
      invalidateSession();
      speechActive.current = false;
      assistant.cancelSpeech(); assistant.teardown(); micLevel.release();
      setMode("idle"); closeVoice();
    };
    const unsubscribe = onLegalConsentChange(scope => {
      if (scope === null || scope === "voice" || scope === "chat") stop();
    });
    const check = () => {
      if (mode !== "eleven" && mode !== "webspeech") return;
      void Promise.all([verifyLegalConsent("voice", lang), ...(mode === "webspeech" ? [verifyLegalConsent("chat", lang)] : [])])
        .catch(() => { stop(); showToast(t("La autorización cambió o no pudo comprobarse. La sesión de voz se cerró."), "warn"); });
    };
    const timer = window.setInterval(check, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { unsubscribe(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
    // La sesión se cierra al retirar una autorización, incluso desde otra entrada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen, mode, lang]);

  // Fallback Web Speech: arranca la escucha al activarse.
  useEffect(() => {
    if (voiceOpen && mode === "webspeech" && assistant.supported) {
      assistant.startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen, mode, assistant.supported]);

  const hangUp = () => {
    invalidateSession();
    speechActive.current = false;
    micLevel.release();
    if (mode === "webspeech") {
      assistant.cancelSpeech();
      assistant.teardown();
    }
    setMode("idle");
    closeVoice();
    showToast(t("Llamada de voz finalizada"), "ok");
  };
  const sdkSession = mode === "eleven" ? activeSession.current : null;

  if (assistant.supported === false && mode === "webspeech") {
    // Fallback D4: WebView sin Web Speech API y ElevenLabs no disponible.
    return (
      <IonModal
        isOpen={voiceOpen}
        onDidDismiss={closeVoice}
        className="voice-modal"
      >
        <div className="overlay overlay-voice">
          <div className="voice-orb vc-orb is-unavailable" aria-hidden="true">
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
        {mode === "idle" ? <div role="status"><IonSpinner name="crescent" />{t("Comprobando autorización…")}</div>
        : mode === "fallback-choice" ? <div>
          <p>{t("La conexión de voz no está disponible. Puedes revisar la autorización para usar voz del dispositivo y chat.")}</p>
          {assistant.supported && <IonButton expand="block" className="bt bt-primary" onClick={() => {
            void (async () => {
              const signal = consentRequest.current?.signal;
              try {
                await requireLegalConsent("voice", lang, signal);
                await requireLegalConsent("chat", lang, signal);
                if (signal?.aborted) return;
                setMode("webspeech");
              } catch (error) { if (!signal?.aborted) { showToast(t(legalConsentMessage(error)), "warn"); hangUp(); } }
            })();
          }}>{t("Revisar y usar voz del dispositivo")}</IonButton>}
          <IonButton expand="block" className="bt bt-ghost" onClick={hangUp}>{t("Usar chat de texto")}</IonButton>
        </div> : mode === "eleven" ? (
          <ConversationProvider
            clientTools={clientTools}
            onMessage={handleVoiceMessage}
            onDisconnect={onDisconnect}
            onError={onError}
          >
            <ElevenVoiceBody
              micLevel={micLevel}
              active={voiceOpen}
              onHangUp={hangUp}
              thinking={thinking}
              userLine={userLine}
              botLine={botLine}
              assertActive={() => assertSession(sdkSession, true)}
              onFallback={() => {
                wasConnectedRef.current = false;
                micLevel.release();
                setMode("fallback-choice");
              }}
              onConsentBlocked={error => {
                if (activeSession.current !== sdkSession) return;
                showToast(t(legalConsentMessage(error)), "warn"); hangUp();
              }}
            />
          </ConversationProvider>
        ) : (
          <VoiceShell
            micLevel={micLevel}
            active={voiceOpen}
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
  micLevel: ReturnType<typeof createVoiceMicLevel>;
  active: boolean;
  thinking: boolean;
  onHangUp: () => void;
  userLine: string;
  botLine: string;
  onFallback: () => void;
  onConsentBlocked: (error: unknown) => void;
  assertActive: () => void;
}

function ElevenVoiceBody({
  micLevel,
  active,
  thinking,
  onHangUp,
  userLine,
  botLine,
  onFallback,
  onConsentBlocked,
  assertActive,
}: ElevenVoiceBodyProps) {
  const eleven = useConversation();
  const { t, lang } = useI18n();
  // Idioma leído por ref: la sesión de voz se abre con el idioma vigente al
  // arrancar (un cambio a mitad de llamada toma efecto en la siguiente
  // sesión — no se reconecta en caliente).
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const start = useCallback(async (isCancelled: () => boolean) => {
    try {
      assertActive();
      // Permiso de micrófono primero (falla temprano con degradación clara).
      await micLevel.request();
      if (isCancelled()) return;
      assertActive();
      // Idioma de la app en el request: el backend lo propaga al AI Service
      // y este deja el agente hablando ese idioma (PATCH server-side ANTES
      // de emitir el signed URL — con signed URL los overrides del cliente
      // no aplican de forma fiable; commit 8a7b746). Sin idioma ⇒ el agente
      // usa su configuración del dashboard (comportamiento histórico).
      const session = await requestVoiceSession(langRef.current);
      if (isCancelled()) return;
      assertActive();
      if (!session) {
        onFallback();
        return;
      }
      await eleven.startSession({ signedUrl: session.signedUrl });
      if (isCancelled()) void eleven.endSession();
    } catch (error) {
      if (!isCancelled()) {
        if (isLegalConsentError(error)) onConsentBlocked(error);
        else onFallback();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void start(() => cancelled);
    return () => {
      cancelled = true;
      void elevenRef.current.endSession();
    };
  }, [start, active]);

  const phase: VoicePhase =
    eleven.status !== "connected"
      ? "connecting"
      : eleven.isMuted
        ? "muted"
        : thinking
          ? "thinking"
          : eleven.isSpeaking
            ? "speaking"
            : "listening";

  // Lector estable por ref: el orbe lo llama ~60/s y nunca debe capturar un
  // cierre obsoleto del hook de la conversación.
  const elevenRef = useRef(eleven);
  elevenRef.current = eleven;
  const readAgentLevel = useCallback(
    () =>
      readAgentOutputLevel(
        elevenRef.current.getOutputVolume,
        elevenRef.current.getOutputByteFrequencyData,
      ),
    [],
  );

  const label =
    eleven.status !== "connected"
      ? t("Conectando…")
      : eleven.isMuted
        ? t("Micrófono silenciado")
        : thinking
          ? t("Pensando…")
          : eleven.isSpeaking
            ? t("Respondiendo…")
            : t("Escuchando…");

  return (
    <VoiceShell
      active={active}
      // Nivel del agente compuesto: RMS del SDK + energía espectral real
      // (getOutputByteFrequencyData) con ganancia perceptual — el orbe
      // acompana la cadencia de la voz aunque la amplitud bruta sea baja.
      micLevel={micLevel}
      getOutputVolume={readAgentLevel}
      phase={phase}
      statusLabel={label}
      transcriptLine={eleven.isSpeaking ? botLine : userLine}
      muted={eleven.isMuted}
      onToggleMute={() => eleven.setMuted(!eleven.isMuted)}
      onHangUp={onHangUp}
      onSendText={text => {
        try { assertActive(); } catch (error) { onConsentBlocked(error); return; }
        void verifyLegalConsent("voice", langRef.current).then(() => {
          assertActive();
          eleven.sendUserMessage(text);
        }).catch(onConsentBlocked);
      }}
    />
  );
}

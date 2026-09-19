import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  callOutline,
  videocamOutline,
  videocamOffOutline,
  micOutline,
  micOffOutline,
  close,
  chatbubbleEllipsesOutline,
  refreshOutline,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import {
  ApiClientError,
  fetchAppointmentRoom,
  fetchJoinToken,
} from "../utils/appointmentsApi";
import { APPOINTMENT_STATUS_LABELS } from "../data/appointments";
import { formatRoomMoment, roomWindowState } from "../utils/roomWindow";
import {
  classifyRoomEnd,
  roomEndTitleKey,
  twilioErrorMessageKey,
  type RoomEndCause,
} from "../utils/roomEnd";
import {
  canJoinWithMedia,
  initialMediaProbe,
  mediaPlan,
  mediaStatusLabelKey,
  probeRoomMedia,
  type MediaProbeResult,
  type MediaProbeStatus,
} from "../utils/roomMedia";
import { isRoomChatEnabled } from "../utils/roomChat";
import { RoomChatPanel } from "../components/RoomChatPanel";
import { PreVisitIntakeSheet } from "../components/PreVisitIntakeSheet";
import {
  isPreVisitIntakeEditable,
  preVisitIntakeVisible,
} from "../utils/preVisitIntake";
import { useI18n, useT } from "../i18n/I18nContext";

/**
 * Sala virtual de telemedicina (pantalla nueva, no toca las existentes).
 * Flujo: la ventana de acceso (roomOpensAt/roomClosesAt) viene de la LISTA de
 * citas del paciente — GET /appointments/{id} da 403 con JWT de paciente, no se
 * usa. Dentro de la ventana: join-token → SDK de Twilio Video (carga lazy desde
 * el CDN, mismo patrón del ERP) → videollamada. El backend se entera de la
 * conexión vía los webhooks de Twilio; session/start|end|reopen siguen siendo
 * exclusivos del profesional (ERP).
 */

// Tipos mínimos del SDK (se carga por CDN; sin dependencia npm).
interface TwilioTrack {
  attach(el: HTMLElement): HTMLElement;
  detach(el: HTMLElement): HTMLElement;
  enable?(): void;
  disable?(): void;
  stop?(): void;
}
interface TwilioTrackMap {
  forEach(cb: (publication: { track: TwilioTrack | null }) => void): void;
}
interface TwilioParticipant {
  identity: string;
  tracks: TwilioTrackMap;
  audioTracks?: TwilioTrackMap;
  videoTracks?: TwilioTrackMap;
  on: (event: string, cb: (p: TwilioParticipant | TwilioTrack) => void) => void;
}
interface TwilioRoom {
  localParticipant: TwilioParticipant;
  participants: Map<string, TwilioParticipant>;
  disconnect(): void;
  on: (event: string, cb: (p: TwilioParticipant | TwilioRoom) => void) => void;
}
interface TwilioVideoSdk {
  connect(
    token: string,
    opts: { audio: boolean; video: boolean },
  ): Promise<TwilioRoom>;
}

const SDK_URL =
  "https://sdk.twilio.com/js/video/releases/2.36.0/twilio-video.min.js";

/** TTL del token de sala (900 s) cuando el backend no envía expiresAt. */
const TOKEN_TTL_FALLBACK_MS = 900_000;
/** Cadencia del refresco de la sala mientras la llamada está activa. */
const ROOM_POLL_MS = 20_000;

let sdkPromise: Promise<TwilioVideoSdk> | null = null;

/** Carga el SDK de Twilio Video una sola vez (lazy, fuera del bundle inicial). */
function loadTwilioVideo(): Promise<TwilioVideoSdk> {
  if (!sdkPromise) {
    sdkPromise = new Promise<TwilioVideoSdk>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SDK_URL}"]`);
      if (existing) {
        const sdk = (
          window as unknown as { Twilio?: { Video?: TwilioVideoSdk } }
        ).Twilio?.Video;
        if (sdk) {
          resolve(sdk);
          return;
        }
        sdkPromise = null;
        reject(new Error("No se pudo cargar el SDK de video"));
        return;
      }
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => {
        const sdk = (
          window as unknown as { Twilio?: { Video?: TwilioVideoSdk } }
        ).Twilio?.Video;
        if (!sdk) {
          sdkPromise = null;
          reject(new Error("No se pudo cargar el SDK de video"));
          return;
        }
        resolve(sdk);
      };
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("No se pudo cargar el SDK de video"));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/** Habilita/deshabilita los tracks de un mapa (mic o cámara del local). */
function setTracksEnabled(tracks: TwilioTrackMap | undefined, enabled: boolean) {
  tracks?.forEach((publication) => {
    const track = publication.track;
    if (!track) return;
    if (enabled) track.enable?.();
    else track.disable?.();
  });
}

/** Detiene los tracks locales (apaga cámara/mic al colgar o reconectar). */
function stopLocalTracks(room: TwilioRoom | null) {
  room?.localParticipant.tracks.forEach((publication) => {
    publication.track?.stop?.();
  });
}

type Phase =
  "loading" | "ready" | "connecting" | "connected" | "ended" | "error";

export function VirtualRoomPage() {
  const { roomAppointment, closeRoom, navigate, user } = useApp();
  const t = useT();
  const { lang } = useI18n();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  /** Tracks locales realmente publicados (en audio-only no hay cámara). */
  const [hasLocalAudio, setHasLocalAudio] = useState(true);
  const [hasLocalVideo, setHasLocalVideo] = useState(true);
  /** Causa del fin cuando la sala se cierra (red vs consulta vs ventana). */
  const [endCause, setEndCause] = useState<RoomEndCause>("network");
  /** Sonda de cámara/micrófono del prejoin; null = comprobando. */
  const [mediaProbe, setMediaProbe] = useState<MediaProbeResult | null>(() =>
    initialMediaProbe(),
  );
  const [chatOpen, setChatOpen] = useState(false);
  /** Pre-consulta de la cita (F4) desde el prejoin: editable solo Confirmed. */
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const roomRef = useRef<TwilioRoom | null>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  /** Distingue el cuelgue intencional del corte inesperado (auto-reconexión). */
  const intentionalRef = useRef(false);
  /** Salta la auto-reconexión del handler cuando nosotros reconectamos. */
  const skipReconnectRef = useRef(false);
  /** Una reconexión automática por corte hasta que la conexión vuelva a estabilizarse. */
  const reconnectAttemptedRef = useRef(false);
  const tokenExpiresAtRef = useRef<number | null>(null);
  const connectRef = useRef<((reconnect?: boolean) => Promise<void>) | null>(
    null,
  );
  const apptId = roomAppointment?.id ?? null;
  const locale = lang === "en" ? "en-US" : "es-ES";

  // Estado de la ventana de acceso (se recalcula solo cada 30 s).
  const windowState = useMemo(
    () =>
      roomWindowState(
        now,
        roomAppointment?.roomOpensAt,
        roomAppointment?.roomClosesAt,
      ),
    [now, roomAppointment?.roomOpensAt, roomAppointment?.roomClosesAt],
  );
  const windowOpen = windowState !== "before" && windowState !== "after";
  // Pre-consulta visible con la cita vigente (Confirmed, editable) o en curso
  // (InProgress, solo lectura); el guardado real vive en el backend (409 al
  // iniciar la sesión).
  const intakeVisible = preVisitIntakeVisible(roomAppointment?.status);
  const intakeEditable = isPreVisitIntakeEditable(roomAppointment?.status);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Sin cita activa: vuelve a la pantalla de citas.
  useEffect(() => {
    if (!roomAppointment) navigate("book");
  }, [roomAppointment, navigate]);

  const detachAll = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }, []);

  const hangUp = useCallback(() => {
    intentionalRef.current = true;
    stopLocalTracks(roomRef.current);
    roomRef.current?.disconnect();
    roomRef.current = null;
    detachAll(localRef.current);
    detachAll(remoteRef.current);
    setChatOpen(false);
    setPhase("ended");
    setSeconds(0);
    closeRoom();
  }, [detachAll, closeRoom]);

  /**
   * Cierra la sala con la causa clasificada (red / consulta finalizada /
   * ventana cerrada). GET /room + la cita son la autoridad; si no se pueden
   * consultar se conserva el fallback (red).
   */
  const finalizeEnd = useCallback(
    async (fallback: RoomEndCause = "network") => {
      let cause = fallback;
      if (apptId) {
        const windowState = roomWindowState(
          Date.now(),
          roomAppointment?.roomOpensAt,
          roomAppointment?.roomClosesAt,
        );
        try {
          const room = await fetchAppointmentRoom(apptId);
          cause = classifyRoomEnd({
            windowState,
            appointmentStatus: roomAppointment?.status,
            roomStatus: room.status,
            activeSessionStatus: room.activeSessionStatus,
          });
        } catch (err) {
          if (err instanceof ApiClientError && err.status === 404) {
            // Sala inexistente: la cita decide (Completed → finalizada).
            cause = classifyRoomEnd({
              windowState,
              appointmentStatus: roomAppointment?.status,
            });
          }
        }
      }
      if (!mountedRef.current) return;
      intentionalRef.current = true;
      stopLocalTracks(roomRef.current);
      roomRef.current?.disconnect();
      roomRef.current = null;
      detachAll(localRef.current);
      detachAll(remoteRef.current);
      setEndCause(cause);
      setChatOpen(false);
      setPhase("ended");
    },
    [apptId, roomAppointment, detachAll],
  );

  const attachParticipant = useCallback(
    (participant: TwilioParticipant, container: HTMLElement | null) => {
      if (!container) return;
      participant.tracks.forEach((publication) => {
        const track = publication.track;
        if (
          track &&
          typeof (track as { attach?: unknown }).attach === "function"
        ) {
          (track as TwilioTrack).attach(container);
        }
      });
    },
    [],
  );

  /**
   * En Twilio Video los tracks se publican DESPUÉS de participantConnected:
   * hay que suscribirse a trackSubscribed (y re-visitar los ya publicados).
   * Sin esto los contenedores quedan vacíos (pantalla negra en consulta).
   */
  const setupParticipant = useCallback(
    (participant: TwilioParticipant, container: HTMLElement | null) => {
      const el = container ?? null;
      participant.on("trackSubscribed", (p) => {
        const track = p as TwilioTrack;
        if (
          track &&
          el &&
          typeof (track as { attach?: unknown }).attach === "function"
        ) {
          (track as TwilioTrack).attach(el);
        }
      });
      participant.on("trackUnsubscribed", (p) => {
        const track = p as TwilioTrack;
        if (
          track &&
          el &&
          typeof (track as { detach?: unknown }).detach === "function"
        ) {
          (track as TwilioTrack).detach(el);
        }
      });
      attachParticipant(participant, container);
    },
    [attachParticipant],
  );

  /** Conecta la sala ya negociada: pinta participantes y engancha eventos. */
  const wireRoom = useCallback(
    (room: TwilioRoom, plan: { audio: boolean; video: boolean }) => {
      roomRef.current = room;
      reconnectAttemptedRef.current = false;
      setMicOn(plan.audio);
      setCamOn(plan.video);
      setHasLocalAudio(plan.audio);
      setHasLocalVideo(plan.video);

      // Local: los tracks de cámara/mic llegan vía trackSubscribed tras connect.
      setupParticipant(room.localParticipant, localRef.current);
      setPhase("connected");
      setParticipants([room.localParticipant.identity]);

      // Remotos ya conectados al entrar.
      room.participants.forEach((p) => {
        setParticipants((prev) =>
          prev.includes(p.identity) ? prev : [...prev, p.identity],
        );
        setupParticipant(p, remoteRef.current);
      });

      room.on("participantConnected", (p) => {
        const participant = p as TwilioParticipant;
        setParticipants((prev) =>
          prev.includes(participant.identity)
            ? prev
            : [...prev, participant.identity],
        );
        setupParticipant(participant, remoteRef.current);
      });
      room.on("participantDisconnected", (p) => {
        const participant = p as TwilioParticipant;
        // Limpieza de los tracks del que se fue (el contenedor es único y los
        // demás siguen publicados: no se vacía a ciegas).
        const container = remoteRef.current;
        participant.tracks.forEach((publication) => {
          const track = publication.track;
          if (
            container &&
            track &&
            typeof (track as { detach?: unknown }).detach === "function"
          ) {
            (track as TwilioTrack).detach(container);
          }
        });
        setParticipants((prev) =>
          prev.filter((id) => id !== participant.identity),
        );
      });
      room.on("disconnected", () => {
        const current = roomRef.current;
        roomRef.current = null;
        stopLocalTracks(current);
        detachAll(localRef.current);
        detachAll(remoteRef.current);
        if (
          intentionalRef.current ||
          skipReconnectRef.current ||
          !mountedRef.current
        ) {
          skipReconnectRef.current = false;
          return;
        }
        // Corte inesperado: una reconexión con token fresco; si ya se intentó,
        // la sala se cierra con la causa clasificada (red vs consulta
        // finalizada vs ventana cerrada).
        if (!reconnectAttemptedRef.current) {
          reconnectAttemptedRef.current = true;
          console.warn("[room] Conexión perdida; reconectando con token nuevo…");
          void connectRef.current?.(true);
          return;
        }
        void finalizeEnd("network");
      });
    },
    [detachAll, setupParticipant, finalizeEnd],
  );

  const connect = useCallback(
    async (reconnect = false) => {
      if (!apptId || !roomAppointment) return;
      setPhase("connecting");
      setError(null);
      intentionalRef.current = false;
      if (!reconnect) {
        reconnectAttemptedRef.current = false;
        setEndCause("network");
        setChatOpen(false);
      }
      try {
        const join = await fetchJoinToken(apptId);
        tokenExpiresAtRef.current = join.expiresAt
          ? new Date(join.expiresAt).getTime()
          : Date.now() + TOKEN_TTL_FALLBACK_MS;
        const sdk = await loadTwilioVideo();
        // Entra solo con los tracks que el preflight dio por listos (si la
        // cámara no está disponible, la conexión se degrada a audio).
        const plan = mediaPlan(mediaProbe);
        const room = await sdk.connect(join.token, {
          audio: plan.audio,
          video: plan.video,
        });
        if (!mountedRef.current) {
          room.disconnect();
          return;
        }
        wireRoom(room, plan);
      } catch (err) {
        if (!mountedRef.current) return;
        console.warn("[room] No se pudo entrar a la sala:", err);
        setNow(Date.now());
        // Reconexión fallida: se cierra con la causa real (red, consulta
        // finalizada o ventana cerrada), sin pantalla de error intermedia.
        if (reconnect) {
          void finalizeEnd("network");
          return;
        }
        const status = err instanceof ApiClientError ? err.status : 0;
        const message =
          twilioErrorMessageKey(err) ??
          (status === 409
            ? t(
                "La sala no está disponible en este momento. Actualiza tus citas e inténtalo más tarde.",
              )
            : err instanceof Error &&
                /No se pudo cargar el SDK/.test(err.message)
              ? t("No se pudo cargar el video. Verifica tu conexión.")
              : err instanceof Error && err.message
                ? err.message
                : t("No se pudo entrar a la sala"));
        setError(message);
        setPhase("error");
      }
    },
    [apptId, roomAppointment, wireRoom, mediaProbe, t, finalizeEnd],
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Montaje/desmontaje: corta tracks y conexión (sin auto-reconexión).
  useEffect(() => {
    mountedRef.current = true;
    intentionalRef.current = false;
    return () => {
      mountedRef.current = false;
      intentionalRef.current = true;
      stopLocalTracks(roomRef.current);
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  // Preflight (fase ready): sonda real de dispositivos/permisos con parada
  // inmediata de los tracks (el estado inicial ya resuelve unsupported/
  // insecure sin asincronía). OJO: en iOS el WKWebView no entrega frames de
  // cámara a getUserMedia (riesgo documentado en CameraCapture.tsx:13-22);
  // si no hay cámara se entra solo con audio.
  useEffect(() => {
    if (phase !== "ready" || mediaProbe !== null) return;
    let cancelled = false;
    void (async () => {
      const result = await probeRoomMedia();
      if (!cancelled && mountedRef.current) setMediaProbe(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, mediaProbe]);

  // TTL del token (900 s): la conexión se renueva con un token fresco antes
  // de que el SDK quede con credenciales vencidas.
  useEffect(() => {
    if (phase !== "connected") return;
    const expiresAt = tokenExpiresAtRef.current;
    const delay = Math.max(
      (expiresAt ?? Date.now() + TOKEN_TTL_FALLBACK_MS) - Date.now() - 15_000,
      1_000,
    );
    const timer = window.setTimeout(() => {
      if (!mountedRef.current || intentionalRef.current || !roomRef.current)
        return;
      reconnectAttemptedRef.current = true;
      skipReconnectRef.current = true;
      const room = roomRef.current;
      roomRef.current = null;
      stopLocalTracks(room);
      room.disconnect();
      console.warn("[room] Token de sala próximo a expirar; reconectando…");
      void connectRef.current?.(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Mientras la llamada está activa, la sala se refresca cada 20 s: si el
  // backend la dio por terminada (status o sesión), se cierra y se avisa.
  useEffect(() => {
    if (phase !== "connected" || !apptId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const room = await fetchAppointmentRoom(apptId);
        if (cancelled || !mountedRef.current) return;
        const ended =
          room.status === "Ended" ||
          room.status === "Expired" ||
          room.status === "Failed" ||
          room.activeSessionStatus === "Ended";
        if (!ended) return;
        console.warn("[room] La sala terminó según el backend.");
        intentionalRef.current = true;
        setEndCause("session-ended");
        setChatOpen(false);
        stopLocalTracks(roomRef.current);
        roomRef.current?.disconnect();
        roomRef.current = null;
        setPhase("ended");
      } catch (err) {
        // 404 esperado mientras la sala no exista; cualquier fallo se reintenta
        // en el próximo tick sin ensuciar la UI.
        if (!(err instanceof ApiClientError && err.status === 404)) {
          console.warn("[room] No se pudo consultar la sala:", err);
        }
      }
    };
    const timer = window.setInterval(() => void check(), ROOM_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase, apptId]);

  // Contador de duración mientras la llamada está activa.
  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      const next = !on;
      setTracksEnabled(roomRef.current?.localParticipant.audioTracks, next);
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamOn((on) => {
      const next = !on;
      setTracksEnabled(roomRef.current?.localParticipant.videoTracks, next);
      return next;
    });
  }, []);

  const duration = useMemo(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [seconds]);

  if (!roomAppointment) return null;

  const statusLabel = roomAppointment.status
    ? APPOINTMENT_STATUS_LABELS[roomAppointment.status]
    : roomAppointment.when;

  const cameraStatus: MediaProbeStatus = mediaProbe?.camera ?? "checking";
  const microphoneStatus: MediaProbeStatus =
    mediaProbe?.microphone ?? "checking";
  const cameraReady = cameraStatus === "ready";
  const microphoneReady = microphoneStatus === "ready";
  const devicesReady = cameraReady && microphoneReady;
  // Si la cámara no está pero el micrófono sí, la entrada se degrada a audio.
  const audioOnly = mediaProbe !== null && !cameraReady && microphoneReady;
  const joinAllowed = windowOpen && canJoinWithMedia(mediaProbe);
  const mediaBlocked = mediaProbe !== null && !canJoinWithMedia(mediaProbe);

  return (
    <div className="room-screen">
      <header className="room-header">
        <IonButton
          className="bt bt-round room-close"
          aria-label={t("Salir")}
          onClick={hangUp}
        >
          <IonIcon slot="icon-only" icon={close} />
        </IonButton>
        <div className="room-header-copy">
          <strong>{roomAppointment.name}</strong>
          <span>
            {phase === "connected"
              ? `${t("En consulta")} · ${duration}`
              : phase === "connecting"
                ? t("Conectando…")
                : `${roomAppointment.motivo} · ${roomAppointment.time} ${t(roomAppointment.day)}`}
          </span>
        </div>
        <span
          className={`room-dot ${phase === "connected" ? "live" : ""}`}
          aria-hidden="true"
        />
      </header>

      <main className="room-stage">
        {phase === "error" ? (
          <div className="room-empty">
            <IonIcon icon={videocamOffOutline} />
            <strong>{t("No se pudo entrar a la sala")}</strong>
            <p>{error}</p>
            {windowOpen ? (
              <IonButton className="bt bt-primary" onClick={() => void connect()}>
                {t("Reintentar")}
              </IonButton>
            ) : (
              <p>
                {windowState === "before"
                  ? t("La sala todavía no está abierta")
                  : t("La ventana de acceso a la sala ya terminó")}
              </p>
            )}
          </div>
        ) : phase === "ready" ? (
          <div className="room-empty">
            <IonIcon icon={videocamOutline} />
            <strong>{t("Sala virtual lista")}</strong>
            <div className="room-info">
              <span>
                <b>{t("Paciente")}</b>
                <span>{user.nombre}</span>
              </span>
              <span>
                <b>{t("Profesional")}</b>
                <span>{roomAppointment.name}</span>
              </span>
              <span>
                <b>{t("Especialidad")}</b>
                <span>{t(roomAppointment.motivo)}</span>
              </span>
              <span>
                <b>{t("Fecha y hora")}</b>
                <span>
                  {roomAppointment.time} · {t(roomAppointment.day)}
                </span>
              </span>
              <span>
                <b>{t("Código de cita")}</b>
                <span title={roomAppointment.id}>
                  {roomAppointment.id.slice(0, 8).toUpperCase()}
                </span>
              </span>
              <span>
                <b>{t("Estado")}</b>
                <span>{t(statusLabel)}</span>
              </span>
            </div>
            {windowState === "before" ? (
              <div className="room-notice">
                <strong>{t("La sala todavía no está abierta")}</strong>
                <span>
                  {t("Abre el {fecha}", {
                    fecha: formatRoomMoment(
                      roomAppointment.roomOpensAt,
                      locale,
                    ),
                  })}
                </span>
              </div>
            ) : windowState === "after" ? (
              <div className="room-notice">
                <strong>{t("La ventana de acceso a la sala ya terminó")}</strong>
                <span>
                  {t("Cerró el {fecha}", {
                    fecha: formatRoomMoment(
                      roomAppointment.roomClosesAt,
                      locale,
                    ),
                  })}
                </span>
              </div>
            ) : (
              <p>
                {t(
                  "Entra cuando el profesional esté disponible (hasta 10 min antes de la cita).",
                )}
              </p>
            )}
            <div className="room-devices" aria-live="polite">
              <span className={`room-device${cameraReady ? " ok" : ""}`}>
                <IonIcon
                  icon={cameraReady ? videocamOutline : videocamOffOutline}
                />
                <span>{t(mediaStatusLabelKey(cameraStatus, "camera"))}</span>
              </span>
              <span className={`room-device${microphoneReady ? " ok" : ""}`}>
                <IonIcon icon={microphoneReady ? micOutline : micOffOutline} />
                <span>
                  {t(mediaStatusLabelKey(microphoneStatus, "microphone"))}
                </span>
              </span>
            </div>
            {mediaBlocked ? (
              <p className="room-device-hint">
                {t(
                  "Revisa los permisos de cámara y micrófono en los ajustes del sistema.",
                )}
              </p>
            ) : null}
            {intakeVisible ? (
              <IonButton
                fill="clear"
                className="room-intake"
                onClick={() => setIntakeOpen(true)}
              >
                {intakeEditable
                  ? t("Completar mi pre-consulta")
                  : t("Ver mi pre-consulta")}
              </IonButton>
            ) : null}
            <IonButton
              className="bt bt-teal"
              disabled={!joinAllowed}
              onClick={() => void connect()}
            >
              <IonIcon icon={callOutline} slot="start" />
              {audioOnly ? t("Unirme solo con audio") : t("Entrar a la consulta")}
            </IonButton>
            {mediaProbe && !devicesReady ? (
              <IonButton
                fill="clear"
                className="room-device-retry"
                onClick={() => setMediaProbe(null)}
              >
                <IonIcon icon={refreshOutline} slot="start" />
                {t("Volver a comprobar")}
              </IonButton>
            ) : null}
          </div>
        ) : phase === "ended" ? (
          <div className="room-empty">
            <IonIcon
              icon={endCause === "session-ended" ? callOutline : videocamOffOutline}
            />
            <strong>{t(roomEndTitleKey(endCause))}</strong>
            <p>
              {endCause === "network"
                ? t("No pudimos restablecer la conexión.")
                : endCause === "session-ended"
                  ? t("El profesional finalizó la consulta.")
                  : t("La sala ya no está disponible.")}
            </p>
            {endCause === "network" && windowOpen ? (
              <IonButton
                className="bt bt-teal"
                onClick={() => void connect()}
              >
                <IonIcon icon={refreshOutline} slot="start" />
                {t("Reintentar conexión")}
              </IonButton>
            ) : null}
            <IonButton
              className="bt bt-primary"
              onClick={() => navigate("book")}
            >
              {t("Volver a mis citas")}
            </IonButton>
          </div>
        ) : (
          // Los contenedores de video se montan DESDE connecting: los tracks
          // de Twilio llegan vía trackSubscribed tras el connect y los refs
          // deben existir en ese momento (si no, el attach se pierde y la
          // pantalla queda vacía).
          <div className="room-video">
            <div className="room-remote" ref={remoteRef}>
              {phase === "connecting" ? (
                <div className="room-connecting">
                  <IonSpinner name="crescent" />
                  <strong>{t("Entrando a la sala…")}</strong>
                </div>
              ) : participants.length <= 1 ? (
                <span className="room-waiting">
                  {t("Esperando al profesional…")}
                </span>
              ) : null}
            </div>
            <div className="room-local" ref={localRef} />
            {phase === "connected" ? (
              <div className="room-pill">
                <IonIcon icon={micOn ? micOutline : micOffOutline} />
                <IonIcon icon={camOn ? videocamOutline : videocamOffOutline} />
                <span>
                  {participants.length} {t("en sala")}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {phase === "connected" ? (
        <footer className="room-foot">
          <div className="room-ctrls">
            <IonButton
              className={`bt bt-round room-toggle${micOn ? "" : " off"}`}
              disabled={!hasLocalAudio}
              aria-label={
                micOn ? t("Silenciar micrófono") : t("Activar micrófono")
              }
              onClick={toggleMic}
            >
              <IonIcon
                slot="icon-only"
                icon={micOn ? micOutline : micOffOutline}
              />
            </IonButton>
            <IonButton
              className={`bt bt-round room-toggle${camOn ? "" : " off"}`}
              disabled={!hasLocalVideo}
              aria-label={camOn ? t("Apagar cámara") : t("Encender cámara")}
              onClick={toggleCam}
            >
              <IonIcon
                slot="icon-only"
                icon={camOn ? videocamOutline : videocamOffOutline}
              />
            </IonButton>
            <IonButton
              className="bt bt-round room-toggle"
              aria-label={t("Chat de la consulta")}
              onClick={() => setChatOpen(true)}
            >
              <IonIcon slot="icon-only" icon={chatbubbleEllipsesOutline} />
            </IonButton>
            <IonButton
              className="bt bt-round room-hang"
              aria-label={t("Colgar")}
              onClick={hangUp}
            >
              <IonIcon slot="icon-only" icon={callOutline} />
            </IonButton>
          </div>
          <span className="room-hint">
            {t("La sesión la inicia y finaliza el profesional")}
          </span>
        </footer>
      ) : null}

      {chatOpen && apptId ? (
        <RoomChatPanel
          appointmentId={apptId}
          enabled={isRoomChatEnabled(roomAppointment.status)}
          onClose={() => setChatOpen(false)}
        />
      ) : null}

      {intakeOpen && apptId ? (
        <PreVisitIntakeSheet
          appointmentId={apptId}
          editable={intakeEditable}
          onClose={() => setIntakeOpen(false)}
        />
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  callOutline,
  videocamOutline,
  videocamOffOutline,
  micOutline,
  micOffOutline,
  close,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import {
  ApiClientError,
  fetchAppointmentRoom,
  fetchJoinToken,
} from "../utils/appointmentsApi";
import { APPOINTMENT_STATUS_LABELS } from "../data/appointments";
import { formatRoomMoment, roomWindowState } from "../utils/roomWindow";
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
  const [roomEnded, setRoomEnded] = useState(false);
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
    setPhase("ended");
    setSeconds(0);
    closeRoom();
  }, [detachAll, closeRoom]);

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
    (room: TwilioRoom) => {
      roomRef.current = room;
      reconnectAttemptedRef.current = false;
      setMicOn(true);
      setCamOn(true);

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
        // la consulta se cierra.
        if (!reconnectAttemptedRef.current) {
          reconnectAttemptedRef.current = true;
          console.warn("[room] Conexión perdida; reconectando con token nuevo…");
          void connectRef.current?.(true);
          return;
        }
        setPhase("ended");
      });
    },
    [detachAll, setupParticipant],
  );

  const connect = useCallback(
    async (reconnect = false) => {
      if (!apptId || !roomAppointment) return;
      setPhase("connecting");
      setError(null);
      if (!reconnect) {
        reconnectAttemptedRef.current = false;
        setRoomEnded(false);
      }
      try {
        const join = await fetchJoinToken(apptId);
        tokenExpiresAtRef.current = join.expiresAt
          ? new Date(join.expiresAt).getTime()
          : Date.now() + TOKEN_TTL_FALLBACK_MS;
        const sdk = await loadTwilioVideo();
        const room = await sdk.connect(join.token, { audio: true, video: true });
        if (!mountedRef.current) {
          room.disconnect();
          return;
        }
        wireRoom(room);
      } catch (err) {
        if (!mountedRef.current) return;
        console.warn("[room] No se pudo entrar a la sala:", err);
        setNow(Date.now());
        const status = err instanceof ApiClientError ? err.status : 0;
        // 409 = el backend rechaza la ventana/estado de la cita. En una
        // reconexión significa que la consulta ya terminó.
        if (reconnect && (status === 409 || windowState === "after")) {
          setRoomEnded(true);
          setPhase("ended");
          return;
        }
        const message =
          status === 409
            ? t(
                "La sala no está disponible en este momento. Actualiza tus citas e inténtalo más tarde.",
              )
            : err instanceof Error && /No se pudo cargar el SDK/.test(err.message)
              ? t("No se pudo cargar el video. Verifica tu conexión.")
              : err instanceof Error && err.message
                ? err.message
                : t("No se pudo entrar a la sala");
        setError(message);
        setPhase("error");
      }
    },
    [apptId, roomAppointment, wireRoom, windowState, t],
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
        setRoomEnded(true);
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
            <IonButton
              className="bt bt-teal"
              disabled={!windowOpen}
              onClick={() => void connect()}
            >
              <IonIcon icon={callOutline} slot="start" />
              {t("Entrar a la consulta")}
            </IonButton>
          </div>
        ) : phase === "ended" ? (
          <div className="room-empty">
            <IonIcon icon={callOutline} />
            <strong>
              {roomEnded ? t("La consulta finalizó") : t("Consulta finalizada")}
            </strong>
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
              aria-label={camOn ? t("Apagar cámara") : t("Encender cámara")}
              onClick={toggleCam}
            >
              <IonIcon
                slot="icon-only"
                icon={camOn ? videocamOutline : videocamOffOutline}
              />
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
    </div>
  );
}

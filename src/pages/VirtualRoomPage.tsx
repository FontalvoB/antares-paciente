import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  callOutline,
  videocamOutline,
  videocamOffOutline,
  micOutline,
  close,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { fetchJoinToken } from "../utils/appointmentsApi";
import { useT } from "../i18n/I18nContext";

/**
 * Sala virtual de telemedicina (pantalla nueva, no toca las existentes).
 * Flujo: join-token del microservicio (autoriza al paciente por identidad) →
 * SDK de Twilio Video (carga lazy desde el CDN, mismo patrón del ERP) →
 * videollamada con el profesional. El backend se entera de la conexión vía
 * los webhooks de Twilio (participant-connected); session/start|end siguen
 * siendo exclusivos del profesional (ERP).
 */

// Tipos mínimos del SDK (se carga por CDN; sin dependencia npm).
interface TwilioTrack {
  attach(el: HTMLElement): HTMLElement;
  detach(el: HTMLElement): HTMLElement;
}
interface TwilioParticipant {
  identity: string;
  tracks: Map<string, { track: TwilioTrack | null }>;
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
  "https://sdk.twilio.com/js/video/releases/2.30.0/twilio-video.min.js";

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

type Phase =
  "loading" | "ready" | "connecting" | "connected" | "ended" | "error";

export function VirtualRoomPage() {
  const { roomAppointment, closeRoom, navigate } = useApp();
  const t = useT();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const roomRef = useRef<TwilioRoom | null>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);
  const apptId = roomAppointment?.id ?? null;

  // Sin cita activa: vuelve a la pantalla de citas.
  useEffect(() => {
    if (!roomAppointment) navigate("book");
  }, [roomAppointment, navigate]);

  const detachAll = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }, []);

  const hangUp = useCallback(() => {
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

  const join = useCallback(async () => {
    if (!apptId || !roomAppointment) return;
    setPhase("connecting");
    setError(null);
    try {
      const { token } = await fetchJoinToken(apptId);
      const sdk = await loadTwilioVideo();
      const room = await sdk.connect(token, { audio: true, video: true });
      roomRef.current = room;

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
        setParticipants((prev) =>
          prev.filter((id) => id !== participant.identity),
        );
      });
      room.on("disconnected", () => {
        roomRef.current = null;
        setPhase("ended");
      });
    } catch (err) {
      console.warn("[room] No se pudo entrar a la sala:", err);
      const message =
        err instanceof Error && /No se pudo cargar el SDK/.test(err.message)
          ? t("No se pudo cargar el video. Verifica tu conexión.")
          : err instanceof Error && err.message
            ? err.message
            : t("No se pudo entrar a la sala");
      setError(message);
      setPhase("error");
    }
  }, [apptId, roomAppointment, setupParticipant, t]);

  // Contador de duración mientras la llamada está activa.
  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Limpieza al desmontar (salir de la pantalla sin colgar).
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const duration = useMemo(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [seconds]);

  if (!roomAppointment) return null;

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
            <IonButton className="bt bt-primary" onClick={join}>
              {t("Reintentar")}
            </IonButton>
          </div>
        ) : phase === "ready" ? (
          <div className="room-empty">
            <IonIcon icon={videocamOutline} />
            <strong>{t("Sala virtual lista")}</strong>
            <p>
              {t(
                "Entra cuando el profesional esté disponible (hasta 10 min antes de la cita).",
              )}
            </p>
            <IonButton className="bt bt-teal" onClick={join}>
              <IonIcon icon={callOutline} slot="start" />
              {t("Entrar a la consulta")}
            </IonButton>
          </div>
        ) : phase === "ended" ? (
          <div className="room-empty">
            <IonIcon icon={callOutline} />
            <strong>{t("Consulta finalizada")}</strong>
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
                <IonIcon icon={micOutline} />
                <IonIcon icon={videocamOutline} />
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
          <IonButton
            className="bt bt-round room-hang"
            aria-label={t("Colgar")}
            onClick={hangUp}
          >
            <IonIcon slot="icon-only" icon={callOutline} />
          </IonButton>
          <span className="room-hint">
            {t("La sesión la inicia y finaliza el profesional")}
          </span>
        </footer>
      ) : null}
    </div>
  );
}

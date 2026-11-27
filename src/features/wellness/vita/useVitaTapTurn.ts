import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "../../../utils/apiBaseUrl";
import { getAccessToken } from "../../../utils/authApi";
import {
  assertLegalConsentOwner, isLegalConsentError, legalConsentMessage,
  legalConsentOwner, legalConsentResponseError, onLegalConsentChange, requireLegalConsent,
} from "../../../utils/legalConsents";
import { isSosUtterance, requestSos } from "../sos/sos-store";

type Phase = "idle" | "preparing" | "recording" | "sending";
type Result = { transcript: string; reply: string };
const ERROR = "No se pudo completar el turno de voz.";
const FORMAT = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_RECORDING_MS = 20_000;

type Turn = {
  controller: AbortController;
  stop?: () => void;
  release?: () => void;
};
type Playback = { url: string; player: HTMLAudioElement };

export function useVitaTapTurn(active: boolean, lang: "es" | "en") {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Result>();
  const current = useRef<Turn | null>(null);
  const playback = useRef<Playback | null>(null);

  const clearPlayback = useCallback(() => {
    if (!playback.current) return;
    playback.current.player.pause();
    URL.revokeObjectURL(playback.current.url);
    playback.current = null;
  }, []);

  const cancel = useCallback(() => {
    const turn = current.current;
    current.current = null;
    turn?.controller.abort();
    turn?.release?.();
    clearPlayback();
    setPhase("idle");
    setError(undefined);
    setResult(undefined);
  }, [clearPlayback]);

  useEffect(() => {
    if (!active) return;
    const handleVisibility = () => { if (document.hidden) cancel(); };
    const unsubscribe = onLegalConsentChange((scope) => {
      if (scope === null || scope === "voice" || scope === "chat") cancel();
    });
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      cancel();
    };
  }, [active, cancel, lang]);

  const play = useCallback(() => {
    void playback.current?.player.play().catch(() => {
      // WebKit puede exigir un nuevo toque tras la espera de red.
      // El botón de reproducción sigue disponible.
    });
  }, []);

  async function start() {
    if (!active || current.current) return;
    clearPlayback();
    setResult(undefined);
    setError(undefined);
    setPhase("preparing");
    const turn: Turn = { controller: new AbortController() };
    current.current = turn;
    const owner = legalConsentOwner();
    const signal = turn.controller.signal;
    const fail = (failure: unknown) => {
      if (current.current !== turn) return;
      cancel();
      setError(isLegalConsentError(failure) ? legalConsentMessage(failure) : ERROR);
    };
    try {
      await requireLegalConsent("voice", lang, signal);
      await requireLegalConsent("chat", lang, signal);
      signal.throwIfAborted();
      assertLegalConsentOwner(owner);
      const format = FORMAT.find((value) => globalThis.MediaRecorder?.isTypeSupported(value));
      if (!format || !navigator.mediaDevices?.getUserMedia) throw new Error();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let micReleased = false;
      const releaseMic = () => {
        if (micReleased) return;
        micReleased = true;
        stream.getTracks().forEach((track) => track.stop());
      };
      turn.release = releaseMic;
      if (signal.aborted) { releaseMic(); return; }
      assertLegalConsentOwner(owner);
      const recorder = new MediaRecorder(stream, { mimeType: format });
      const chunks: Blob[] = [];
      let bytes = 0;
      let requested = false;
      let timer = 0;
      turn.release = () => {
        window.clearTimeout(timer);
        if (recorder.state !== "inactive") recorder.stop();
        releaseMic();
      };
      turn.stop = () => {
        if (current.current !== turn || requested) return;
        requested = true;
        setPhase("sending");
        turn.release?.();
      };
      recorder.addEventListener("error", fail);
      recorder.addEventListener("dataavailable", (event) => {
        if (signal.aborted) return;
        bytes += event.data.size;
        if (bytes > MAX_BYTES) fail(undefined);
        else chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        if (!requested || signal.aborted) return;
        void (async () => {
          if (!bytes) throw new Error();
          assertLegalConsentOwner(owner);
          const token = getAccessToken();
          if (!token) throw new Error();
          const response = await fetch(getApiBaseUrl() + "/api/v1/chat/voice/turn", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": recorder.mimeType || format,
              "X-Vita-Language": lang,
            },
            body: new Blob(chunks, { type: recorder.mimeType || format }),
            redirect: "error",
            signal,
          });
          if (!response.ok) throw (await legalConsentResponseError(response)) ?? new Error();
          const data = await response.json();
          signal.throwIfAborted();
          assertLegalConsentOwner(owner);
          if (typeof data.transcript !== "string" || typeof data.reply !== "string"
            || typeof data.audioBase64 !== "string" || data.audioBase64.length > 4_000_000) throw new Error();
          const wave = Uint8Array.from(atob(data.audioBase64), (character) => character.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([wave], { type: "audio/wav" }));
          playback.current = { url, player: new Audio(url) };
          current.current = null;
          setPhase("idle");
          setResult({ transcript: data.transcript, reply: data.reply });
          if (isSosUtterance(data.transcript)) requestSos("voice");
          else play();
        })().catch(fail);
      }, { once: true });
      recorder.start(250);
      timer = window.setTimeout(() => fail(undefined), MAX_RECORDING_MS);
      setPhase("recording");
    } catch (failure) {
      fail(failure);
    }
  }

  return { phase, error, result, start, send: () => current.current?.stop?.(), cancel, play };
}

/**
 * Agente de voz — Fase 1 MVP Web Speech API (change agente-asistente-citas, D4).
 *
 * Encapsula `SpeechRecognition` (con prefijo `webkit`) y `window.speechSynthesis`
 * para un ciclo bidireccional real:
 *  - Escucha continua en español (es-CO, fallback es-ES) con transcripción
 *    en vivo (interina + final) vía callback.
 *  - Detección de fin de intervención: el resultado `isFinal` del reconocedor
 *    dispara `onFinalTranscript` (con pequeño debounce para agrupar).
 *  - Vocalización de la respuesta del bot con la voz española disponible
 *    (o la default si el WebView no expone una voz es-*).
 *  - Silenciar/colgar limpian de inmediato reconocimiento y síntesis.
 *
 * Si el WebView/navegador no soporta la Web Speech API el hook lo reporta
 * (`supported=false`) y la UI ofrece el chat de texto (fallback D4).
 * Los tipos de la Web Speech API no están en lib.dom: se declaran mínimos.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Tipos mínimos de la Web Speech API (no presentes en lib.dom) ────────────

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export type SpeechAssistantState =
  "unsupported" | "idle" | "listening" | "processing" | "speaking";

/** Locale de reconocimiento: es-CO preferido; el navegador normaliza. */
export const SPEECH_LANG = "es-CO";

/** Ventana (ms) tras el último resultado final antes de considerar fin de turno. */
const FINALIZE_DEBOUNCE_MS = 1200;

export interface UseSpeechAssistantOptions {
  /** Texto final (transcripción consolidada) listo para enviar al asistente. */
  onFinalTranscript: (text: string) => void;
  /** Aviso no fatal de reconocimiento (p. ej. `no-speech`, `not-allowed`). */
  onError?: (message: string) => void;
  /** El reconocimiento se detuvo (fin natural o error): la UI retoma control. */
  onListeningEnd?: () => void;
}

export function useSpeechAssistant({
  onFinalTranscript,
  onError,
  onListeningEnd,
}: UseSpeechAssistantOptions) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<SpeechAssistantState>("idle");
  const [muted, setMuted] = useState(false);
  /** Transcripción en vivo (interina + final acumulada del turno en curso). */
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const mutedRef = useRef(false);
  const finalizeTimerRef = useRef<number | null>(null);
  const finalBufferRef = useRef("");

  // Detectar soporte una sola vez al montar.
  useEffect(() => {
    const w = window as unknown as SpeechRecognitionWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
  }, []);

  /** Resetea el buffer del turno y reagenda la finalización. */
  const scheduleFinalize = useCallback(
    (finalPiece: string) => {
      finalBufferRef.current = `${finalBufferRef.current} ${finalPiece}`.trim();
      if (finalizeTimerRef.current != null) {
        window.clearTimeout(finalizeTimerRef.current);
      }
      finalizeTimerRef.current = window.setTimeout(() => {
        finalizeTimerRef.current = null;
        const text = finalBufferRef.current.trim();
        finalBufferRef.current = "";
        setTranscript((prev) => prev); // el texto final ya está pintado
        if (text) onFinalTranscript(text);
      }, FINALIZE_DEBOUNCE_MS);
    },
    [onFinalTranscript],
  );

  const startListening = useCallback(() => {
    const w = window as unknown as SpeechRecognitionWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    wantListeningRef.current = true;
    mutedRef.current = false;
    setMuted(false);
    setState((prev) => (prev === "speaking" ? prev : "listening"));
    // Reusar la instancia viva si existe (una sola por overlay).
    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new Ctor();
      recognitionRef.current = recognition;
      recognition.lang = SPEECH_LANG;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        // Resultados tardíos tras silenciar/colgar: fuera (no generan turno).
        if (!wantListeningRef.current || mutedRef.current) return;
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            scheduleFinalize(text);
          } else {
            interim += text;
          }
        }
        // Transcripción en vivo: final acumulado + interina del momento.
        setTranscript(
          `${finalBufferRef.current}${interim ? ` ${interim}` : ""}`.trim(),
        );
      };

      recognition.onerror = (event) => {
        // `no-speech` y `aborted` son estados normales del ciclo continuo.
        if (event.error !== "no-speech" && event.error !== "aborted") {
          onError?.(event.error);
        }
      };

      recognition.onend = () => {
        if (wantListeningRef.current && !mutedRef.current) {
          // El WebView corta la sesión tras silencio largo: se relanza.
          try {
            recognition?.start();
            return;
          } catch {
            /* start en caliente puede lanzar: cae al estado */
          }
        }
        onListeningEnd?.();
      };
    }
    try {
      recognition.start();
    } catch {
      /* ya activo: ignorar */
    }
  }, [onError, onListeningEnd, scheduleFinalize]);

  /** Pausa el micrófono sin cerrar el overlay (estado "muted" visual). */
  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    mutedRef.current = true;
    setMuted(true);
    if (finalizeTimerRef.current != null) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ya detenido */
    }
    setState("idle");
  }, []);

  const toggleMute = useCallback(() => {
    if (mutedRef.current) {
      startListening();
    } else {
      stopListening();
    }
  }, [startListening, stopListening]);

  /**
   * Vocaliza la respuesta del bot y luego informa el fin (para retomar la
   * escucha). Cancelable de inmediato con `cancelSpeech()`.
   */
  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window) || !text) {
          resolve();
          return;
        }
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        // Voz en español si el WebView expone alguna; si no, la default.
        const esVoice = synth
          .getVoices()
          .find((v) => v.lang.toLowerCase().startsWith("es"));
        if (esVoice) utterance.voice = esVoice;
        utterance.lang = esVoice?.lang ?? SPEECH_LANG;
        utterance.rate = 1;
        utterance.onend = () => {
          setState("idle");
          resolve();
        };
        utterance.onerror = () => {
          setState("idle");
          resolve();
        };
        setState("speaking");
        synth.speak(utterance);
      }),
    [],
  );

  /** Corta la síntesis al instante (colgar o cerrar el overlay). */
  const cancelSpeech = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
  }, []);

  /** Limpieza total (desmontaje del overlay): micrófono + audio fuera. */
  const teardown = useCallback(() => {
    wantListeningRef.current = false;
    mutedRef.current = true;
    if (finalizeTimerRef.current != null) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      /* no iniciado */
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // Al desmontar se liberan micrófono y audio (riesgo D4: colgar con TTS viva).
  useEffect(() => teardown, [teardown]);

  const setStateExternal = useCallback((next: SpeechAssistantState) => {
    setState(next);
  }, []);

  return {
    supported,
    state,
    transcript,
    muted,
    setProcessing: () => setStateExternal("processing"),
    startListening,
    stopListening,
    toggleMute,
    speak,
    cancelSpeech,
    teardown,
  };
}

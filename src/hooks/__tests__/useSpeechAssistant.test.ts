import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSpeechAssistant, SPEECH_LANG } from "../useSpeechAssistant";

/**
 * REQ-AG-04 (change agente-asistente-citas, D4): hook del agente de voz
 * (Web Speech API) con ciclo real escucha → transcripción → síntesis.
 * Los dobles simulan SpeechRecognition/speechSynthesis (no existen en DOM).
 */

// ── Dobles de la Web Speech API ─────────────────────────────────────────────

type ResultHandler = (event: {
  resultIndex: number;
  results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
}) => void;

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  onresult: ResultHandler | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  static emit(text: string, isFinal: boolean, index = 0) {
    const inst = FakeRecognition.instances.at(-1);
    inst?.onresult?.({
      resultIndex: index,
      results: [{ isFinal, 0: { transcript: text } }],
    });
  }
}

const synthesis = {
  cancel: vi.fn(),
  speak: vi.fn(),
  getVoices: vi.fn(() => [{ lang: "es-CO", name: "es" }]),
};

class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function installSpeechApi(present: boolean) {
  if (present) {
    vi.stubGlobal("SpeechRecognition", FakeRecognition as unknown as undefined);
  } else {
    vi.unstubAllGlobals();
  }
  vi.stubGlobal("speechSynthesis", synthesis as unknown as SpeechSynthesis);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
  );
}

describe("useSpeechAssistant — Fase 1 Web Speech API", () => {
  beforeEach(() => {
    FakeRecognition.instances = [];
    (FakeRecognition as unknown as { started: boolean }).started = false;
    synthesis.cancel.mockClear();
    synthesis.speak.mockClear();
    synthesis.getVoices.mockClear();
    installSpeechApi(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detecta soporte y arranca la escucha continua en español", async () => {
    const { result } = renderHook(() =>
      useSpeechAssistant({ onFinalTranscript: vi.fn() }),
    );

    await waitFor(() => {
      expect(result.current.supported).toBe(true);
    });

    act(() => {
      result.current.startListening();
    });

    expect(FakeRecognition.instances).toHaveLength(1);
    const recognition = FakeRecognition.instances[0]!;
    expect(recognition.start).toHaveBeenCalled();
    expect(recognition.lang).toBe(SPEECH_LANG);
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
  });

  it("reporta unsupported cuando no hay SpeechRecognition", async () => {
    installSpeechApi(false);
    const { result } = renderHook(() =>
      useSpeechAssistant({ onFinalTranscript: vi.fn() }),
    );
    await waitFor(() => {
      expect(result.current.supported).toBe(false);
    });
  });

  it("transcribe en vivo (interina) y envía el texto final tras la pausa", async () => {
    vi.useFakeTimers();
    try {
      const onFinal = vi.fn();
      const { result } = renderHook(() =>
        useSpeechAssistant({ onFinalTranscript: onFinal }),
      );

      act(() => {
        result.current.startListening();
      });

      // Transcripción interina visible en vivo.
      act(() => {
        FakeRecognition.emit("me duele", false);
      });
      expect(result.current.transcript).toBe("me duele");

      // Resultado final (pausa detectada por el reconocedor).
      act(() => {
        FakeRecognition.emit("me duele el pecho", true);
      });

      // El envío se aguarda con debounce de silencio (1.2 s).
      expect(onFinal).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1300);
      });
      expect(onFinal).toHaveBeenCalledWith("me duele el pecho");
    } finally {
      vi.useRealTimers();
    }
  });

  it("agrupa resultados finales contiguos en un solo turno", async () => {
    vi.useFakeTimers();
    try {
      const onFinal = vi.fn();
      const { result } = renderHook(() =>
        useSpeechAssistant({ onFinalTranscript: onFinal }),
      );

      act(() => {
        result.current.startListening();
      });
      act(() => {
        FakeRecognition.emit("tengo", true);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        FakeRecognition.emit("tengo dolor", true);
      });
      // Segundo final reagenda el debounce: necesita su propia ventana 1.2 s.
      act(() => {
        vi.advanceTimersByTime(1300);
      });

      expect(onFinal).toHaveBeenCalledTimes(1);
      expect(onFinal).toHaveBeenCalledWith("tengo tengo dolor");
    } finally {
      vi.useRealTimers();
    }
  });

  it("silenciar detiene el reconocimiento y el buffer del turno", () => {
    vi.useFakeTimers();
    try {
      const onFinal = vi.fn();
      const { result } = renderHook(() =>
        useSpeechAssistant({ onFinalTranscript: onFinal }),
      );

      act(() => {
        result.current.startListening();
      });
      act(() => {
        result.current.stopListening();
      });

      expect(FakeRecognition.instances[0]!.stop).toHaveBeenCalled();
      expect(result.current.muted).toBe(true);

      // Un final pendiente antes del silencio no se despacha tras parar.
      act(() => {
        FakeRecognition.emit("texto", true);
      });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onFinal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("speak vocaliza con la voz en español y finaliza en idle", async () => {
    const { result } = renderHook(() =>
      useSpeechAssistant({ onFinalTranscript: vi.fn() }),
    );

    synthesis.speak.mockImplementation((utterance: FakeUtterance) => {
      utterance.onend?.();
    });

    await act(async () => {
      await result.current.speak("Hola, ¿cómo te sientes?");
    });

    expect(synthesis.cancel).toHaveBeenCalled();
    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = synthesis.speak.mock.calls[0]![0] as FakeUtterance;
    expect(utterance.text).toBe("Hola, ¿cómo te sientes?");
    expect(utterance.lang.startsWith("es")).toBe(true);
    expect(result.current.state).toBe("idle");
  });

  it("colgar/teardown cancela síntesis y aborta el micrófono", async () => {
    const { result } = renderHook(() =>
      useSpeechAssistant({ onFinalTranscript: vi.fn() }),
    );

    act(() => {
      result.current.startListening();
    });
    act(() => {
      result.current.teardown();
    });

    expect(FakeRecognition.instances[0]!.abort).toHaveBeenCalled();
    expect(synthesis.cancel).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
vi.mock("../legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined) }));
import {
  uploadLabExam,
  sendChatMessage,
  streamChatMessage,
  fetchThreadState,
  type LabExamUploadResult,
} from "../threadApi";

describe("fetchThreadState — contrato de sync de voz", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { globalThis.fetch = originalFetch; vi.useRealTimers(); });
  const canonical = { threadId: "t-1", messageCount: 1, lastMessage: "Sí", voiceSyncStatus: "synchronized",
    messages: [{ messageId: "opaque", role: "bot", text: "Sí", channel: "voice", status: "provider_final", revision: 2,
      source: "elevenlabs_transcript", voiceSessionId: "session", providerMessageId: null, sourceEventId: 14, executionId: "tracker" }] };

  it.each([undefined, false, true])("syncVoice=%s es aditivo; sin opción conserva la petición antigua", async syncVoice => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => canonical });
    expect(await fetchThreadState("t-1", "user", { syncVoice })).toEqual(canonical);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(String(url), "http://localhost").searchParams.get("syncVoice")).toBe(syncVoice == null ? null : String(syncVoice));
  });

  it("un servidor antiguo sin estado de sync mantiene el historial de texto", async () => {
    const legacy = { threadId: "t-1", messageCount: 1, lastMessage: "Texto", messages: [{ role: "bot", text: "Texto" }] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => legacy });
    expect(await fetchThreadState("t-1", "user", { syncVoice: true })).toEqual(legacy);
  });

  it("descarta una respuesta del propietario anterior sin usar el JWT nuevo", async () => {
    localStorage.setItem("copp_access_token", "owner-A");
    let finish!: (response: unknown) => void;
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = fetchThreadState("t-1", "user", { syncVoice: true });
    localStorage.setItem("copp_access_token", "owner-B");
    finish({ ok: true, json: async () => canonical });
    expect(await pending).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]!.headers).toEqual({ Authorization: "Bearer owner-A" });
  });

  it.each(["timeout", "cancelar"])("%s aborta el fetch y devuelve null sin afirmar sincronización", async reason => {
    let requestSignal!: AbortSignal;
    globalThis.fetch = vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      requestSignal = options.signal;
      requestSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const controller = new AbortController();
    const pending = fetchThreadState("t-1", "user", { syncVoice: true, signal: controller.signal });
    if (reason === "cancelar") controller.abort(); else await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toBeNull(); expect(requestSignal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("uploadLabExam", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uploads lab exam file and parses successful response", async () => {
    const mockResult: LabExamUploadResult = {
      batchId: "123e4567-e89b-12d3-a456-426614174000",
      summary: "Se detectaron 2 métricas: glucosa y HbA1c.",
      measurementCount: 2,
      detectedMetrics: ["glucose_fasting", "hba1c"],
      storageKey: "lab-exams/patient1/batch1/results.pdf",
    };

    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return {
        ok: true,
        json: async () => mockResult,
      } as Response;
    });

    const file = new File(["dummy-content"], "results.pdf", {
      type: "application/pdf",
    });
    const result = await uploadLabExam(file, "thread-xyz");

    expect(capturedUrl).toContain("/api/v1/lab-exams");
    expect(capturedOptions?.method).toBe("POST");
    expect(capturedOptions?.body).toBeInstanceOf(FormData);
    const formData = capturedOptions?.body as FormData;
    expect(formData.get("file")).toBeTruthy();
    expect(formData.get("threadId")).toBe("thread-xyz");
    expect(result).toEqual(mockResult);
  });

  it("includes Authorization Bearer header when access token is present", async () => {
    localStorage.setItem("copp_access_token", "mock-jwt-token");

    let capturedHeaders: HeadersInit | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedHeaders = options?.headers;
      return {
        ok: true,
        json: async () => ({
          batchId: "b1",
          summary: "ok",
          measurementCount: 0,
          detectedMetrics: [],
        }),
      } as Response;
    });

    const file = new File(["dummy"], "scan.png", { type: "image/png" });
    await uploadLabExam(file);

    expect((capturedHeaders as Record<string, string>)?.Authorization).toBe(
      "Bearer mock-jwt-token",
    );
  });

  it("throws user-facing error message on 422 Unprocessable Entity", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            code: "UNSUPPORTED_FILE_TYPE",
            message:
              "Unsupported file type. Please upload a JPEG, PNG, or PDF.",
          },
        }),
      } as Response;
    });

    const file = new File(["bad"], "doc.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await expect(uploadLabExam(file)).rejects.toThrow(
      "Unsupported file type. Please upload a JPEG, PNG, or PDF.",
    );
  });

  it("throws user-facing error message on 502 Bad Gateway", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 502,
        json: async () => ({
          error: {
            code: "AI_SERVICE_UNAVAILABLE",
            message:
              "El servicio de IA no pudo procesar el examen de laboratorio.",
          },
        }),
      } as Response;
    });

    const file = new File(["data"], "exam.pdf", { type: "application/pdf" });
    await expect(uploadLabExam(file)).rejects.toThrow(
      "El servicio de IA no pudo procesar el examen de laboratorio.",
    );
  });

  it("throws user-facing error message on 500 Internal Server Error", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: "INTERNAL_ERROR",
            message: "No fue posible procesar la solicitud.",
          },
        }),
      } as Response;
    });

    const file = new File(["data"], "exam.pdf", { type: "application/pdf" });
    await expect(uploadLabExam(file)).rejects.toThrow(
      "No fue posible procesar la solicitud.",
    );
  });

  it("appends the UI language to the multipart form data", async () => {
    let capturedOptions: RequestInit | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedOptions = options;
      return {
        ok: true,
        json: async () => ({
          batchId: "b1",
          summary: "ok",
          measurementCount: 0,
          detectedMetrics: [],
        }),
      } as Response;
    });

    const file = new File(["dummy"], "scan.png", { type: "image/png" });
    await uploadLabExam(file, "thread-xyz", "en");

    const formData = capturedOptions?.body as FormData;
    expect(formData.get("language")).toBe("en");
  });

  it("defaults the language to es when omitted", async () => {
    let capturedOptions: RequestInit | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedOptions = options;
      return {
        ok: true,
        json: async () => ({
          batchId: "b1",
          summary: "ok",
          measurementCount: 0,
          detectedMetrics: [],
        }),
      } as Response;
    });

    const file = new File(["dummy"], "scan.png", { type: "image/png" });
    await uploadLabExam(file);

    const formData = capturedOptions?.body as FormData;
    expect(formData.get("language")).toBe("es");
  });
});

// ── Chat multimodal + consolidación de stream (agente-asistente-citas) ──────

/** Construye una Response SSE con ReadableStream (jsdom soporta ambos). */
function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers(),
  } as unknown as Response;
}

describe("opt-in aditivo de texto Vita", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { globalThis.fetch = originalFetch; });
  it.each(["sync", "stream"])("%s conserva el payload previo y añade supportsVita true", async mode => {
    globalThis.fetch = vi.fn().mockImplementation(async () => mode === "stream"
      ? sseResponse(['event: done\ndata: {"thread_id":"t-1","answer":"ok"}\n\n'])
      : { ok: true, json: async () => ({ reply: "ok", threadId: "t-1" }) });
    if (mode === "stream") await streamChatMessage("hola", "t-1", {}, undefined, "es");
    else await sendChatMessage("hola", "t-1", undefined, "es");
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
    const oldPayload = { message: "hola", threadId: "t-1", language: "es" };
    expect(payload).toEqual({ ...oldPayload, supportsVita: true });
    delete payload.supportsVita;
    expect(payload).toEqual(oldPayload); // Default false para clientes sin campo es contrato BACK/AI.
  });
});

describe("sendChatMessage — adjunto de imagen y sugerencias", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("envía imageData + imageMimeType en el body cuando hay imagen", async () => {
    let capturedBody = "";
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedBody = String(options?.body);
      return {
        ok: true,
        json: async () => ({
          reply: "Reviso tu foto",
          threadId: "t-1",
        }),
      } as Response;
    });

    await sendChatMessage("Mira esto", "t-1", {
      base64: "aGVsbG8=",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,aGVsbG8=",
    });

    const body = JSON.parse(capturedBody) as {
      message: string;
      threadId: string;
      imageData?: string;
      imageMimeType?: string;
    };
    expect(body.message).toBe("Mira esto");
    expect(body.threadId).toBe("t-1");
    expect(body.imageData).toBe("aGVsbG8=");
    expect(body.imageMimeType).toBe("image/jpeg");
  });

  it("sin imagen no incluye campos de imagen en el body", async () => {
    let capturedBody = "";
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedBody = String(options?.body);
      return {
        ok: true,
        json: async () => ({ reply: "ok", threadId: "t-1" }),
      } as Response;
    });

    await sendChatMessage("hola", "t-1");
    const body = JSON.parse(capturedBody) as Record<string, unknown>;
    expect(body.imageData).toBeUndefined();
    expect(body.imageMimeType).toBeUndefined();
  });

  it("normaliza sugerencias snake_case (cta_text) a camelCase", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          reply: "Puedo agendar",
          threadId: "t-1",
          suggestions: [
            { type: "appointment", cta_text: "Agenda tu cita aquí" },
          ],
        }),
      } as Response;
    });

    const result = await sendChatMessage("dolor de cabeza", "t-1");
    expect(result.suggestions?.[0]?.ctaText).toBe("Agenda tu cita aquí");
    expect(result.suggestions?.[0]?.type).toBe("appointment");
  });

  it("descarta sugerencias malformadas en lugar de romper", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          reply: "ok",
          threadId: "t-1",
          suggestions: [null, "no-objeto", { type: "appointment" }],
        }),
      } as Response;
    });

    const result = await sendChatMessage("hola", "t-1");
    expect(result.suggestions).toEqual([]);
  });
});

describe("streamChatMessage — consolidación del turno (done + answer + sugerencias)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("acumula tokens y captura la respuesta canónica del done con sugerencias", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse([
          'event: message\ndata: {"type":"token","content":"Preliminar "}\n\n',
          'event: node\ndata: {"type":"node","node":"tools"}\n\n',
          'event: message\ndata: {"type":"token","content":"preliminar"}\n\n',
          'event: done\ndata: {"thread_id":"t-9","execution_id":"e-1","answer":"Respuesta final del modelo","suggestions":[{"type":"appointment","cta_text":"Agenda tu cita aquí"}]}\n\n',
        ]),
      );

    const tokens: string[] = [];
    const result = await streamChatMessage("hola", "t-1", {
      onToken: (piece) => tokens.push(piece),
    });

    expect(tokens.join("")).toBe("Preliminar preliminar");
    expect(result.answer).toBe("Respuesta final del modelo");
    // La respuesta expuesta al turno es SIEMPRE la canónica del done.
    expect(result.reply).toBe("Respuesta final del modelo");
    expect(result.threadId).toBe("t-9");
    expect(result.executionId).toBe("e-1");
    expect(result.suggestions?.[0]?.ctaText).toBe("Agenda tu cita aquí");
  });

  it("sin done con answer, la respuesta es el texto acumulado (compatibilidad)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse([
          'event: message\ndata: {"type":"token","content":"Hola "}\n\n',
          'event: message\ndata: {"type":"token","content":"María"}\n\n',
          'event: done\ndata: {"thread_id":"t-9"}\n\n',
        ]),
      );

    const result = await streamChatMessage("hola", "t-1");
    expect(result.reply).toBe("Hola María");
    expect(result.answer ?? null).toBeNull();
    expect(result.suggestions ?? null).toBeNull();
  });

  it("envía la imagen adjunta también por el canal streaming", async () => {
    let capturedBody = "";
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedBody = String(options?.body);
      return sseResponse([
        'event: done\ndata: {"thread_id":"t-1","answer":"Veo la lesión"}\n\n',
      ]);
    });

    const result = await streamChatMessage(
      "qué ves",
      "t-1",
      {},
      {
        base64: "aG9sYQ==",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,aG9sYQ==",
      },
    );

    const body = JSON.parse(capturedBody) as { imageMimeType?: string };
    expect(body.imageMimeType).toBe("image/png");
    expect(result.reply).toBe("Veo la lesión");
  });

  it("propaga el error del stream cuando el agente falla", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse([
          'event: error\ndata: {"type":"error","error":"boom"}\n\n',
        ]),
      );

    await expect(streamChatMessage("hola", "t-1")).rejects.toThrow("El asistente no pudo completar la respuesta.");
  });

  it("falla con mensaje claro cuando el stream no trae respuesta", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse(["event: start\ndata: {}\n\n"]),
      );

    await expect(streamChatMessage("hola", "t-1")).rejects.toThrow(
      "La respuesta se interrumpió.",
    );
  });
});

describe("SSE Vita: límites de transporte", () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
  const response = (text: string) => new Response(new ReadableStream({ start(controller) {
    // Un byte por chunk incluye acentos y emoji partidos en UTF-8.
    for (const byte of new TextEncoder().encode(text)) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }), { headers: { "Content-Type": "text/event-stream" } });

  it("acepta CRLF, data multilínea y done sin type con metadatos canónicos", async () => {
    const onToken = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(': ping\r\nevent: message\r\ndata:{"type":"token",\r\ndata: "content":"Sí 🩺"}\r\n\r\nevent: done\r\ndata: {"answer":"Respuesta final", "thread_id":"thread", "execution_id":"exec"}\r\n\r\n')));
    const result = await streamChatMessage("hola", "thread", { onToken });
    expect(onToken).toHaveBeenCalledWith("Sí 🩺");
    expect(result).toMatchObject({ reply: "Respuesta final", threadId: "thread", executionId: "exec" });
  });

  it("un error nombrado sin type rechaza incluso si después llega done", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response('event:error\ndata:{"error":"internal detail"}\n\nevent:done\ndata:{"answer":"no"}\n\n')));
    await expect(streamChatMessage("hola", "thread")).rejects.toThrow("El asistente no pudo completar");
  });

  it("no acepta tokens truncados como respuesta definitiva", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response('event:message\ndata:{"type":"token","content":"parcial"}\n\n')));
    await expect(streamChatMessage("hola", "thread")).rejects.toThrow("La respuesta se interrumpió");
  });

  it("cancelar libera el reader y no reenvía la solicitud", async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel })));
    vi.stubGlobal("fetch", fetchMock);
    const pending = streamChatMessage("hola", "thread", {}, undefined, "es", controller.signal);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

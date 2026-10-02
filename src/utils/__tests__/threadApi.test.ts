import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  uploadLabExam,
  sendChatMessage,
  streamChatMessage,
  type LabExamUploadResult,
} from "../threadApi";

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

    await expect(streamChatMessage("hola", "t-1")).rejects.toThrow("boom");
  });

  it("falla con mensaje claro cuando el stream no trae respuesta", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse(["event: start\ndata: {}\n\n"]),
      );

    await expect(streamChatMessage("hola", "t-1")).rejects.toThrow(
      "El agente no respondió.",
    );
  });
});

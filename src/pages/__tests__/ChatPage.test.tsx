import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ChatMessage } from "../../types";
import { mergeChatHistory } from "../../utils/chatHistory";
import { ChatPage } from "../ChatPage";
import { fetchThreadState, uploadLabExam } from "../../utils/threadApi";
import { captureChatImage } from "../../services/media/camera-service";
import { sendChatFeedback } from "../../services/chat/chat-service";
import { deleteVitaAttachment, uploadVitaAttachment, VITA_FILE_ACCEPT } from "../../services/chat/vita-attachments-service";
import { ApiError } from "../../utils/apiClient";

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  uploadLabExam: vi.fn(),
}));

vi.mock("../../services/media/camera-service", async original => ({
  ...await original<object>(),
  captureChatImage: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../services/chat/vita-attachments-service", async original => ({
  ...await original<object>(),
  uploadVitaAttachment: vi.fn(),
  deleteVitaAttachment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/chat/chat-service", () => ({
  sendChatFeedback: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Scroll: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Composer redesign (integración ElevenLabs): el adjuntar unificado usa
// IonActionSheet, cuyo overlay real vive en shadow DOM (inaccesible en
// jsdom). Este mock parcial renderiza sus botones en light DOM para poder
// probar el flujo Tomar foto / Archivo. Todo lo demás de @ionic/react queda
// intacto (IonButton, IonModal, IonIcon, ...).
vi.mock("@ionic/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@ionic/react")>();
  const IonActionSheetMock = ({
    isOpen,
    buttons,
  }: {
    isOpen?: boolean;
    buttons?: Array<{ text: string; handler?: () => void; role?: string }>;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="attach-sheet">
        {buttons
          ?.filter((b) => b.role !== "cancel")
          .map((b) => (
            <button key={b.text} onClick={b.handler}>
              {b.text}
            </button>
          ))}
      </div>
    );
  };
  return { ...mod, IonActionSheet: IonActionSheetMock };
});

// Estado mutable compartido con el mock de AppContext (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  lang: "en" as "es" | "en",
  historyRevision: 0,
  userId: "user-1",
  threadId: "test-thread-123",
  voiceOpen: false,
  chat: [] as ChatMessage[],
}));

const sendChatMock = vi.fn();
const openPanicMock = vi.fn();
const openVoiceMock = vi.fn();
const hydrateChatMock = vi.fn();
const prependChatMessagesMock = vi.fn();
const openBookingWizardMock = vi.fn();
const appendChatMessagesMock = vi.fn();
const showToastMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    chat: mockState.chat,
    chatHistoryRevision: mockState.historyRevision,
    sendChat: sendChatMock,
    openPanic: openPanicMock,
    openVoice: openVoiceMock,
    threadId: mockState.threadId,
    user: { id: mockState.userId, nombre: "María" },
    voiceOpen: mockState.voiceOpen,
    hydrateChat: hydrateChatMock,
    prependChatMessages: prependChatMessagesMock,
    openBookingWizard: openBookingWizardMock,
    appendChatMessages: appendChatMessagesMock,
    showToast: showToastMock,
    navigate: navigateMock,
  }),
}));

vi.mock("../../i18n/I18nContext", async () => {
  const { default: english } = await import("../../i18n/en.json");
  const t = (key: string, params?: Record<string, string>) => {
    const value = mockState.lang === "en" ? (english as Record<string, string>)[key] ?? key : key;
    return value.replace(/\{(\w+)\}/g, (token, name) => params?.[name] ?? token);
  };
  return { useT: () => t, useI18n: () => ({ t, lang: mockState.lang }) };
});

const welcomeMessage = {
  id: "msg-1",
  role: "bot" as const,
  text: "Hola María 👋 Soy tu agente de salud Copp Adresd.",
  time: "10:00 AM",
};

beforeEach(() => {
  mockState.userId = "user-1"; mockState.threadId = "test-thread-123";
  mockState.voiceOpen = false; mockState.historyRevision = 0;
  vi.mocked(fetchThreadState).mockReset().mockResolvedValue(null);
  hydrateChatMock.mockReset();
});

describe("ChatPage — sincronización acotada del proveedor", () => {
  const empty = { threadId: "test-thread-123", messageCount: 0, lastMessage: null, messages: [] };
  beforeEach(() => { vi.useFakeTimers(); mockState.lang = "es"; mockState.chat = []; });
  afterEach(() => { vi.useRealTimers(); });
  const advance = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

  it("processing→busy→synchronized conserva el SDK hasta snapshot, IDs/metadatos y scroll", async () => {
    mockState.chat = [2, 14].map(id => ({ id: `sdk:${id}`, role: "bot", text: "Sí", time: "", threadId: "test-thread-123",
      channel: "voice", voiceSessionId: "linked", voiceRuntime: "legacy", voiceSessionClosed: true }));
    const canonical = [2, 14].map(id => ({ messageId: `voice:linked:provider:${id}`, role: "bot", text: "Sí", channel: "voice" as const,
      status: "provider_final" as const, revision: 1, source: "elevenlabs_transcript", voiceSessionId: "linked", providerMessageId: null, sourceEventId: id }));
    hydrateChatMock.mockImplementation(history => { mockState.chat = mergeChatHistory(mockState.chat, history, mockState.threadId); });
    vi.mocked(fetchThreadState).mockResolvedValueOnce({ ...empty, voiceSyncStatus: "processing" })
      .mockResolvedValueOnce({ ...empty, voiceSyncStatus: "busy" })
      .mockResolvedValueOnce({ ...empty, messageCount: 2, messages: canonical, voiceSyncStatus: "synchronized" });
    const { container, rerender } = render(<ChatPage />);
    const list = container.querySelector(".chat-list") as HTMLDivElement;
    Object.defineProperties(list, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 400 } });
    list.scrollTop = 180; fireEvent.scroll(list);
    const scrollToEnd = vi.spyOn(Element.prototype, "scrollIntoView"); scrollToEnd.mockClear();
    await advance(); expect(mockState.chat.map(m => m.id)).toEqual(["sdk:2", "sdk:14"]);
    await advance(1000); expect(mockState.chat).toHaveLength(2);
    await advance(2000); rerender(<ChatPage />);
    expect(mockState.chat).toEqual(expect.arrayContaining(canonical.map(message => expect.objectContaining(message))));
    expect(mockState.chat).toHaveLength(2); expect(list.scrollTop).toBe(180);
    expect(scrollToEnd).not.toHaveBeenCalled();
    await advance(15_000); expect(fetchThreadState).toHaveBeenCalledTimes(3);
    expect(fetchThreadState).toHaveBeenCalledWith("test-thread-123", "user-1", expect.objectContaining({ syncVoice: true, signal: expect.any(AbortSignal) }));
    scrollToEnd.mockRestore();
  });

  it.each(["processing", "busy"] as const)("%s permanente agota solo 1/2/4 segundos y no afirma persistencia", async voiceSyncStatus => {
    mockState.chat = [{ id: "sdk", role: "bot", text: "Provisional", time: "" }];
    vi.mocked(fetchThreadState).mockResolvedValue({ ...empty, voiceSyncStatus });
    render(<ChatPage />); await advance(20_000);
    expect(fetchThreadState).toHaveBeenCalledTimes(4); expect(hydrateChatMock).not.toHaveBeenCalled();
    expect(mockState.chat[0].id).toBe("sdk");
  });

  it.each(["unavailable", null, undefined] as const)("estado %s o legacy sin metadatos no inicia polling", async voiceSyncStatus => {
    mockState.chat = [{ id: "sdk-legacy", role: "bot", text: "Solo RAM", time: "" }];
    vi.mocked(fetchThreadState).mockResolvedValue({ ...empty, voiceSyncStatus });
    render(<ChatPage />); await advance(20_000);
    expect(fetchThreadState).toHaveBeenCalledTimes(1); expect(hydrateChatMock).not.toHaveBeenCalled();
    expect(mockState.chat[0].id).toBe("sdk-legacy");
  });

  it.each(["cuenta", "hilo"])("cambio de %s cancela timer y respuesta vieja sin hidratar otra sesión", async change => {
    let resolve!: (state: typeof empty) => void;
    vi.mocked(fetchThreadState).mockResolvedValueOnce({ ...empty, voiceSyncStatus: "processing" })
      .mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { rerender, unmount } = render(<ChatPage />); await advance(1000);
    const oldSignal = vi.mocked(fetchThreadState).mock.calls[1][2]!.signal!;
    if (change === "cuenta") mockState.userId = "user-2"; else mockState.threadId = "other-thread";
    rerender(<ChatPage />); await advance(); expect(oldSignal.aborted).toBe(true);
    await act(async () => { resolve({ ...empty, messages: [{ role: "bot", text: "Privado" }] } as typeof empty); });
    expect(hydrateChatMock).not.toHaveBeenCalled();
    await advance(20_000); expect(fetchThreadState).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("desmontar cancela el timer; volver a abrir pide sync aunque no haya metadatos locales", async () => {
    vi.mocked(fetchThreadState).mockResolvedValue({ ...empty, voiceSyncStatus: "processing" });
    const first = render(<ChatPage />); await advance();
    const signal = vi.mocked(fetchThreadState).mock.calls[0][2]!.signal!;
    first.unmount(); await advance(15_000);
    expect(signal.aborted).toBe(true); expect(fetchThreadState).toHaveBeenCalledTimes(1);
    render(<ChatPage />); await advance(); expect(fetchThreadState).toHaveBeenCalledTimes(2);
  });
});

describe("ChatPage — recarga tras cierre de sesión vinculada", () => {
  it("un refresco posterior al DELETE vuelve a leer incluso después de un snapshot vacío", async () => {
    vi.clearAllMocks(); mockState.chat = []; mockState.historyRevision = 0; mockState.lang = "es";
    const canonical = [
      { messageId: "voice:linked-legacy:provider:user:2", role: "user", text: "Sí", channel: "voice" as const, status: "final" as const, revision: 1 },
      { messageId: "voice:linked-legacy:provider:bot:2", role: "bot", text: "Sí", channel: "voice" as const, status: "final" as const, revision: 1 },
    ];
    vi.mocked(fetchThreadState).mockReset().mockResolvedValue(null)
      .mockResolvedValueOnce({ threadId: "test-thread-123", messageCount: 0, lastMessage: null, messages: [] })
      .mockResolvedValueOnce({ threadId: "test-thread-123", messageCount: 2, lastMessage: "Sí", messages: canonical });
    const { rerender } = render(<ChatPage />);
    await waitFor(() => expect(fetchThreadState).toHaveBeenCalledTimes(1));
    mockState.historyRevision = 1; rerender(<ChatPage />);
    await waitFor(() => expect(hydrateChatMock).toHaveBeenCalledWith(canonical));
    expect(fetchThreadState).toHaveBeenCalledTimes(2);
    mockState.historyRevision = 0;
  });
});

describe("ChatPage — Lab Exam Upload Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lang = "es";
    mockState.chat = [welcomeMessage];
  });

  it("renders attachment button and hidden file input with accepted types", () => {
    const { container } = render(<ChatPage />);

    // Composer redesign: el adjuntar unificado es el botón [+] del composer
    // (ActionSheet con foto/galería/archivo). El input oculto del examen de
    // laboratorio se conserva con sus tipos y límites.
    const attachButton = screen.getByLabelText("Adjuntar al chat");
    expect(attachButton).toBeTruthy();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe(VITA_FILE_ACCEPT);
    expect(fileInput.style.display).toBe("none");
  });

  it("rejects file larger than 20 MB with a toast warning", async () => {
    const { container } = render(<ChatPage />);
    const fileInput = container.querySelector(
      'input[aria-label="Examen de laboratorio"]',
    ) as HTMLInputElement;

    const oversizedFile = new File(["dummy"], "large_scan.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(oversizedFile, "size", {
      value: 21 * 1024 * 1024,
    });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(showToastMock).toHaveBeenCalledWith(
      "El archivo excede el límite de 20 MB.",
      "err",
    );
    expect(appendChatMessagesMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported file format with a toast warning", async () => {
    const { container } = render(<ChatPage />);
    const fileInput = container.querySelector(
      'input[aria-label="Examen de laboratorio"]',
    ) as HTMLInputElement;

    const unsupportedFile = new File(["dummy"], "results.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    fireEvent.change(fileInput, { target: { files: [unsupportedFile] } });

    expect(showToastMock).toHaveBeenCalledWith(
      "Tipo de archivo no permitido. Solo se aceptan JPEG, PNG o PDF.",
      "err",
    );
    expect(appendChatMessagesMock).not.toHaveBeenCalled();
  });

  it("envía el idioma y no presenta la interpretación de un servidor antiguo como validada", async () => {
    mockState.lang = "en";
    vi.mocked(uploadLabExam).mockResolvedValueOnce({
      batchId: "batch-123",
      summary: "Se detectó glucosa en ayunas (95 mg/dL).",
      measurementCount: 1,
      detectedMetrics: ["glucose_fasting"],
    });

    const { container } = render(<ChatPage />);
    const fileInput = container.querySelector(
      'input[aria-label="Lab test"]',
    ) as HTMLInputElement;

    const validFile = new File(["sample content"], "exam_results.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(uploadLabExam).toHaveBeenCalledWith(
        validFile,
        "test-thread-123",
        "en",
      );
    });

    expect(appendChatMessagesMock).toHaveBeenCalledWith([
      {
        role: "user",
        text: "📄 exam_results.pdf",
      },
      {
        role: "bot",
        text: "Document received. Check the original file with your care team to verify its values.",
        kind: "lab-exam",
      },
    ]);
  });

  it("muestra la verificación pendiente sin confundir candidatos OCR con mediciones guardadas", async () => {
    vi.mocked(uploadLabExam).mockResolvedValueOnce({
      batchId: "batch-pending", summary: "No usar como juicio clínico", measurementCount: 0,
      detectedMetrics: ["glucose_fasting"], verificationStatus: "pending_review", documentId: "doc-1",
      extractedMetrics: [{ metricName: "Glucosa", metricCode: "glucose_fasting", value: 95, source: "ocr_unverified" }],
    });
    const { container } = render(<ChatPage />);
    fireEvent.change(container.querySelector('input[aria-label="Examen de laboratorio"]')!, { target: { files: [new File(["result"], "exam.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(appendChatMessagesMock).toHaveBeenCalledWith([
      { role: "user", text: "📄 exam.pdf" },
      { role: "bot", text: "Documento guardado. Los valores detectados están pendientes de verificación y no se han añadido a tus mediciones. Tu equipo puede revisar el archivo original.", kind: "lab-exam-pending" },
    ]));
  });

  it("shows error toast when upload fails", async () => {
    vi.mocked(uploadLabExam).mockRejectedValueOnce(
      new Error("El servicio de IA no pudo procesar el examen de laboratorio."),
    );

    const { container } = render(<ChatPage />);
    const fileInput = container.querySelector(
      'input[aria-label="Examen de laboratorio"]',
    ) as HTMLInputElement;

    const validFile = new File(["sample content"], "exam_results.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        "El servicio de IA no pudo procesar el examen de laboratorio.",
        "err",
      );
    });

    expect(appendChatMessagesMock).not.toHaveBeenCalled();
  });

  it("translates a known Spanish lab upload error in English", async () => {
    mockState.lang = "en";
    vi.mocked(uploadLabExam).mockRejectedValueOnce(new Error("El servicio de IA no pudo procesar el examen de laboratorio."));
    const { container } = render(<ChatPage />);
    fireEvent.change(container.querySelector('input[aria-label="Lab test"]')!, { target: { files: [new File(["result"], "exam.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith("The AI service could not process the lab test.", "err"));
  });

  it("identifica los adjuntos históricos como recibidos sin afirmar verificación clínica", () => {
    mockState.chat = [
      {
        id: "msg-lab",
        role: "bot",
        text: "**¡Hola!** Recibí tu examen de laboratorio.",
        time: "10:05 AM",
        kind: "lab-exam",
      },
    ];

    render(<ChatPage />);

    expect(screen.getByText("Documento recibido")).toBeTruthy();
    expect(screen.queryByText("Examen procesado")).toBeNull();
    expect(screen.getByLabelText("Ver mi historia")).toBeTruthy();
  });

  it("navigates to the metrics history screen (hc) when tapping view all metrics", () => {
    mockState.chat = [
      {
        id: "msg-lab",
        role: "bot",
        text: "Recibí tu examen de laboratorio.",
        time: "10:05 AM",
        kind: "lab-exam",
      },
    ];

    render(<ChatPage />);
    fireEvent.click(screen.getByLabelText("Ver mi historia"));

    expect(navigateMock).toHaveBeenCalledWith("hc");
  });

  it("does not render the badge or the metrics button on regular messages", () => {
    render(<ChatPage />);

    expect(screen.queryByText("Examen procesado")).toBeNull();
    expect(screen.queryByLabelText("Ver mi historia")).toBeNull();
  });

  it("identifica el documento pendiente en inglés y mantiene acceso a la historia", () => {
    mockState.lang = "en";
    mockState.chat = [{ id: "pending", role: "bot", text: "Document saved.", time: "10:05 AM", kind: "lab-exam-pending" }];
    render(<ChatPage />);
    expect(screen.getByText("Pending verification")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("View my history"));
    expect(navigateMock).toHaveBeenCalledWith("hc");
  });
});

const vitaUpload = {
  attachmentId: "vita-1",
  kind: "image" as const,
  contentType: "image/jpeg",
  sizeBytes: 6,
  pageCount: null,
  expiresAt: "2099-02-01T00:00:00Z",
};

describe("ChatPage — CTA y adjuntos efímeros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lang = "es";
    mockState.chat = [welcomeMessage];
    vi.mocked(captureChatImage).mockResolvedValue(null);
  });

  it("renderiza el botón CTA del bot con ctaText y abre el wizard al pulsarlo", () => {
    mockState.chat = [
      ...mockState.chat,
      {
        id: "msg-cta",
        role: "bot",
        text: "Te recomiendo una consulta.",
        time: "10:05 AM",
        cta: { type: "appointment", ctaText: "Agenda tu cita aquí" },
      },
    ];

    render(<ChatPage />);

    const ctaButton = screen.getByLabelText("Agenda tu cita aquí");
    expect(ctaButton).toBeTruthy();
    fireEvent.click(ctaButton);
    expect(openBookingWizardMock).toHaveBeenCalledTimes(1);
  });

  it("mensajes sin cta no renderizan el botón de agendamiento", () => {
    render(<ChatPage />);
    expect(screen.queryByLabelText("Agenda tu cita aquí")).toBeNull();
  });

  it("sube una foto de la cámara, muestra el chip y envía sus metadatos", async () => {
    vi.mocked(uploadVitaAttachment).mockResolvedValueOnce(vitaUpload);
    vi.mocked(captureChatImage).mockResolvedValueOnce({
      base64: "aW1hZ2Vu",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,aW1hZ2Vu",
    });

    render(<ChatPage />);

    // [+] → ActionSheet → Tomar foto (flujo real del composer rediseñado).
    fireEvent.click(screen.getByLabelText("Adjuntar al chat"));
    fireEvent.click(await screen.findByText("Tomar foto"));
    await screen.findByText("Foto adjunta.jpg");
    expect(uploadVitaAttachment).toHaveBeenCalledWith(expect.any(File), "test-thread-123", "es", expect.any(AbortSignal));
    expect(uploadLabExam).not.toHaveBeenCalled();

    // El envío (quick chip → send con imagen pendiente) incluye el adjunto.
    fireEvent.click(screen.getByText("Hábitos"));
    await waitFor(() => {
      expect(sendChatMock).toHaveBeenCalledWith(
        "¿Cómo puedo organizar mis hábitos diarios?",
        undefined,
        [{ ...vitaUpload, name: "Foto adjunta.jpg" }],
      );
    });
    // El adjunto se consumió al enviar.
    expect(screen.queryByText("Foto adjunta.jpg")).toBeNull();
    expect(deleteVitaAttachment).not.toHaveBeenCalled();
  });

  it("quita el adjunto en el servidor antes de enviar solo texto", async () => {
    vi.mocked(uploadVitaAttachment).mockResolvedValueOnce({ ...vitaUpload, kind: "pdf", contentType: "application/pdf" });
    render(<ChatPage />);
    const file = new File(["fixture"], "fixture.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Archivo para el chat"), { target: { files: [file] } });
    fireEvent.click(await screen.findByLabelText("Quitar adjunto: fixture.pdf"));
    await waitFor(() => {
      expect(screen.queryByText("fixture.pdf")).toBeNull();
    });
    expect(deleteVitaAttachment).toHaveBeenCalledWith("vita-1");

    // Sin imagen pendiente el envío va solo con texto (second arg undefined).
    fireEvent.click(screen.getByText("Progreso"));
    await waitFor(() => {
      expect(sendChatMock).toHaveBeenCalledWith(
        "¿Cómo va mi progreso esta semana?",
        undefined,
      );
    });
  });

  it("anuncia el fallo de carga en inglés y mantiene el archivo fuera del borrador", async () => {
    mockState.lang = "en";
    vi.mocked(uploadVitaAttachment).mockRejectedValueOnce(new ApiError({ status: 415, message: "attachment_type_not_allowed" }));
    render(<ChatPage />);
    fireEvent.change(screen.getByLabelText("File for chat"), {
      target: { files: [new File(["fixture"], "bad.pdf", { type: "application/pdf" })] },
    });
    const error = await screen.findByText("Unsupported file type. Please upload a JPEG, PNG, or PDF.");
    expect(error.getAttribute("aria-live")).toBe("assertive");
    expect(screen.queryByText("bad.pdf")).toBeNull();
  });

  it("puede cancelar una carga y elimina el archivo si el resultado llega tarde", async () => {
    let complete!: (result: typeof vitaUpload) => void;
    vi.mocked(uploadVitaAttachment).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    render(<ChatPage />);
    fireEvent.change(screen.getByLabelText("Archivo para el chat"), {
      target: { files: [new File(["fixture"], "pending.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.click(await screen.findByText("Cancelar carga"));
    expect(vi.mocked(uploadVitaAttachment).mock.calls[0][3]?.aborted).toBe(true);
    await act(async () => complete(vitaUpload));
    expect(deleteVitaAttachment).toHaveBeenCalledWith("vita-1", null);
    expect(screen.queryByText("pending.jpg")).toBeNull();
  });

  it("muestra la respuesta, el aviso de adjunto ilegible y la opción de archivo", () => {
    mockState.chat = [{
      id: "vite-reply", role: "bot", text: "No pude leer tu foto.", time: "",
      vitaAttachments: [{ ...vitaUpload, name: "scan.jpg", readable: false }],
    }];
    render(<ChatPage />);
    expect(screen.getByText("No pude leer tu foto.")).toBeTruthy();
    expect(screen.getByText("Vita no pudo leer el contenido de este adjunto.")).toBeTruthy();
    expect(screen.getByText("Guardar en mi expediente")).toBeTruthy();
  });

  it("muestra la imagen del remitente en la burbuja user", () => {
    mockState.chat = [
      {
        id: "msg-img",
        role: "user",
        text: "Mira esta erupción",
        time: "10:07 AM",
        image: { dataUrl: "data:image/jpeg;base64,aG9sYQ==" },
      },
    ];

    const { container } = render(<ChatPage />);
    const bubble = container.querySelector<HTMLImageElement>(
      'img[alt="Imagen adjunta"]',
    );
    expect(bubble?.src).toContain("data:image/jpeg;base64,aG9sYQ==");
  });
});

describe("ChatPage — hidratación del mensaje proactivo (StrictMode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lang = "es";
    mockState.chat = [welcomeMessage];
  });

  it("hidrata el último mensaje del thread aunque el efecto corra dos veces (StrictMode)", async () => {
    const proactiveText =
      "¡Llegaste al día 21! Contanos cómo te sentís con el plan.";
    vi.mocked(fetchThreadState).mockResolvedValue({
      threadId: "test-thread-123",
      messageCount: 84,
      lastMessage: proactiveText,
    });

    render(
      <StrictMode>
        <ChatPage />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(hydrateChatMock).toHaveBeenCalledWith([
        { text: proactiveText, role: "bot" },
      ]);
    });
  });
});

describe("ChatPage — historial completo del thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lang = "es";
    mockState.chat = [welcomeMessage];
  });

  it("hidrata la conversación completa en orden con sus roles", async () => {
    vi.mocked(fetchThreadState).mockResolvedValue({
      threadId: "test-thread-123",
      messageCount: 4,
      lastMessage: "¿Te sentís mejor?",
      messages: [
        { role: "user", text: "Hola, me sentí bien esta semana" },
        { role: "bot", text: "¡Qué bueno escucharlo!" },
        { role: "user", text: "Gracias" },
        { role: "bot", text: "¿Te sentís mejor?" },
      ],
    });

    render(<ChatPage />);

    await waitFor(() => {
      expect(hydrateChatMock).toHaveBeenCalledWith([
        { role: "user", text: "Hola, me sentí bien esta semana" },
        { role: "bot", text: "¡Qué bueno escucharlo!" },
        { role: "user", text: "Gracias" },
        { role: "bot", text: "¿Te sentís mejor?" },
      ]);
    });
  });

  it("cae al lastMessage cuando el backend no expone messages (compat)", async () => {
    vi.mocked(fetchThreadState).mockResolvedValue({
      threadId: "test-thread-123",
      messageCount: 90,
      lastMessage: "Mensaje suelto",
      messages: null,
    });

    render(<ChatPage />);

    await waitFor(() => {
      expect(hydrateChatMock).toHaveBeenCalledWith([
        { text: "Mensaje suelto", role: "bot" },
      ]);
    });
  });

  it("descarta entradas sin texto y cae al lastMessage si quedan vacías", async () => {
    vi.mocked(fetchThreadState).mockResolvedValue({
      threadId: "test-thread-123",
      messageCount: 3,
      lastMessage: "Último real",
      messages: [
        { role: "user", text: "   " },
        { role: "bot", text: "" },
      ],
    });

    render(<ChatPage />);

    await waitFor(() => {
      expect(hydrateChatMock).toHaveBeenCalledWith([
        { text: "Último real", role: "bot" },
      ]);
    });
  });
});

describe("ChatPage — disclaimer clínico y feedback (Fase 9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lang = "es";
    mockState.chat = [welcomeMessage];
  });

  it("explica el alcance educativo y el apoyo al plan publicado", () => {
    render(<ChatPage />);

    expect(
      screen.getByText(
        "Vita te orienta sobre hábitos y te ayuda a seguir tu plan publicado. No cambia las indicaciones de tu equipo de salud.",
      ),
    ).toBeTruthy();
  });

  it("monta el feedback en respuestas del bot con executionId y lo envía al calificar", async () => {
    mockState.chat = [
      {
        id: "msg-bot-1",
        role: "bot",
        text: "Tu plan es dieta mediterránea.",
        time: "10:05 AM",
        threadId: "thread-1",
        executionId: "exec-1",
      },
    ];

    render(<ChatPage />);

    expect(screen.getByLabelText("Calificar respuesta como útil")).toBeTruthy();
    expect(screen.getByText("¿Te resultó útil esta respuesta?")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Calificar respuesta como útil"));

    await waitFor(() => {
      expect(sendChatFeedback).toHaveBeenCalledWith({
        executionId: "exec-1",
        threadId: "thread-1",
        rating: 5,
      });
    });
    expect(screen.getByText("¡Gracias por tu calificación!")).toBeTruthy();
  });

  it("no monta el feedback en respuestas sin executionId (fallbacks locales)", () => {
    render(<ChatPage />);

    expect(screen.queryByLabelText("Calificar respuesta como útil")).toBeNull();
    expect(
      screen.queryByLabelText("Calificar respuesta como no útil"),
    ).toBeNull();
  });

  it("la alerta crítica sugiere activar el protocolo de emergencia vía openPanic", () => {
    mockState.chat = [
      {
        id: "msg-alert-1",
        role: "alert",
        text: "Detecté un posible síntoma de alarma.",
        time: "10:06 AM",
      },
    ];

    render(<ChatPage />);

    const panicCta = screen.getByLabelText("Activar protocolo de emergencia");
    expect(panicCta).toBeTruthy();
    fireEvent.click(panicCta);
    expect(openPanicMock).toHaveBeenCalled();
  });
});

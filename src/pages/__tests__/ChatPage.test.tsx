import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPage } from "../ChatPage";
import { fetchThreadState, uploadLabExam } from "../../utils/threadApi";
import { captureChatImage } from "../../services/media/camera-service";
import { sendChatFeedback } from "../../services/chat/chat-service";

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  uploadLabExam: vi.fn(),
}));

vi.mock("../../services/media/camera-service", () => ({
  captureChatImage: vi.fn().mockResolvedValue(null),
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
  chat: [] as Array<{
    id: string;
    role: "bot" | "user" | "alert";
    text: string;
    time: string;
    threadId?: string;
    kind?: "lab-exam";
    executionId?: string;
    cta?: { type: string; ctaText: string } | null;
    image?: { dataUrl: string } | null;
  }>,
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
    sendChat: sendChatMock,
    openPanic: openPanicMock,
    openVoice: openVoiceMock,
    threadId: "test-thread-123",
    user: { id: "user-1", nombre: "María" },
    hydrateChat: hydrateChatMock,
    prependChatMessages: prependChatMessagesMock,
    openBookingWizard: openBookingWizardMock,
    appendChatMessages: appendChatMessagesMock,
    showToast: showToastMock,
    navigate: navigateMock,
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ t: (key: string) => key, lang: mockState.lang }),
}));

const welcomeMessage = {
  id: "msg-1",
  role: "bot" as const,
  text: "Hola María 👋 Soy tu agente de salud Copp Adresd.",
  time: "10:00 AM",
};

describe("ChatPage — Lab Exam Upload Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lang = "en";
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
    expect(fileInput.accept).toBe("image/jpeg,image/png,application/pdf");
    expect(fileInput.style.display).toBe("none");
  });

  it("rejects file larger than 20 MB with a toast warning", async () => {
    const { container } = render(<ChatPage />);
    const fileInput = container.querySelector(
      'input[type="file"]',
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
      'input[type="file"]',
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

  it("uploads valid file, sends the UI language, and tags the bot bubble as lab-exam", async () => {
    vi.mocked(uploadLabExam).mockResolvedValueOnce({
      batchId: "batch-123",
      summary: "Se detectó glucosa en ayunas (95 mg/dL).",
      measurementCount: 1,
      detectedMetrics: ["glucose_fasting"],
    });

    const { container } = render(<ChatPage />);
    const fileInput = container.querySelector(
      'input[type="file"]',
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
        text: "Se detectó glucosa en ayunas (95 mg/dL).",
        kind: "lab-exam",
      },
    ]);
  });

  it("shows error toast when upload fails", async () => {
    vi.mocked(uploadLabExam).mockRejectedValueOnce(
      new Error("El servicio de IA no pudo procesar el examen de laboratorio."),
    );

    const { container } = render(<ChatPage />);
    const fileInput = container.querySelector(
      'input[type="file"]',
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

  it("renders the exam-processed badge and the metrics button on lab-exam messages", () => {
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

    expect(screen.getByText("Examen procesado")).toBeTruthy();
    expect(screen.getByLabelText("Ver todas las métricas")).toBeTruthy();
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
    fireEvent.click(screen.getByLabelText("Ver todas las métricas"));

    expect(navigateMock).toHaveBeenCalledWith("hc");
  });

  it("does not render the badge or the metrics button on regular messages", () => {
    render(<ChatPage />);

    expect(screen.queryByText("Examen procesado")).toBeNull();
    expect(screen.queryByLabelText("Ver todas las métricas")).toBeNull();
  });
});

describe("ChatPage — CTA de agendamiento y imagen conversacional (REQ-AG-02/03)", () => {
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

  it("captura imagen con cámara: miniatura en el compositor y envío con adjunto", async () => {
    vi.mocked(captureChatImage).mockResolvedValueOnce({
      base64: "aW1hZ2Vu",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,aW1hZ2Vu",
    });

    const { container } = render(<ChatPage />);

    // [+] → ActionSheet → Tomar foto (flujo real del composer rediseñado).
    fireEvent.click(screen.getByLabelText("Adjuntar al chat"));
    fireEvent.click(await screen.findByText("Tomar foto"));
    await waitFor(() => {
      expect(screen.getByLabelText("Imagen lista para enviar")).toBeTruthy();
    });
    // La miniatura previsualiza la imagen pendiente.
    const thumb = container.querySelector<HTMLImageElement>(
      'img[alt="Imagen adjunta"]',
    );
    expect(thumb?.src).toContain("data:image/jpeg;base64,aW1hZ2Vu");

    // El envío (quick chip → send con imagen pendiente) incluye el adjunto.
    fireEvent.click(screen.getByText("Síntomas"));
    await waitFor(() => {
      expect(sendChatMock).toHaveBeenCalledWith(
        "Tengo dolor en el pecho, ¿qué hago?",
        {
          base64: "aW1hZ2Vu",
          mimeType: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,aW1hZ2Vu",
        },
      );
    });
    // El adjunto se consumió al enviar.
    expect(screen.queryByLabelText("Imagen lista para enviar")).toBeNull();
  });

  it("descartar la imagen pendiente: el envío viaja solo con texto", async () => {
    vi.mocked(captureChatImage).mockResolvedValueOnce({
      base64: "aG9sYQ==",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,aG9sYQ==",
    });

    render(<ChatPage />);
    fireEvent.click(screen.getByLabelText("Adjuntar al chat"));
    fireEvent.click(await screen.findByText("Tomar foto"));
    await waitFor(() => {
      expect(screen.getByLabelText("Imagen lista para enviar")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Quitar imagen adjunta"));
    expect(screen.queryByLabelText("Imagen lista para enviar")).toBeNull();

    // Sin imagen pendiente el envío va solo con texto (second arg undefined).
    fireEvent.click(screen.getByText("Progreso"));
    await waitFor(() => {
      expect(sendChatMock).toHaveBeenCalledWith(
        "¿Cómo va mi progreso esta semana?",
        undefined,
      );
    });
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

  it("muestra el banner de disclaimer clínico al inicio del listado", () => {
    render(<ChatPage />);

    expect(
      screen.getByText(
        "Asistente clínico inteligente (no sustituye una consulta médica de urgencia)",
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

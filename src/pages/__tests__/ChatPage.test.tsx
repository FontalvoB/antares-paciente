import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPage } from "../ChatPage";
import { uploadLabExam } from "../../utils/threadApi";

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  uploadLabExam: vi.fn(),
}));

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const sendChatMock = vi.fn();
const openPanicMock = vi.fn();
const openVoiceMock = vi.fn();
const hydrateChatMock = vi.fn();
const openBookingWizardMock = vi.fn();
const appendChatMessagesMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    chat: [
      {
        id: "msg-1",
        role: "bot",
        text: "Hola María 👋 Soy tu agente de salud ANTARES.",
        time: "10:00 AM",
      },
    ],
    sendChat: sendChatMock,
    openPanic: openPanicMock,
    openVoice: openVoiceMock,
    threadId: "test-thread-123",
    user: { id: "user-1", nombre: "María" },
    hydrateChat: hydrateChatMock,
    openBookingWizard: openBookingWizardMock,
    appendChatMessages: appendChatMessagesMock,
    showToast: showToastMock,
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("ChatPage — Lab Exam Upload Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders attachment button and hidden file input with accepted types", () => {
    const { container } = render(<ChatPage />);

    const attachButton = screen.getByLabelText("Adjuntar examen");
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

  it("uploads valid file, calls uploadLabExam, and appends user and bot bubbles", async () => {
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
      expect(uploadLabExam).toHaveBeenCalledWith(validFile, "test-thread-123");
    });

    expect(appendChatMessagesMock).toHaveBeenCalledWith([
      {
        role: "user",
        text: "📄 exam_results.pdf",
      },
      {
        role: "bot",
        text: "Se detectó glucosa en ayunas (95 mg/dL).",
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
});

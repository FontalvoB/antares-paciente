import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n/I18nContext";
import { archiveVitaAttachment, getVitaDocumentTypes } from "../../../services/chat/vita-attachments-service";
import type { PendingVitaAttachment } from "../../../services/chat/vita-attachments-service";
import { ApiError } from "../../../utils/apiClient";
import { ArchiveVitaAttachmentModal } from "../ArchiveVitaAttachmentModal";

vi.mock("../../../services/chat/vita-attachments-service", () => ({
  archiveVitaAttachment: vi.fn(),
  getVitaDocumentTypes: vi.fn(),
}));

vi.mock("@ionic/react", () => {
  const contents = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    IonModal: contents, IonContent: contents, IonHeader: contents, IonNote: contents,
    IonTitle: contents, IonToolbar: contents, IonProgressBar: () => null,
    IonButton: ({ children, type, disabled, onClick }: React.ComponentProps<"button">) =>
      <button type={type ?? "button"} disabled={disabled} onClick={onClick}>{children}</button>,
    IonInput: ({ label, value }: { label: string; value: string }) => <input aria-label={label} value={value} readOnly />,
    IonSelect: ({ children, label, value, onIonChange }: React.PropsWithChildren<{
      label: string; value: string; onIonChange: (event: { detail: { value: string } }) => void;
    }>) => <select aria-label={label} value={value} onChange={event => onIonChange({ detail: { value: event.target.value } })}>
      <option value="" />{children}
    </select>,
    IonSelectOption: ({ children, value }: React.ComponentProps<"option">) => <option value={value}>{children}</option>,
  };
});

const attachment: PendingVitaAttachment = {
  attachmentId: "file-1", name: "hemograma.pdf", contentType: "application/pdf",
  kind: "pdf", sizeBytes: 8, pageCount: 1, expiresAt: "2099-01-01T00:00:00Z",
};
const type = { id: "lab-cbc", name: "Hemograma", code: "LAB_CBC", allowedExtensions: ["pdf"] };
const document = { documentId: "file-1", attachmentId: "file-1", title: "hemograma.pdf",
  documentTypeId: type.id, contentType: attachment.contentType, sizeBytes: 8 };

function open() {
  const onCancel = vi.fn();
  const onSaved = vi.fn();
  render(<I18nProvider><ArchiveVitaAttachmentModal attachment={attachment} onCancel={onCancel} onSaved={onSaved} /></I18nProvider>);
  return { onCancel, onSaved };
}

describe("confirmación de archivo de Vita", () => {
  it("cancelar no invoca el endpoint de archive", async () => {
    vi.mocked(getVitaDocumentTypes).mockResolvedValueOnce([type]);
    const { onCancel } = open();
    await screen.findByText("Hemograma");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(archiveVitaAttachment).not.toHaveBeenCalled();
  });

  it("confirma el tipo elegido y bloquea dos submits durante la misma petición", async () => {
    vi.mocked(getVitaDocumentTypes).mockResolvedValueOnce([type, { ...type, id: "other", name: "Otro documento" }]);
    let complete!: (result: typeof document) => void;
    vi.mocked(archiveVitaAttachment).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const { onSaved } = open();
    await screen.findByText("Hemograma");
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Confirmar guardado" });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Tipo de documento"), { target: { value: type.id } });
    fireEvent.submit(button.form!);
    fireEvent.submit(button.form!);
    expect(archiveVitaAttachment).toHaveBeenCalledExactlyOnceWith("file-1", "hemograma.pdf", type.id, "es", expect.any(AbortSignal));
    await act(async () => complete(document));
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(document);
  });

  it("anuncia la expiración y deja disponible el cierre", async () => {
    vi.mocked(getVitaDocumentTypes).mockResolvedValueOnce([type]);
    vi.mocked(archiveVitaAttachment).mockRejectedValueOnce(new ApiError({ status: 404, message: "vita_attachment_not_found" }));
    const { onCancel, onSaved } = open();
    await screen.findByText("Hemograma");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar guardado" }));
    await screen.findByText("El adjunto ya no está disponible. Vuelve a adjuntarlo en el chat.");
    await waitFor(() => expect(onSaved).not.toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

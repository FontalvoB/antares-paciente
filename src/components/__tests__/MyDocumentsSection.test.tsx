import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Browser } from "@capacitor/browser";
import { MyDocumentsSection } from "../MyDocumentsSection";
import { I18nProvider } from "../../i18n/I18nContext";
import { getMyDocumentUrl } from "../../services/documents/my-documents-service";
import type { PatientDocument } from "../../services/documents/my-documents-service";
const state = vi.hoisted(() => ({
  items: [] as PatientDocument[], loading: false, error: false, hasMore: false, fetchingMore: false,
  reload: vi.fn(), loadMore: vi.fn(),
}));
vi.mock("../../hooks/useMyDocuments", () => ({ useMyDocuments: () => state }));
vi.mock("../../services/documents/my-documents-service", () => ({ getMyDocumentUrl: vi.fn() }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: vi.fn().mockResolvedValue(undefined) } }));
const document = { id: "doc-1", title: "Laboratorio.pdf", createdAt: "2026-11-10T12:00:00Z", contentType: "application/pdf" };
function view(owner = "owner-1") { return <I18nProvider><MyDocumentsSection ownerId={owner} /></I18nProvider>; }

describe("originales de documentos en el expediente", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(getMyDocumentUrl).mockReset(); localStorage.clear();
    Object.assign(state, { items: [], loading: false, error: false, hasMore: false, fetchingMore: false });
  });

  it("no inventa documentos y permite reintentar la carga", () => {
    const { rerender } = render(view());
    expect(screen.getByText("Aún no tienes documentos guardados.")).toBeTruthy();
    state.error = true; rerender(view());
    expect(screen.queryByText("Aún no tienes documentos guardados.")).toBeNull();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(state.reload).toHaveBeenCalledOnce();
  });

  it("abre el original solo tras un toque explícito y sin marcar sus valores como verificados", async () => {
    state.items = [document];
    vi.mocked(getMyDocumentUrl).mockResolvedValueOnce("https://storage.example.test/original.pdf");
    render(view());
    expect(getMyDocumentUrl).not.toHaveBeenCalled();
    expect(Browser.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Abrir documento: Laboratorio.pdf"));
    await waitFor(() => expect(Browser.open).toHaveBeenCalledWith({ url: "https://storage.example.test/original.pdf" }));
    expect(screen.queryByText("Verificado")).toBeNull();
  });

  it("muestra un error localizado de apertura y permite otro intento", async () => {
    localStorage.setItem("antares_lang", "en"); state.items = [document];
    vi.mocked(getMyDocumentUrl).mockRejectedValueOnce(new Error("Forbidden"));
    render(view()); fireEvent.click(screen.getByLabelText("Open document: Laboratorio.pdf"));
    await screen.findByText("Could not open the document. Please try again.");
    expect(Browser.open).not.toHaveBeenCalled();
    vi.mocked(getMyDocumentUrl).mockResolvedValueOnce("https://storage.example.test/own.pdf");
    fireEvent.click(screen.getByLabelText("Open document: Laboratorio.pdf"));
    await waitFor(() => expect(Browser.open).toHaveBeenCalledOnce());
  });

  it("no abre un enlace tardío después de cambiar de cuenta", async () => {
    let resolve!: (url: string) => void;
    state.items = [document]; vi.mocked(getMyDocumentUrl).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { rerender } = render(view());
    fireEvent.click(screen.getByLabelText("Abrir documento: Laboratorio.pdf"));
    await waitFor(() => expect(getMyDocumentUrl).toHaveBeenCalledOnce());
    rerender(view("owner-2"));
    await act(async () => { resolve("https://storage.example.test/old-account.pdf"); });
    expect(Browser.open).not.toHaveBeenCalled();
  });

  it("ofrece paginación sin truncar silenciosamente el expediente", () => {
    state.items = [document]; state.hasMore = true;
    render(view()); fireEvent.click(screen.getByText("Cargar más documentos"));
    expect(state.loadMore).toHaveBeenCalledOnce();
  });
});

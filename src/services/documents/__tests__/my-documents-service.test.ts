import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../../utils/apiClient";
import { getApiBaseUrl } from "../../../utils/apiBaseUrl";
import { getMyDocuments, getMyDocumentUrl } from "../my-documents-service";

vi.mock("../../../utils/apiClient", () => ({ apiFetch: vi.fn() }));
vi.mock("../../../utils/apiBaseUrl", () => ({ getApiBaseUrl: vi.fn(() => "https://api.example.test") }));

describe("documentos del paciente", () => {
  beforeEach(() => { vi.mocked(apiFetch).mockReset(); vi.mocked(getApiBaseUrl).mockReturnValue("https://api.example.test"); });

  it("pagina sin aceptar un patientId y transmite la cancelación", async () => {
    const controller = new AbortController();
    vi.mocked(apiFetch).mockResolvedValueOnce({ items: [], total: 0, page: 2, pageSize: 20, totalPages: 1 });
    await getMyDocuments(2, controller.signal);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/me/documents?page=2&pageSize=20", { signal: controller.signal });
  });

  it("codifica el id y resuelve enlaces firmados relativos al backend", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ url: "/storage/original?signature=temporary" });
    expect(await getMyDocumentUrl("doc/1")).toBe("https://api.example.test/storage/original?signature=temporary");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/me/documents/doc%2F1/download", { signal: undefined });
  });

  it.each(["javascript:alert(1)", "file:///private/file.pdf", "", null])("no abre un enlace de documento inválido: %s", async url => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ url });
    await expect(getMyDocumentUrl("doc")).rejects.toThrow("Invalid document URL");
  });

  it("resuelve rutas relativas en el modo web del proxy sin una base explícita", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue("");
    vi.mocked(apiFetch).mockResolvedValueOnce({ url: "/storage/original?signature=temporary" });
    expect(await getMyDocumentUrl("doc")).toBe(new URL("/storage/original?signature=temporary", window.location.origin).href);
  });
});

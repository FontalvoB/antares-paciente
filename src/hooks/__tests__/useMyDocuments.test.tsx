import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMyDocuments } from "../useMyDocuments";
import { getMyDocuments, type PatientDocumentsPage } from "../../services/documents/my-documents-service";

vi.mock("../../services/documents/my-documents-service", () => ({ getMyDocuments: vi.fn() }));
function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
function page(id: string, n = 1): PatientDocumentsPage {
  return { items: [{ id, title: id, contentType: "application/pdf", createdAt: "2026-11-10T12:00:00Z" }], total: 2, page: n, pageSize: 1, totalPages: 2 };
}
describe("historial privado de documentos", () => {
  beforeEach(() => vi.mocked(getMyDocuments).mockReset());

  it("carga páginas y elimina ids solapados", async () => {
    vi.mocked(getMyDocuments).mockResolvedValueOnce(page("doc-1")).mockResolvedValueOnce({ ...page("doc-1", 2), items: [...page("doc-1").items, ...page("doc-2").items] });
    const { result } = renderHook(() => useMyDocuments("owner-1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.loadMore(); });
    await waitFor(() => expect(result.current.items.map(item => item.id)).toEqual(["doc-1", "doc-2"]));
    expect(result.current.hasMore).toBe(false);
    expect(getMyDocuments).toHaveBeenLastCalledWith(2, expect.any(AbortSignal));
  });

  it("el cambio de cuenta no muestra documentos de la anterior ni su respuesta tardía", async () => {
    let resolveOld!: (value: PatientDocumentsPage) => void;
    vi.mocked(getMyDocuments).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(page("owner-2-document"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(({ owner }) => useMyDocuments(owner), {
      initialProps: { owner: "owner-1" },
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(getMyDocuments).toHaveBeenCalledTimes(1));
    rerender({ owner: "owner-2" });
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(result.current.items[0]?.id).toBe("owner-2-document"));
    await act(async () => { resolveOld(page("owner-1-secret")); });
    expect(result.current.items.map(item => item.id)).toEqual(["owner-2-document"]);
  });

  it("sin cuenta no hace peticiones ni inventa archivos", () => {
    const { result } = renderHook(() => useMyDocuments(undefined), { wrapper: makeWrapper() });
    expect(getMyDocuments).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });
});

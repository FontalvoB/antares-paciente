import { afterEach, describe, expect, it, vi } from "vitest";
import { archiveVitaAttachment, deleteVitaAttachment, getVitaDocumentTypes, uploadVitaAttachment } from "../vita-attachments-service";
import { requireLegalConsent } from "../../../utils/legalConsents";

vi.mock("../../../utils/legalConsents", async original => ({
  ...await original<object>(),
  requireLegalConsent: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("adjuntos Vita en el gateway", () => {
  it("sube multipart con el archivo, hilo e idioma y deja el boundary al navegador", async () => {
    const result = { attachmentId: "file-1", kind: "pdf", contentType: "application/pdf", sizeBytes: 8, pageCount: 1,
      expiresAt: "2099-01-01T00:00:00Z" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["fake pdf"], "fixture.pdf", { type: "application/pdf" });

    await expect(uploadVitaAttachment(file, "thread-1", "en")).resolves.toEqual(result);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/vita\/attachments$/);
    expect(request.method).toBe("POST");
    expect(request.headers.has("Content-Type")).toBe(false);
    expect(request.body).toBeInstanceOf(FormData);
    // KAN-167: mismo contenido y tipo, con nombre neutro (el original puede tener datos personales).
    const sent = request.body.get("file") as File;
    expect(sent.name).toBe("adjunto.pdf");
    expect(sent.type).toBe("application/pdf");
    expect(sent.size).toBe(file.size);
    expect(await sent.text()).toBe("fake pdf");
    expect(request.body.get("threadId")).toBe("thread-1");
    expect(request.body.get("language")).toBe("en");
    expect(requireLegalConsent).toHaveBeenCalledWith("chat", "en", undefined);
  });

  it("sin hilo no envía threadId y neutraliza el nombre de una foto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ attachmentId: "file-2" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await uploadVitaAttachment(new File(["png"], "Ana Torres cédula.png", { type: "image/png" }), "", "es");
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.has("threadId")).toBe(false);
    expect((body.get("file") as File).name).toBe("adjunto.png");
  });

  it("conserva el estado y código de un rechazo de archivo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"code":"attachment_pdf_encrypted"}', { status: 422 })));
    const file = new File(["fixture"], "locked.pdf", { type: "application/pdf" });
    await expect(uploadVitaAttachment(file, "thread-1", "es")).rejects.toMatchObject({
      status: 422, code: "attachment_pdf_encrypted",
    });
  });

  it.each([201, 200])("acepta archivo confirmado con HTTP %i", async status => {
    const document = { documentId: "file-1", attachmentId: "file-1", title: "Hemograma", documentTypeId: "type-1",
      sizeBytes: 8, contentType: "application/pdf" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(document), { status }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(archiveVitaAttachment("file-1", "Hemograma", "type-1", "es")).resolves.toEqual(document);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/vita\/attachments\/file-1\/archive$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ confirmed: true, title: "Hemograma", documentTypeId: "type-1" });
  });

  it("elimina el efímero con DELETE y acepta 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteVitaAttachment("file-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/vita\/attachments\/file-1$/), expect.objectContaining({ method: "DELETE" }));
    expect(requireLegalConsent).not.toHaveBeenCalled();
  });

  it("usa el tipo general configurado para el paciente", async () => {
    vi.stubEnv("VITE_VITA_GENERAL_DOCUMENT_TYPE_ID", "type-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getVitaDocumentTypes("application/pdf")).resolves.toEqual([
      expect.objectContaining({ id: "type-1", code: "OTHER" }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

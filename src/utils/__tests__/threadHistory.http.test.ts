// @vitest-environment node
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ base: "", token: "", consent: vi.fn() }));
vi.mock("../apiBaseUrl", () => ({ getApiBaseUrl: () => fixture.base, getAuthBaseUrl: () => fixture.base }));
vi.mock("../authApi", () => ({ getAccessToken: () => fixture.token, sharedRefresh: vi.fn(), clearSessionAndNotify: vi.fn() }));
vi.mock("../legalConsents", () => ({ requireLegalConsent: fixture.consent }));

describe("historial Vita — cliente real contra HTTP sintético", () => {
  let server: Server;
  let client: typeof import("../threadApi");
  let status = 200;
  let body: unknown;
  let received: { method?: string; url?: string; authorization?: string; body: string }[] = [];
  beforeAll(async () => {
    server = createServer((request, response) => {
      let text = "";
      request.on("data", chunk => { text += chunk; });
      request.on("end", () => {
        received.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body: text });
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body));
      });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    fixture.base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    client = await import("../threadApi");
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
  beforeEach(() => {
    received = []; status = 200;
    fixture.token = `header.${btoa(JSON.stringify({ sub: "synthetic-owner" }))}.signature`;
    fixture.consent.mockReset().mockRejectedValue(new Error("Reading consent unavailable"));
    body = { threadId: "thread/1", historyRevision: 3, clearedAt: "2026-11-01T05:00:00Z", resetReason: "manual" };
  });

  it("DELETE autenticado sin cuerpo/identidad y sin pedir consentimiento de lectura", async () => {
    expect(await client.clearThreadMessages("thread/1")).toEqual(body);
    expect(received).toEqual([{ method: "DELETE", url: "/api/v1/threads/thread%2F1/messages", authorization: `Bearer ${fixture.token}`, body: "" }]);
    expect(fixture.consent).not.toHaveBeenCalled();
  });

  it.each([403, 404, 502, 503])("HTTP %s no equivale a borrado confirmado", async code => {
    status = code; body = { detail: "Synthetic failure" };
    await expect(client.clearThreadMessages("thread/1")).rejects.toMatchObject({ status: code });
  });

  it.each([{}, null, { threadId: "otro", historyRevision: 1, clearedAt: "date", resetReason: "manual" },
    { threadId: "thread/1", historyRevision: -1, clearedAt: "date", resetReason: "manual" }])("200 sin confirmación válida se rechaza: %j", async payload => {
    body = payload;
    await expect(client.clearThreadMessages("thread/1")).rejects.toThrow();
  });

  it("GET vacío conserva metadatos snake_case; legado no inventa revisión", async () => {
    body = { thread_id: "thread/1", history_revision: 4, cleared_at: "2026-11-01T05:00:00Z", reset_reason: "monthly", messages: [], lastMessage: null, messageCount: 0 };
    expect(await client.fetchThreadState("thread/1", "synthetic-owner")).toMatchObject({ threadId: "thread/1", historyRevision: 4, resetReason: "monthly", messages: [] });
    body = { threadId: "thread/1", messageCount: 0, lastMessage: null };
    expect(await client.fetchThreadState("thread/1", "synthetic-owner")).not.toHaveProperty("historyRevision");
  });

  it("DELETE acepta metadatos snake_case", async () => {
    body = { thread_id: "thread/1", history_revision: 4, cleared_at: "2026-11-01T05:00:00Z", reset_reason: "manual" };
    expect(await client.clearThreadMessages("thread/1")).toMatchObject({ threadId: "thread/1", historyRevision: 4, resetReason: "manual" });
  });

  it("cancelado antes de salir no envía DELETE", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(client.clearThreadMessages("thread/1", controller.signal)).rejects.toThrow();
    expect(received).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ token: "", refresh: vi.fn(), clear: vi.fn() }));
vi.mock("../authApi", () => ({ getAccessToken: () => auth.token, sharedRefresh: auth.refresh, clearSessionAndNotify: auth.clear }));
import { apiFetch } from "../apiClient";
const jwt = (id: string, revision = 1) => `test.${btoa(JSON.stringify({ sub: id, revision }))}.test`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { auth.token = jwt("A"); auth.refresh.mockReset(); auth.clear.mockReset(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
describe("deliberate actions bound to their original account", () => {
  it("does not replay acceptance for B when A's 401 refresh finishes after account switching", async () => {
    let finish!: (value: unknown) => void;
    auth.refresh.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(fetch).mockResolvedValue(json({ message: "expired" }, 401));
    const action = apiFetch("/api/v1/me/legal-consents/acceptances", { method: "POST", body: { scope: "chat" }, expectedUserId: "A" });
    const rejected = expect(action).rejects.toMatchObject({ code: "SESSION_CHANGED", status: 401 });
    await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalledOnce());
    auth.token = jwt("B"); finish({ status: 200, result: { accessToken: auth.token } });
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.clear).not.toHaveBeenCalled();
  });
  it("retries the same account with its rotated token", async () => {
    auth.refresh.mockImplementation(async () => { auth.token = jwt("A", 2); return { status: 200, result: { accessToken: auth.token } }; });
    vi.mocked(fetch).mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ id: "receipt" }));
    await expect(apiFetch("/api/v1/me/legal-consents/acceptances", { method: "POST", body: {}, expectedUserId: "A" })).resolves.toEqual({ id: "receipt" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get("Authorization")).toBe(`Bearer ${jwt("A", 2)}`);
  });
  it("rejects a stale account before sending anything", async () => {
    auth.token = jwt("B");
    await expect(apiFetch("/api/v1/me/legal-consents/acceptances/id", { method: "DELETE", expectedUserId: "A" })).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not retry a cancelled decision after refresh", async () => {
    const controller = new AbortController();
    auth.refresh.mockImplementation(async () => { controller.abort(); return { status: 200, result: { accessToken: auth.token } }; });
    vi.mocked(fetch).mockResolvedValue(json({}, 401));
    await expect(apiFetch("/api/v1/me/legal-consents/acceptances", { method: "POST", body: {}, expectedUserId: "A", signal: controller.signal })).rejects.toMatchObject({ errorType: "TIMEOUT" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

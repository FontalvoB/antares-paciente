import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recoverPassword, sendOtp, sendRecoveryCode } from "../authApi";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ expiresInSeconds: 300 }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const body = () => JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body));

describe("transactional OTP language metadata", () => {
  it.each(["en", "es"] as const)("requests activation messages in %s without changing canonical contact IDs", async language => {
    await sendOtp("QA-ID", "email", language);
    expect(body()).toEqual({ documentNumber: "QA-ID", contactId: "email", language });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/send-otp$/);
  });
  it("keeps Spanish as the default for existing API callers", async () => {
    await sendOtp("QA-ID", "phone");
    expect(body().language).toBe("es");
    await sendRecoveryCode("QA-ID", "email");
    expect(body().language).toBe("es");
  });
  it("passes English through recovery without changing the application audience", async () => {
    await sendRecoveryCode("QA-ID", "phone", "en");
    expect(body()).toEqual({ documentNumber: "QA-ID", contactId: "phone", application: "app", language: "en" });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/recovery-code$/);
    await recoverPassword("QA-ID", "phone", "123456", "Example123!", "en");
    expect(body()).toEqual({ documentNumber: "QA-ID", contactId: "phone", otp: "123456", newPassword: "Example123!", application: "app", language: "en" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../../../utils/apiClient";
import { cachedMotorPerson, readMotorDay } from "../calendar/motor-plan-api";
import { saveWellnessConsent } from "../privacy/privacy-consent-store";

const session = vi.hoisted(() => ({ token: "" }));
vi.mock("../../../utils/authApi", () => ({ getAccessToken: () => session.token }));
vi.mock("../../../utils/apiClient", () => ({ apiFetch: vi.fn() }));

const token = (sub: string) => `header.${btoa(JSON.stringify({ sub }))}.signature`;
const plan = {
  today: 8,
  todayLocalDate: "2026-01-08",
  timeZoneId: "America/Bogota",
  status: { state: "active" },
  real: true,
  sync: { personId: "person-a", logs: [], events: [] },
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  session.token = token("account-a");
});

describe("Motor 365 account scope", () => {
  it("drops a response from the previous account before writing its cache", async () => {
    saveWellnessConsent("sensitive-data", "account-a", true);
    let finish: (value: typeof plan) => void = () => {};
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = readMotorDay("account-a", new AbortController().signal, 28);
    session.token = token("account-b");
    finish(plan);
    await expect(pending).rejects.toHaveProperty("name", "AbortError");
    expect(cachedMotorPerson("account-a")).toBeUndefined();
    expect(cachedMotorPerson("account-b")).toBeUndefined();
  });

  it("requests only the plan until sensitive-data consent is available", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...plan, sync: undefined });
    const signal = new AbortController().signal;
    await readMotorDay("account-a", signal, 28);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/people/me/plan", expect.objectContaining({ signal }));
    expect(cachedMotorPerson("account-a")).toBeUndefined();

    saveWellnessConsent("sensitive-data", "account-a", true);
    vi.mocked(apiFetch).mockResolvedValueOnce(plan);
    await readMotorDay("account-a", signal, 365);
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/api/v1/people/me/plan?includeSync=true&historyDays=365", expect.objectContaining({ signal }),
    );
    expect(cachedMotorPerson("account-a")).toBe("person-a");
  });
});

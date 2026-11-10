import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ token: "", fresh: vi.fn(), consent: vi.fn() }));
vi.mock("../authApi", () => ({ getAccessToken: () => fixture.token, ensureFreshAccessToken: fixture.fresh, sharedRefresh: vi.fn(), clearSessionAndNotify: vi.fn() }));
vi.mock("../legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: fixture.consent }));
import { analyzeFoodImage } from "../foodAiApi";
const jwt = (id: string) => `test.${btoa(JSON.stringify({ sub: id }))}.test`;
beforeEach(() => { fixture.token = jwt("A"); fixture.consent.mockReset().mockResolvedValue(undefined); fixture.fresh.mockReset().mockResolvedValue(jwt("A")); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
describe("FoodAI original photo owner", () => {
  it("does not upload A's selected image after consent completes under B", async () => {
    fixture.consent.mockImplementation(async () => { fixture.token = jwt("B"); });
    await expect(analyzeFoodImage(new Blob(["A-only synthetic image"]), "meal.jpg")).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    expect(fixture.fresh).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not upload after refresh changes the account", async () => {
    fixture.fresh.mockImplementation(async () => { fixture.token = jwt("B"); return fixture.token; });
    await expect(analyzeFoodImage(new Blob(["A-only synthetic image"]), "meal.jpg")).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

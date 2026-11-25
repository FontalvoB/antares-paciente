import { beforeEach, expect, it } from "vitest";
import { createWellnessExport } from "../privacy/wellness-export";
import { saveWellnessConsent } from "../privacy/privacy-consent-store";

beforeEach(() => localStorage.clear());

it("genera un JSON versionado con todas las claves wellness.*, sin credenciales", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");
  localStorage.setItem("wellness.plan.v1", '{"age":32}');
  localStorage.setItem("wellness.future.raw", "texto");
  localStorage.setItem("wellness.mock.accounts.v1", '{"qa@example.invalid":"password"}');
  localStorage.setItem("auth.session", "jwt");
  saveWellnessConsent("sensitive-data", "a", true, now);
  saveWellnessConsent("sensitive-data", "b", true, now);
  const json = createWellnessExport("a", now);
  expect(JSON.parse(json)).toMatchObject({
    metadata: { version: 1, scope: "device", exportedAt: now.toISOString() },
    data: {
      "wellness.plan.v1": { age: 32 },
      "wellness.future.raw": "texto",
      "wellness.mock.accounts.v1": { credentialsRedacted: true },
    },
    privacyAudit: [{ actor: "a", action: "accepted" }],
  });
  expect(json).not.toMatch(/jwt|auth\.session|password|qa@example/);
});

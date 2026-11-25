import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteWellnessData, exportWellnessPrivacyAudit, readWellnessConsent,
  requireWellnessConsent, saveWellnessConsent, WELLNESS_CONSENT_MAX_AGE_MS,
  WELLNESS_CONSENT_VERSIONS, WELLNESS_PRIVACY_AUDIT_PREFIX,
} from "../privacy/privacy-consent-store";
import { createWellnessExport } from "../privacy/wellness-export";

const now = new Date("2026-11-25T12:00:00.000Z");

beforeEach(() => localStorage.clear());

describe("wellness privacy consent", () => {
  it("audita aceptación y retirada sin modificar el evento previo", () => {
    saveWellnessConsent("sensitive-data", "account-1", true, now);
    const key = localStorage.key(0)!;
    const original = localStorage.getItem(key);
    saveWellnessConsent("sensitive-data", "account-1", false, now);
    expect(localStorage.getItem(key)).toBe(original);
    expect(exportWellnessPrivacyAudit("account-1")).toEqual([
      { action: "accepted", scope: "sensitive-data", version: WELLNESS_CONSENT_VERSIONS["sensitive-data"], actor: "account-1", at: now.toISOString(), acceptedAt: now.toISOString() },
      { action: "withdrawn", scope: "sensitive-data", version: WELLNESS_CONSENT_VERSIONS["sensitive-data"], actor: "account-1", at: now.toISOString() },
    ]);
    expect(readWellnessConsent("sensitive-data", "account-1", now)).toBeNull();
    saveWellnessConsent("sensitive-data", "account-1", true, now);
    expect(readWellnessConsent("sensitive-data", "account-1", now)).toBeTruthy();
    expect(readWellnessConsent("sensitive-data", "account-2", now)).toBeNull();
    expect(readWellnessConsent("apple-health", "account-1", now)).toBeNull();
  });

  it("rechaza una versión anterior, fechas futuras y aceptaciones caducadas", () => {
    const scope = "apple-health";
    const at = now.toISOString();
    localStorage.setItem(WELLNESS_PRIVACY_AUDIT_PREFIX + at + ".legacy", JSON.stringify({
      action: "accepted", scope, version: "v0", actor: "a", at, acceptedAt: at,
    }));
    expect(readWellnessConsent(scope, "a", now)).toBeNull();
    const accepted = new Date(now.getTime() + 1);
    saveWellnessConsent(scope, "a", true, accepted);
    expect(readWellnessConsent(scope, "a", now)).toBeNull();
    expect(readWellnessConsent(scope, "a", accepted)?.version).toBe(WELLNESS_CONSENT_VERSIONS[scope]);
    expect(readWellnessConsent(scope, "a", new Date(+accepted + WELLNESS_CONSENT_MAX_AGE_MS))).toBeNull();
  });

  it("abre el contexto sin pedir permiso si falta consentimiento", () => {
    const openPrivacy = vi.fn();
    expect(requireWellnessConsent("apple-health", "a", openPrivacy)).toBe(false);
    expect(openPrivacy).toHaveBeenCalledOnce();
    saveWellnessConsent("apple-health", "a", true);
    expect(requireWellnessConsent("apple-health", "a", openPrivacy)).toBe(true);
    expect(openPrivacy).toHaveBeenCalledOnce();
  });

  it("exporta las claves de bienestar y las borra conservando sesión y auditoría", () => {
    localStorage.setItem("wellness.future.v2", "[1]");
    localStorage.setItem("wellness.plan.v1", "{}");
    localStorage.setItem("session", "token");
    saveWellnessConsent("apple-health", "a", true, now);
    saveWellnessConsent("sensitive-data", "b", true, now);
    expect(Object.keys(JSON.parse(createWellnessExport("a", now)).data)).toEqual(["wellness.future.v2", "wellness.plan.v1"]);
    deleteWellnessData("a", now);
    expect(JSON.parse(createWellnessExport("a", now)).data).toEqual({});
    expect(localStorage.getItem("session")).toBe("token");
    expect(exportWellnessPrivacyAudit("a").map(({ action }) => action)).toEqual(["accepted", "deleted"]);
    expect(readWellnessConsent("apple-health", "a", now)).toBeNull();
    expect(readWellnessConsent("sensitive-data", "b", now)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { normalizeVitaActions } from "../vitaActions";

describe("contrato BACK v1 de acciones Vita", () => {
  const action = { type: "navigate", destination: "podcast", resourceId: "assigned-id", localDate: "2026-11-14", resourceVersion: "revision" };
  it("acepta solo destinos conocidos con fecha y revisión", () => {
    expect(normalizeVitaActions([action])).toEqual([action]);
    expect(normalizeVitaActions([{ ...action, destination: "https://external.invalid" }, { ...action, type: "complete_task" }, { ...action, resourceVersion: "" }, { ...action, localDate: null }])).toEqual([]);
  });
  it("descarta campos ejecutables y no habilita citas", () => {
    expect(normalizeVitaActions([{ ...action, url: "https://external.invalid", userId: "other-patient" }])).toEqual([action]);
    expect(normalizeVitaActions([{ ...action, destination: "appointments" }])).toEqual([]);
    expect(normalizeVitaActions(null)).toEqual([]);
  });
});

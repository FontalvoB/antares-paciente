import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SOS_AUDIT_KEY,
  SOS_EVENT,
  SOS_LOG_MAX,
  isSosAvailable,
  isSosUtterance,
  readSosAudit,
  readSosNotices,
  recordSosAudit,
  recordSosContactNotice,
  requestSos,
} from "../sos/sos-store";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("auditoría SOS (wellness.sos.audit.v1)", () => {
  it("guarda fecha, hora, resultado y pantalla, sin más datos", () => {
    const entry = recordSosAudit("called_911", "wellness-diet", new Date(2026, 10, 24, 9, 5, 7));
    expect(entry).toEqual({ date: "2026-11-24", time: "09:05:07", result: "called_911", screen: "wellness-diet" });
    expect(JSON.parse(window.localStorage.getItem(SOS_AUDIT_KEY) ?? "[]")).toEqual([entry]);
  });

  it(`conserva como máximo ${SOS_LOG_MAX} entradas (las más recientes)`, () => {
    for (let index = 0; index < SOS_LOG_MAX + 7; index++) {
      recordSosAudit(index % 2 ? "cancelled" : "called_contact", `screen-${index}`);
    }
    const entries = readSosAudit();
    expect(entries).toHaveLength(SOS_LOG_MAX);
    expect(entries[0].screen).toBe("screen-7");
    expect(entries.at(-1)?.screen).toBe(`screen-${SOS_LOG_MAX + 6}`);
  });

  it("tolera almacenamiento corrupto o lleno sin romper la emergencia", () => {
    window.localStorage.setItem(SOS_AUDIT_KEY, "{roto");
    expect(readSosAudit()).toEqual([]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => recordSosAudit("cancelled", "home")).not.toThrow();
  });

  it("el aviso local a contactos solo guarda la cantidad", () => {
    recordSosContactNotice(2, new Date(2026, 0, 2, 3, 4, 5));
    expect(readSosNotices()).toEqual([{ date: "2026-01-02", time: "03:04:05", contacts: 2 }]);
  });
});

describe("detección de SOS por voz o chat", () => {
  it.each(["SOS", "sos!", "S.O.S.", "SOS ayuda", "Necesito ayuda urgente", "¡Auxilio!", "Es una emergencia", "llama al 911", "Help me now", "This is an emergency"])(
    "dispara con «%s»",
    (text) => expect(isSosUtterance(text)).toBe(true),
  );

  it.each(["", "¿Qué hace el botón SOS?", "¿Cómo agrego un contacto de emergencia?", "Hoy hice ejercicio", "emergency contact"])(
    "no dispara con «%s»",
    (text) => expect(isSosUtterance(text)).toBe(false),
  );

  it("requestSos emite el evento global wellness:sos", () => {
    const listener = vi.fn();
    window.addEventListener(SOS_EVENT, listener);
    requestSos("chat");
    window.removeEventListener(SOS_EVENT, listener);
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ source: "chat" });
  });
});

describe("disponibilidad del SOS", () => {
  it("visible en toda la app y oculto en el registro inicial sin contactos", () => {
    expect(isSosAvailable({ flow: "app", user: {} })).toBe(true);
    expect(isSosAvailable({ flow: "onboarding", user: { fam1Cel: "" } })).toBe(false);
    expect(isSosAvailable({ flow: "onboarding", user: { fam1Cel: "+57 300 123 4567" } })).toBe(true);
    expect(isSosAvailable({ flow: "tests", user: { fam2Cel: "3001234567" } })).toBe(true);
    expect(isSosAvailable({ flow: "login", user: { fam1Cel: "3001234567" } })).toBe(false);
  });
});

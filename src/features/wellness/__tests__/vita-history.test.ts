import { beforeEach, describe, expect, it } from "vitest";
import {
  clearVitaHistory,
  loadVitaHistory,
  redactPersonalData,
  saveVitaHistory,
  VITA_HISTORY_MAX_MESSAGES,
  VITA_HISTORY_PREFIX,
  VITA_HISTORY_TTL_DAYS,
  vitaOwnerKey,
} from "../vita/history";
import type { VitaHistoryMessage } from "../vita/history";
import { buildVitaModuleContext, sanitizeVitaSummary } from "../vita/context";
import { localDay, markVitaNudgeShown, shouldShowVitaNudge } from "../vita/dock";

const OWNER = "patient-123";
const message = (id: string, text: string, at = new Date().toISOString()): VitaHistoryMessage =>
  ({ id, role: "user", text, at });

beforeEach(() => localStorage.clear());

describe("historial de Vita por usuario y módulo", () => {
  it("separa el historial por módulo y por propietario", () => {
    saveVitaHistory(OWNER, "diet", [message("1", "comida")]);
    saveVitaHistory(OWNER, "home", [message("2", "inicio")]);
    saveVitaHistory("otra-cuenta", "diet", [message("3", "ajeno")]);
    expect(loadVitaHistory(OWNER, "diet").map((m) => m.text)).toEqual(["comida"]);
    expect(loadVitaHistory(OWNER, "home").map((m) => m.text)).toEqual(["inicio"]);
    expect(loadVitaHistory("otra-cuenta", "diet").map((m) => m.text)).toEqual(["ajeno"]);
  });

  it("no escribe el identificador real en la clave de almacenamiento", () => {
    saveVitaHistory(OWNER, "diet", [message("1", "hola")]);
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!);
    expect(keys).toEqual([`${VITA_HISTORY_PREFIX}:${vitaOwnerKey(OWNER)}:diet`]);
    expect(keys[0]).not.toContain(OWNER);
  });

  it("enmascara correo, teléfono, documento y UUID antes de guardar", () => {
    const saved = saveVitaHistory(OWNER, "profile", [message("1",
      "Mi correo es ana@example.test, tel +57 300 555 0101, doc 1020304050 e id 7f3c2a10-4b1e-4c55-9d2e-1a2b3c4d5e6f")]);
    const raw = localStorage.getItem(`${VITA_HISTORY_PREFIX}:${vitaOwnerKey(OWNER)}:profile`)!;
    for (const secret of ["ana@example.test", "300 555 0101", "1020304050", "7f3c2a10"]) {
      expect(raw).not.toContain(secret);
      expect(saved[0].text).not.toContain(secret);
    }
    expect(redactPersonalData("1660 kcal y 30 min")).toBe("1660 kcal y 30 min");
  });

  it("solo persiste campos permitidos (sin acciones ni ids de ejecución)", () => {
    saveVitaHistory(OWNER, "diet", [{ ...message("1", "hola"), role: "bot", executionId: "exec", actions: [] } as VitaHistoryMessage]);
    expect(Object.keys(loadVitaHistory(OWNER, "diet")[0]).sort()).toEqual(["at", "id", "role", "text"]);
  });

  it(`conserva como máximo ${VITA_HISTORY_MAX_MESSAGES} mensajes y caduca a los ${VITA_HISTORY_TTL_DAYS} días`, () => {
    const now = Date.now();
    const old = new Date(now - (VITA_HISTORY_TTL_DAYS * 24 + 1) * 3_600_000).toISOString();
    const many = Array.from({ length: VITA_HISTORY_MAX_MESSAGES + 5 }, (_, i) => message(String(i), `m${i}`));
    saveVitaHistory(OWNER, "home", [message("old", "viejo", old), ...many], now);
    const loaded = loadVitaHistory(OWNER, "home", now);
    expect(loaded).toHaveLength(VITA_HISTORY_MAX_MESSAGES);
    expect(loaded.some((m) => m.id === "old")).toBe(false);
    expect(loaded.at(-1)!.text).toBe(`m${VITA_HISTORY_MAX_MESSAGES + 4}`);
    expect(loadVitaHistory(OWNER, "home", now + VITA_HISTORY_TTL_DAYS * 86_400_000 + 1)).toEqual([]);
  });

  it("descarta entradas corruptas y permite borrar el módulo", () => {
    localStorage.setItem(`${VITA_HISTORY_PREFIX}:${vitaOwnerKey(OWNER)}:diet`, "{no-json");
    expect(loadVitaHistory(OWNER, "diet")).toEqual([]);
    saveVitaHistory(OWNER, "diet", [message("1", "hola")]);
    clearVitaHistory(OWNER, "diet");
    expect(loadVitaHistory(OWNER, "diet")).toEqual([]);
  });
});

describe("contexto del módulo", () => {
  it("acota claves, recorta textos y descarta datos personales", () => {
    const summary = sanitizeVitaSummary({
      day: 4, adherencePct: 82.456, closedToday: true, nextStep: "x".repeat(200),
      userEmail: "a@b.co", phoneNumber: "3005550101", patientId: "p1", note: "llámame al 300 555 0101",
      a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, a6: 6,
    });
    expect(summary.day).toBe(4);
    expect(summary.adherencePct).toBe(82.46);
    expect((summary.nextStep as string).length).toBe(60);
    expect(Object.keys(summary)).toHaveLength(8);
    expect(JSON.stringify(summary)).not.toMatch(/a@b\.co|3005550101|p1|555/);
    expect(buildVitaModuleContext("goal")).toEqual({ module: "goal", summary: {} });
  });
});

describe("aviso proactivo diario", () => {
  it("se permite una vez por día local", () => {
    const today = new Date(2026, 10, 25, 9);
    expect(localDay(today)).toBe("2026-11-25");
    expect(shouldShowVitaNudge(OWNER, today)).toBe(true);
    markVitaNudgeShown(OWNER, today);
    expect(shouldShowVitaNudge(OWNER, new Date(2026, 10, 25, 22))).toBe(false);
    expect(shouldShowVitaNudge(OWNER, new Date(2026, 10, 26, 0, 5))).toBe(true);
  });
});

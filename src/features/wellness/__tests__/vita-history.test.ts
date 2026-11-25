import { beforeEach, describe, expect, it } from "vitest";
import {
  clearVitaHistory,
  hash64,
  loadVitaHistory,
  purgeVitaHistory,
  redactPersonalData,
  saveVitaHistory,
  VITA_HISTORY_LEGACY_PREFIX,
  VITA_HISTORY_MAX_MESSAGES,
  VITA_HISTORY_PREFIX,
  VITA_HISTORY_TTL_DAYS,
  VITA_NAMESPACE_SALT_KEY,
  vitaNamespace,
} from "../vita/history";
import type { VitaHistoryInput } from "../vita/history";
import { buildVitaModuleContext, sanitizeVitaSummary } from "../vita/context";
import { localDay, markVitaNudgeShown, shouldShowVitaNudge } from "../vita/dock";
import { clearVitaVoiceOrigin, readVitaVoiceOrigin, setVitaVoiceOrigin } from "../../../services/chat/vita-origin";

const ACCOUNT_A = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ACCOUNT_B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const PROFILE = ["Ana Torres", "ana.torres@example.test", "1020304050", "+57 300 555 0101", "Medellín"];
const user = (id: string, text: string, at = new Date().toISOString(), extra: Partial<VitaHistoryInput> = {}): VitaHistoryInput =>
  ({ id, role: "user", text, at, ...extra });
const bot = (id: string, text: string, at = new Date().toISOString()): VitaHistoryInput => ({ id, role: "bot", text, at });
/** Turno de sugerencia rápida: única respuesta de Vita que se persiste. */
const PROMPT = "¿Qué me conviene priorizar hoy?";
const promptTurn = (id: string, text: string): VitaHistoryInput[] =>
  [user(`${id}-u`, PROMPT, undefined, { promptKey: PROMPT }), bot(id, text)];
const allStorage = () => Array.from({ length: localStorage.length }, (_, i) => {
  const key = localStorage.key(i)!;
  return `${key}=${localStorage.getItem(key)}`;
}).join("\n");

beforeEach(() => localStorage.clear());

describe("espacio opaco por cuenta", () => {
  it("no contiene el id, separa cuentas y no existe sin cuenta verificable", () => {
    const a = vitaNamespace(ACCOUNT_A)!;
    const b = vitaNamespace(ACCOUNT_B)!;
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain(ACCOUNT_A.slice(0, 8));
    expect(vitaNamespace(null)).toBeNull();
    expect(vitaNamespace("  ")).toBeNull();
    // Con sal distinta (otro dispositivo) el espacio cambia: no es enlazable.
    localStorage.setItem(VITA_NAMESPACE_SALT_KEY, "0".repeat(32));
    expect(vitaNamespace(ACCOUNT_A)).not.toBe(a);
    expect(hash64("x")).toHaveLength(16);
  });

  it("aísla el historial al cambiar de cuenta", () => {
    const a = vitaNamespace(ACCOUNT_A);
    const b = vitaNamespace(ACCOUNT_B);
    saveVitaHistory(a, "diet", promptTurn("1", "Respuesta para A"));
    expect(loadVitaHistory(b, "diet")).toEqual([]);
    expect(loadVitaHistory(a, "diet").map((m) => m.text)).toEqual(["", "Respuesta para A"]);
    expect(loadVitaHistory(null, "diet")).toEqual([]);
    expect(saveVitaHistory(null, "diet", [bot("2", "sin cuenta")])).toHaveLength(1);
    expect(allStorage()).not.toContain("sin cuenta");
  });
});

describe("historial sin datos personales", () => {
  it("nunca guarda el texto libre del usuario y solo la clave de una sugerencia", () => {
    const ns = vitaNamespace(ACCOUNT_A);
    saveVitaHistory(ns, "profile", [
      user("1", "Soy Ana Torres y vivo en Calle 45 # 12-30, Medellín"),
      user("2", "¿Qué puedo comer hoy según mi plan?", undefined, { promptKey: "¿Qué puedo comer hoy según mi plan?" }),
    ], PROFILE);
    const stored = loadVitaHistory(ns, "profile");
    expect(stored[0]).toEqual({ id: "1", role: "user", text: "", at: stored[0].at, redacted: true });
    expect(stored[1].promptKey).toBe("¿Qué puedo comer hoy según mi plan?");
    expect(allStorage()).not.toMatch(/Ana|Torres|Calle 45|Medell/);
  });

  it("no persiste la respuesta a un texto libre aunque repita nombre o dirección no reconocibles", () => {
    const ns = vitaNamespace(ACCOUNT_A);
    saveVitaHistory(ns, "home", [
      user("1", "me llamo valentina ríos y vivo en la manzana 4 casa 12 del barrio el prado"),
      bot("2", "Gracias valentina ríos, recuerdo la manzana 4 casa 12 del barrio el prado."),
    ], PROFILE);
    const raw = allStorage();
    for (const secret of ["valentina", "ríos", "manzana", "prado"]) expect(raw).not.toContain(secret);
    expect(loadVitaHistory(ns, "home")[1]).toMatchObject({ role: "bot", text: "", redacted: true });
  });

  it("en respuestas a sugerencias redacta perfil, dirección y contacto", () => {
    const ns = vitaNamespace(ACCOUNT_A);
    const prompt = "¿Qué me conviene priorizar hoy?";
    saveVitaHistory(ns, "home", [
      user("1", prompt, undefined, { promptKey: prompt }),
      bot("2", "Hola Ana Torres: desde Av. Siempre Viva 742 o 221B Baker Street, escríbeme a ana.torres@example.test o al +57 300 555 0101; id 7f3c2a10-4b1e-4c55-9d2e-1a2b3c4d5e6f. Camina 30 min y bebe 2 litros."),
    ], PROFILE);
    const raw = allStorage();
    for (const secret of ["Ana", "Torres", "Baker", "Siempre Viva", "742", "ana.torres", "555 0101", "7f3c2a10"]) {
      expect(raw).not.toContain(secret);
    }
    expect(loadVitaHistory(ns, "home")[1].text).toContain("Camina 30 min y bebe 2 litros.");
  });

  it("no altera texto de bienestar sin datos personales", () => {
    expect(redactPersonalData("Prueba 1660 kcal, 30 min y 8 vasos de agua.")).toBe("Prueba 1660 kcal, 30 min y 8 vasos de agua.");
  });

  it("solo persiste campos permitidos (sin acciones ni ids de ejecución)", () => {
    const ns = vitaNamespace(ACCOUNT_A);
    saveVitaHistory(ns, "diet", [promptTurn("1", "hola")[0], { ...bot("1", "hola"), executionId: "exec", actions: [] } as VitaHistoryInput]);
    expect(Object.keys(loadVitaHistory(ns, "diet")[1]).sort()).toEqual(["at", "id", "role", "text"]);
  });
});

describe("retención", () => {
  it(`conserva como máximo ${VITA_HISTORY_MAX_MESSAGES} mensajes y caduca a los ${VITA_HISTORY_TTL_DAYS} días`, () => {
    const ns = vitaNamespace(ACCOUNT_A);
    const now = Date.now();
    const old = new Date(now - (VITA_HISTORY_TTL_DAYS * 24 + 1) * 3_600_000).toISOString();
    const many = Array.from({ length: VITA_HISTORY_MAX_MESSAGES + 5 }, (_, i) => bot(String(i), `m${i}`));
    saveVitaHistory(ns, "home", [bot("old", "viejo", old), ...many], [], now);
    const loaded = loadVitaHistory(ns, "home", now);
    expect(loaded).toHaveLength(VITA_HISTORY_MAX_MESSAGES);
    expect(loaded.some((m) => m.id === "old")).toBe(false);
    expect(loadVitaHistory(ns, "home", now + VITA_HISTORY_TTL_DAYS * 86_400_000 + 1)).toEqual([]);
  });

  it("la purga global vacía módulos y cuentas inactivos y elimina las claves v1", () => {
    const now = Date.now();
    const old = new Date(now - (VITA_HISTORY_TTL_DAYS + 1) * 86_400_000).toISOString();
    const a = vitaNamespace(ACCOUNT_A);
    const b = vitaNamespace(ACCOUNT_B);
    saveVitaHistory(a, "vitals", [bot("1", "viejo")], [], Date.parse(old) + 1);
    localStorage.setItem(`${VITA_HISTORY_PREFIX}:${b}:goal`, JSON.stringify([
      { id: "2", role: "bot", text: "viejo", at: old },
      { id: "3", role: "bot", text: "vigente", at: new Date(now).toISOString() },
    ]));
    localStorage.setItem(`${VITA_HISTORY_LEGACY_PREFIX}:abcd1234:diet`, JSON.stringify([{ id: "x", role: "user", text: "Ana Torres", at: new Date().toISOString() }]));
    localStorage.setItem("wellness.vita.nudge.v1:abcd1234", "2026-11-25");
    localStorage.setItem(`${VITA_HISTORY_PREFIX}:corrupto:home`, "{no-json");
    // Ajusta las fechas: los mensajes "viejo" se escribieron con `old`.
    const keyA = `${VITA_HISTORY_PREFIX}:${a}:vitals`;
    localStorage.setItem(keyA, JSON.stringify([{ id: "1", role: "bot", text: "viejo", at: old }]));
    purgeVitaHistory(now);
    expect(localStorage.getItem(keyA)).toBeNull();
    expect(loadVitaHistory(b, "goal", now).map((m) => m.text)).toEqual(["vigente"]);
    expect(allStorage()).not.toContain(VITA_HISTORY_LEGACY_PREFIX);
    expect(allStorage()).not.toContain("wellness.vita.nudge.v1");
    expect(localStorage.getItem(`${VITA_HISTORY_PREFIX}:corrupto:home`)).toBeNull();
  });

  it("permite borrar un módulo", () => {
    const ns = vitaNamespace(ACCOUNT_A);
    saveVitaHistory(ns, "diet", [bot("1", "hola")]);
    clearVitaHistory(ns, "diet");
    expect(loadVitaHistory(ns, "diet")).toEqual([]);
  });
});

describe("contexto del módulo (lista permitida)", () => {
  it("solo admite claves de dominio con valores válidos", () => {
    const summary = sanitizeVitaSummary({
      day: 4, adherencePct: 82.456, closedToday: true, goal: "bajar", pendingSteps: "diet, chest",
      nextStep: "Ejercicio", note: "hola", userEmail: "a@b.co", nombre: "Ana", patientId: "p1",
      adherence: 50, level: -1, language: "fr", kcalGoal: 999_999,
    });
    expect(summary).toEqual({ day: 4, adherencePct: 82.46, closedToday: true, goal: "bajar", pendingSteps: "diet,chest" });
    expect(sanitizeVitaSummary({ pendingSteps: "diet,Calle 45" })).toEqual({});
    expect(buildVitaModuleContext("vitals")).toEqual({ module: "vitals", summary: {} });
  });
});

describe("aviso proactivo diario", () => {
  it("se permite una vez por día local y por espacio opaco", () => {
    const ns = vitaNamespace(ACCOUNT_A);
    const today = new Date(2026, 10, 25, 9);
    expect(localDay(today)).toBe("2026-11-25");
    expect(shouldShowVitaNudge(ns, today)).toBe(true);
    markVitaNudgeShown(ns, today);
    expect(shouldShowVitaNudge(ns, new Date(2026, 10, 25, 22))).toBe(false);
    expect(shouldShowVitaNudge(ns, new Date(2026, 10, 26, 0, 5))).toBe(true);
    expect(shouldShowVitaNudge(null, today)).toBe(false);
  });
});

describe("origen de voz", () => {
  it("se mantiene en reintentos, se borra al cerrar y caduca sin uso", () => {
    setVitaVoiceOrigin({ module: "profile", summary: { language: "es" } });
    expect(readVitaVoiceOrigin()).toEqual({ module: "profile", summary: { language: "es" } });
    expect(readVitaVoiceOrigin()).toEqual({ module: "profile", summary: { language: "es" } });
    clearVitaVoiceOrigin();
    expect(readVitaVoiceOrigin()).toBeNull();
    setVitaVoiceOrigin({ module: "diet", summary: {} });
    expect(readVitaVoiceOrigin(Date.now() + 31_000)).toBeNull();
  });
});

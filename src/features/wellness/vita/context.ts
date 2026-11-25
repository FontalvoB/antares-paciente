/**
 * Contexto del módulo de origen para Vita (KAN-167).
 *
 * Cada pantalla pasa un identificador de módulo y un resumen corto de lo que
 * el usuario ve. Este fichero es la única puerta hacia el payload y funciona
 * por LISTA PERMITIDA: solo viajan claves de dominio conocidas con valores
 * validados (números acotados, banderas y vocabularios cerrados). Todo lo
 * demás se descarta, aunque el llamador se equivoque.
 */
import type { ChatModuleContext } from "../../../services/chat/types";

/** Módulos desde los que se puede abrir Vita. */
export const VITA_MODULES = [
  "home", "protocol", "diet", "exercise", "close-day", "goal", "profile",
  "privacy", "notifications", "vitals",
] as const;
export type VitaModuleId = (typeof VITA_MODULES)[number];

/** Valor admitido en el resumen: solo primitivas cortas. */
export type VitaSummaryValue = string | number | boolean | null | undefined;
export type VitaModuleSummary = Readonly<Record<string, VitaSummaryValue>>;

/** Máximo de claves del resumen que viajan al backend. */
export const VITA_SUMMARY_MAX_KEYS = 8;

type Rule =
  | { kind: "number"; min: number; max: number }
  | { kind: "boolean" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "list"; values: readonly string[] };

const COUNT = { kind: "number", min: 0, max: 1000 } as const;
const PERCENT = { kind: "number", min: 0, max: 100 } as const;
const KCAL = { kind: "number", min: 0, max: 10_000 } as const;
const FLAG = { kind: "boolean" } as const;
const PROTOCOL_STEPS = ["exercise", "diet", "vitals", "emotional", "chest"] as const;

/** Claves de dominio permitidas y su validación. */
export const VITA_SUMMARY_RULES: Readonly<Record<string, Rule>> = {
  day: COUNT,
  totalDays: COUNT,
  adherencePct: PERCENT,
  streakDays: COUNT,
  level: COUNT,
  protocolDone: COUNT,
  protocolTotal: COUNT,
  closedToday: FLAG,
  chestUnlocked: FLAG,
  pendingSteps: { kind: "list", values: PROTOCOL_STEPS },
  kcalGoal: KCAL,
  kcalLogged: KCAL,
  mealsLogged: COUNT,
  mealsTotal: COUNT,
  simplified: FLAG,
  vegetarian: FLAG,
  goal: { kind: "enum", values: ["bajar", "masa", "def"] },
  exercisesTotal: COUNT,
  sessionActive: FLAG,
  language: { kind: "enum", values: ["es", "en"] },
};

function validate(rule: Rule, value: VitaSummaryValue): string | number | boolean | undefined {
  switch (rule.kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value) && value >= rule.min && value <= rule.max
        ? Math.round(value * 100) / 100 : undefined;
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "enum":
      return typeof value === "string" && rule.values.includes(value) ? value : undefined;
    case "list": {
      if (typeof value !== "string") return undefined;
      const items = value.split(",").map((item) => item.trim()).filter(Boolean);
      return items.every((item) => rule.values.includes(item)) ? items.join(",") : undefined;
    }
  }
}

/** Normaliza el resumen: solo claves permitidas con valores válidos, máximo 8. */
export function sanitizeVitaSummary(summary: VitaModuleSummary | undefined): ChatModuleContext["summary"] {
  const out: ChatModuleContext["summary"] = {};
  if (!summary) return out;
  let count = 0;
  for (const [key, value] of Object.entries(summary)) {
    if (count >= VITA_SUMMARY_MAX_KEYS) break;
    const rule = Object.hasOwn(VITA_SUMMARY_RULES, key) ? VITA_SUMMARY_RULES[key] : undefined;
    const valid = rule ? validate(rule, value) : undefined;
    if (valid === undefined) continue;
    out[key] = valid;
    count += 1;
  }
  return out;
}

/** Construye el `moduleContext` que viaja en el payload del chat y de la voz. */
export function buildVitaModuleContext(module: VitaModuleId, summary?: VitaModuleSummary): ChatModuleContext {
  return { module, summary: sanitizeVitaSummary(summary) };
}

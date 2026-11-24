/**
 * Servicio del onboarding de Agentic Wellness IA (KAN-136).
 *
 * MODO ACTUAL: mock aislado. El contrato `/v1` lo publica Diomedes (KAN-130);
 * hasta entonces este módulo simula:
 * - comprobación de correo y alta de cuenta,
 * - persistencia local del borrador,
 * - generación del plan (compuerta + vista previa del motor v5.2).
 *
 * La UI solo conoce `WellnessOnboardingService`. Cuando exista `/v1` se cambia
 * la implementación por una que llame al backend, sin tocar pantallas.
 */

import { evaluateGate } from "../domain/gate";
import { buildPlanPreview } from "../domain/plan-preview";
import { normalizeDraft } from "../domain/draft";
import type {
  EmailLookup,
  GeneratePlanResult,
  ObjectiveDraft,
} from "../domain/types";

const DRAFT_KEY = "wellness.onboarding.draft.v1";
const ACCOUNTS_KEY = "wellness.mock.accounts.v1";

/** Cuenta de demostración para probar el camino "el correo ya existe". */
export const MOCK_ACCOUNT = {
  email: "demo@wellness.test",
  password: "Demo1234!",
} as const;

export interface WellnessOnboardingService {
  checkEmail(email: string): Promise<EmailLookup>;
  signIn(email: string, password: string): Promise<void>;
  createAccount(email: string, password: string): Promise<void>;
  saveDraft(draft: ObjectiveDraft): void;
  loadDraft(): ObjectiveDraft | null;
  clearDraft(): void;
  generatePlan(draft: ObjectiveDraft): Promise<GeneratePlanResult>;
}

// ---------- almacenamiento seguro (happy-dom / navegador / SSR) ----------

function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function readAccounts(): Record<string, string> {
  const raw = readStorage(ACCOUNTS_KEY);
  const base: Record<string, string> = {
    [MOCK_ACCOUNT.email]: MOCK_ACCOUNT.password,
  };
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

function writeAccounts(accounts: Record<string, string>): void {
  writeStorage(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ---------- implementación mock ----------

export class MockWellnessOnboardingService implements WellnessOnboardingService {
  private unsavedDraft: ObjectiveDraft | null = null;

  async checkEmail(email: string): Promise<EmailLookup> {
    const accounts = readAccounts();
    return { exists: Boolean(accounts[normalizeEmail(email)]) };
  }

  async signIn(email: string, password: string): Promise<void> {
    const accounts = readAccounts();
    const stored = accounts[normalizeEmail(email)];
    if (!stored || stored !== password) {
      throw new Error("Correo o contraseña incorrectos.");
    }
  }

  async createAccount(email: string, password: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error("Ingresa tu correo electrónico.");
    if (password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.");
    }
    const accounts = readAccounts();
    accounts[normalized] = password;
    writeAccounts(accounts);
  }

  saveDraft(draft: ObjectiveDraft): void {
    const saved = writeStorage(DRAFT_KEY, JSON.stringify(draft));
    this.unsavedDraft = saved ? null : normalizeDraft(draft);
  }

  loadDraft(): ObjectiveDraft | null {
    if (this.unsavedDraft) return this.unsavedDraft;
    const raw = readStorage(DRAFT_KEY);
    if (!raw) return null;
    try {
      return normalizeDraft(JSON.parse(raw) as Partial<ObjectiveDraft>);
    } catch {
      return null;
    }
  }

  clearDraft(): void {
    this.unsavedDraft = null;
    removeStorage(DRAFT_KEY);
  }

  async generatePlan(draft: ObjectiveDraft): Promise<GeneratePlanResult> {
    // La compuerta es la misma que aplicará el backend; no se inventa estado.
    const status = evaluateGate(draft);
    if (!status.ok) return { status };
    const plan = buildPlanPreview(draft);
    if (!plan) return { status: evaluateGate(normalizeDraft(draft)) };
    return { status, plan };
  }
}

/** Instancia única usada por la app; los tests pueden inyectar otra. */
export const wellnessOnboardingService: WellnessOnboardingService =
  new MockWellnessOnboardingService();

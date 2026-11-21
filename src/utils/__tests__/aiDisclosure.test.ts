import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("../authApi", async (original) => ({
  ...(await original<object>()),
  getAccessToken: () => auth.token,
}));

import {
  AI_DISCLOSURE_VERSION,
  acceptAiDisclosure,
  aiDisclosureAccepted,
  isAiDisclosureScope,
  registerAiDisclosurePrompt,
  requireAiDisclosure,
  withdrawAiDisclosure,
} from "../aiDisclosure";

const tokenFor = (subject: string) =>
  `header.${btoa(JSON.stringify({ sub: subject }))}.signature`;

let unregister: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  auth.token = null;
  unregister?.();
  unregister = undefined;
});

afterEach(() => {
  unregister?.();
  unregister = undefined;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AI disclosure gate", () => {
  it("solo cubre las funciones que envían datos a IA", () => {
    for (const scope of [
      "chat",
      "voice",
      "food",
      "lab",
      "patient-ai",
    ] as const) {
      expect(isAiDisclosureScope(scope)).toBe(true);
    }
    expect(isAiDisclosureScope("program")).toBe(false);
    expect(isAiDisclosureScope("sos")).toBe(false);
  });

  it("sin sesión no bloquea porque el backend exige JWT", async () => {
    const prompt = vi.fn();
    unregister = registerAiDisclosurePrompt(prompt);
    await expect(requireAiDisclosure("chat")).resolves.toBeUndefined();
    expect(prompt).not.toHaveBeenCalled();
  });

  it("falla cerrado si no hay aviso montado y la cuenta no ha aceptado", async () => {
    auth.token = tokenFor("owner-a");
    await expect(requireAiDisclosure("food")).rejects.toMatchObject({
      code: "CONSENT_DOCUMENT_UNAVAILABLE",
      status: 503,
    });
    expect(aiDisclosureAccepted("owner-a")).toBe(false);
  });

  it("un rechazo detiene la petición y no guarda permiso", async () => {
    auth.token = tokenFor("owner-a");
    const prompt = vi.fn().mockResolvedValue(false);
    unregister = registerAiDisclosurePrompt(prompt);
    await expect(requireAiDisclosure("voice")).rejects.toMatchObject({
      code: "CONSENT_CANCELLED",
    });
    expect(prompt).toHaveBeenCalledWith("voice", "es", undefined);
    expect(aiDisclosureAccepted("owner-a")).toBe(false);
  });

  it("acepta una vez por cuenta y no vuelve a preguntar", async () => {
    auth.token = tokenFor("owner-a");
    const prompt = vi.fn().mockImplementation(async () => {
      acceptAiDisclosure("owner-a");
      return true;
    });
    unregister = registerAiDisclosurePrompt(prompt);
    await expect(requireAiDisclosure("chat")).resolves.toBeUndefined();
    await expect(requireAiDisclosure("chat")).resolves.toBeUndefined();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(aiDisclosureAccepted("owner-a")).toBe(true);
  });

  it("la aceptación de una cuenta no autoriza a otra", async () => {
    acceptAiDisclosure("owner-a");
    auth.token = tokenFor("owner-b");
    unregister = registerAiDisclosurePrompt(vi.fn().mockResolvedValue(true));
    acceptAiDisclosure("owner-b");
    await expect(requireAiDisclosure("lab")).resolves.toBeUndefined();
    withdrawAiDisclosure("owner-b");
    await expect(requireAiDisclosure("lab")).rejects.toMatchObject({
      code: "CONSENT_CANCELLED",
    });
  });

  it("una versión vieja del aviso exige volver a aceptar", async () => {
    auth.token = tokenFor("owner-a");
    localStorage.setItem(
      "copp.ai-disclosure.owner-a",
      JSON.stringify({
        version: "2020-01-01",
        acceptedAt: "2020-01-01T00:00:00Z",
      }),
    );
    expect(aiDisclosureAccepted("owner-a")).toBe(false);
    unregister = registerAiDisclosurePrompt(vi.fn().mockResolvedValue(false));
    await expect(requireAiDisclosure("patient-ai")).rejects.toMatchObject({
      code: "CONSENT_CANCELLED",
    });
  });

  it("la versión vigente se guarda y se puede retirar", () => {
    acceptAiDisclosure("owner-a");
    const stored = JSON.parse(
      localStorage.getItem("copp.ai-disclosure.owner-a") ?? "{}",
    );
    expect(stored.version).toBe(AI_DISCLOSURE_VERSION);
    expect(typeof stored.acceptedAt).toBe("string");
    withdrawAiDisclosure("owner-a");
    expect(aiDisclosureAccepted("owner-a")).toBe(false);
  });
});

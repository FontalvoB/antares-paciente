import { afterEach, describe, expect, it, vi } from "vitest";
import { sendVitaVoiceTurn } from "../vita-origin";
import { requireLegalConsent } from "../../../utils/legalConsents";

vi.mock("../../../utils/legalConsents", async (original) => ({
  ...(await original<object>()),
  requireLegalConsent: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => vi.unstubAllGlobals());

describe("turno de voz Web Speech de Vita", () => {
  it("envía el módulo sin hilo ni identificadores y devuelve la respuesta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: "Respira hondo.", threadId: "t" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const answer = await sendVitaVoiceTurn("hola", "es", { module: "diet", summary: { mealsLogged: 1 } });
    expect(answer).toEqual({ text: "Respira hondo." });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({ message: "hola", supportsVita: true, language: "es", moduleContext: { module: "diet", summary: { mealsLogged: 1 } } });
    expect(requireLegalConsent).toHaveBeenCalledWith("chat", "es", undefined);
  });

  it("sin respuesta devuelve null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: "  ", threadId: "t" }), { status: 200 })));
    await expect(sendVitaVoiceTurn("hola", "en", { module: "home", summary: {} })).resolves.toBeNull();
  });
});

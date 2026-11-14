import { describe, expect, it } from "vitest";
import { mergeChatHistory } from "../chatHistory";
import { voiceMessage } from "../voiceMessages";

describe("historial canónico y voz", () => {
  it("reabre IDs canónicos, conserva revisiones y no duplica al hidratar", () => {
    const local = { ...voiceMessage("session", "thread", { role: "agent", source: "ai", message: "Hola", event_id: 1, response_id: "otro-uuid-provider" })!, id: "canonical-bot", messageId: "canonical-bot" };
    const history = [{ role: "bot", text: "Hola corregido", messageId: "canonical-bot", channel: "voice" as const, status: "interrupted" as const, revision: 2 }];
    const merged = mergeChatHistory([local], history, "thread");
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "canonical-bot", messageId: "canonical-bot", channel: "voice", status: "interrupted", revision: 2, text: "Hola corregido" });
    expect(mergeChatHistory(merged, history, "thread")).toHaveLength(1);
    expect(mergeChatHistory(merged, [{ ...history[0], revision: 1, text: "Viejo" }], "thread")[0].text).toBe("Hola corregido");
  });
  it("conserva mensajes iguales con IDs distintos y deduplica páginas por ID", () => {
    const history = [1, 2].map(id => ({ messageId: String(id), role: "user", text: "Sí", revision: 1 }));
    const merged = mergeChatHistory([], history, "thread");
    expect(merged).toHaveLength(2);
    expect(mergeChatHistory(merged, history, "thread")).toHaveLength(2);
    expect(mergeChatHistory(merged, [{ ...history[0], messageId: "older" }], "thread").map(message => message.id)).toEqual(["older", "1", "2"]);
  });
  it("no inventa correspondencia entre un evento legacy y un ordinal del runtime", () => {
    const local = voiceMessage("local", "thread", { role: "user", source: "user", message: "Sí", event_id: 0 })!;
    const merged = mergeChatHistory([local], [{ messageId: "voice:server:1:user", role: "user", text: "Sí", channel: "voice" }], "thread");
    expect(merged).toHaveLength(2); // Sin alias verificado, deduplicar por texto perdería una frase legítima.
  });
  it.each(["vita", "legacy"] as const)("sesión %s validada usa una fuente a la vez, sin correlacionar IDs provider/runtime", voiceRuntime => {
    const local = [1, 2].map(event_id => ({ ...voiceMessage("local", "thread", { role: "user", source: "user", message: "Sí", event_id })!, voiceSessionId: "server-session", voiceRuntime }));
    const canonical = [1, 2].map(index => ({ messageId: `voice:server-session:provider:user:${index}`, role: "user", text: "Sí", channel: "voice" as const, status: "final" as const, revision: 1 }));
    const active = mergeChatHistory(local, canonical, "thread", new Map([["server-session", false]]));
    expect(active.map(message => message.id)).toEqual(local.map(message => message.id));
    const closed = mergeChatHistory(active, canonical, "thread", new Map([["server-session", true]]));
    expect(closed.map(message => message.id)).toEqual(canonical.map(message => message.messageId));
    expect(mergeChatHistory(closed, canonical, "thread", new Map([["server-session", true]]))).toHaveLength(2);
  });
  it("response_id no constituye un alias de messageId", () => {
    const local = voiceMessage("local", "thread", { role: "agent", source: "ai", message: "Sí", event_id: 1, response_id: "uuid" })!;
    expect(mergeChatHistory([local], [{ role: "bot", text: "Sí", messageId: "uuid", channel: "voice" }], "thread")).toHaveLength(2);
  });
});

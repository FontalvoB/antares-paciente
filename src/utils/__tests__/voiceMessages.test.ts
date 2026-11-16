import { describe, expect, it } from "vitest";
import { voiceMessage, upsertVoiceMessage } from "../voiceMessages";

describe("adaptador de mensajes de voz", () => {
  it("deduplica identidad, corrige y conserva dos textos iguales legítimos", () => {
    const payload = { role: "user" as const, source: "user" as const, message: "Sí", event_id: 1 };
    const first = voiceMessage("s1", "thread", payload)!;
    let messages = upsertVoiceMessage([], first);
    messages = upsertVoiceMessage(messages, first);
    expect(messages).toHaveLength(1);
    messages = upsertVoiceMessage(messages, { ...first, text: "Sí, por favor" });
    expect(messages[0].text).toBe("Sí, por favor");
    messages = upsertVoiceMessage(messages, voiceMessage("s1", "thread", { ...payload, event_id: 2 })!);
    expect(messages).toHaveLength(2);
    expect(voiceMessage("s2", "thread", payload)!.id).not.toBe(first.id);
  });
});

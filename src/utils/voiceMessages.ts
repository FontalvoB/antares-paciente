import type { ComponentProps } from "react";
import type { ConversationProvider } from "@elevenlabs/react";
import type { ChatMessage } from "../types";

// El adaptador consume callbacks públicos del SDK, nunca eventos del socket.
type Callbacks = ComponentProps<typeof ConversationProvider>;
export type VoiceMessagePayload = Parameters<NonNullable<Callbacks["onMessage"]>>[0];
export type VoiceCorrection = Parameters<NonNullable<Callbacks["onAgentResponseCorrection"]>>[0];

export function voiceMessage(sessionId: string, threadId: string, payload: VoiceMessagePayload): ChatMessage | null {
  const role = payload.role === "user" || payload.source === "user" ? "user" : "bot";
  if (typeof payload.message !== "string" || !payload.message.trim() || !Number.isFinite(payload.event_id)) return null;
  return {
    id: `voice:${sessionId}:${role}:${role === "bot" ? payload.response_id ?? payload.event_id : payload.event_id}`,
    role, text: payload.message, time: "", threadId,
    channel: "voice", delivery: "received", status: "final", revision: 0,
    providerEventId: payload.event_id, providerResponseId: payload.response_id,
    providerLocalId: `voice:${sessionId}:${role}:${role === "bot" ? payload.response_id ?? payload.event_id : payload.event_id}`,
  };
}

export function upsertVoiceMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const previous = messages.find(message => message.id === incoming.id || message.providerLocalId === incoming.id);
  if (previous) return messages.map(message => message === previous ? { ...message, ...incoming, id: message.id, messageId: message.messageId, time: message.time } : message);
  const withoutWelcome = messages.filter(message => message.id !== "welcome");
  return [...withoutWelcome, incoming];
}

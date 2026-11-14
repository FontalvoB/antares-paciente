import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { id: "fixture", nombre: "Alex" }, chat: [], hydrate: vi.fn(), prepend: vi.fn(), send: vi.fn() }));
vi.mock("../../context/AppContext", () => ({ useApp: () => ({ user: state.user, chat: state.chat, threadId: "fixture-thread", hydrateChat: state.hydrate, prependChatMessages: state.prepend, sendChat: state.send }) }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => (key: string) => key, useI18n: () => ({ t: (key: string) => key, lang: "es" }) }));
vi.mock("../../utils/threadApi", () => ({ fetchThreadState: vi.fn().mockResolvedValue(null), uploadLabExam: vi.fn() }));
vi.mock("../../components/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

describe("flag de compatibilidad de Nutrición en Vita", () => {
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
  it.each(["true", "false"])("VITE_CHAT_NUTRITION_ENABLED=%s controla chip y acción tipada", async flag => {
    vi.resetModules(); vi.stubEnv("VITE_CHAT_NUTRITION_ENABLED", flag);
    const { ChatPage } = await import("../ChatPage");
    const { normalizeVitaActions } = await import("../../utils/vitaActions");
    render(<ChatPage />);
    expect(Boolean(screen.queryByText("Nutrición"))).toBe(flag === "true");
    expect(normalizeVitaActions([{ type: "navigate", destination: "nutrition", localDate: "2026-11-14", resourceVersion: "revision" }])).toHaveLength(flag === "true" ? 1 : 0);
  }, 20000);
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "../BottomNav";

// Estado mutable compartido con el mock de AppContext (vi.mock se hoistea).
const mockCtx = vi.hoisted(() => ({
  chatUnread: false as boolean,
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    screen: "home",
    navigate: vi.fn(),
    openPanic: vi.fn(),
    chatUnread: mockCtx.chatUnread,
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
}));

describe("BottomNav — unread chat indicator", () => {
  beforeEach(() => {
    mockCtx.chatUnread = false;
  });

  it("hides the dot when chatUnread is false", () => {
    render(<BottomNav />);
    expect(screen.queryByLabelText("Nuevos mensajes")).toBeNull();
  });

  it("shows the dot with an accessible label when chatUnread is true", () => {
    mockCtx.chatUnread = true;
    render(<BottomNav />);
    const dot = screen.getByLabelText("Nuevos mensajes");
    expect(dot).toBeTruthy();
  });

  it("only shows the dot on the Chat item, not on other tabs", () => {
    mockCtx.chatUnread = true;
    const { container } = render(<BottomNav />);
    const dots = container.querySelectorAll(".ni-dot");
    expect(dots.length).toBe(1);
    const chatItem = dots[0]?.closest("button");
    expect(chatItem?.textContent).toContain("Chat");
  });
});
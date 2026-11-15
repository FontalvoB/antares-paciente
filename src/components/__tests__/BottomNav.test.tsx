import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ButtonHTMLAttributes } from 'react';
import { BottomNav } from "../BottomNav";

// Estado mutable compartido con el mock de AppContext (vi.mock se hoistea).
const mockCtx = vi.hoisted(() => ({
  chatUnread: false as boolean,
  openVoice: vi.fn(),
  openPanic: vi.fn(),
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    screen: "home",
    navigate: vi.fn(),
    openPanic: mockCtx.openPanic,
    openVoice: mockCtx.openVoice,
    chatUnread: mockCtx.chatUnread,
  }),
}));

// El botón Stencil se verifica en Playwright; aquí se comprueban los callbacks del shell.
vi.mock('@ionic/react', async importOriginal => ({
  ...await importOriginal<typeof import('@ionic/react')>(),
  IonButton: ({children,onClick,'aria-label':label}:ButtonHTMLAttributes<HTMLButtonElement>) => <button onClick={onClick} aria-label={label}>{children}</button>,
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
}));

describe("BottomNav — unread chat indicator", () => {
  it('Vita abre la voz y conserva el acceso a SOS', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button',{name:'Hablar con Vita'}));
    expect(mockCtx.openVoice).toHaveBeenCalledOnce();
    expect(mockCtx.openPanic).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Botón de pánico'}));
    expect(mockCtx.openPanic).toHaveBeenCalledOnce();
  });
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

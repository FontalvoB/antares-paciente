import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ButtonHTMLAttributes } from 'react';
import { BottomNav } from "../BottomNav";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

function renderNav() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BottomNav /></QueryClientProvider>);
}

describe("BottomNav — unread chat indicator", () => {
  it('SOS central abre el pánico y la barra no muestra un SOS flotante aparte', () => {
    const { container } = renderNav();
    expect(screen.queryByRole('button',{name:'Hablar con Vita'})).toBeNull();
    expect(screen.getAllByRole('button',{name:'Abrir SOS de emergencia'})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'Abrir SOS de emergencia'}));
    expect(mockCtx.openPanic).toHaveBeenCalledOnce();
    expect(container.querySelector('.premium-sos')).toBeNull();
  });
  beforeEach(() => {
    mockCtx.chatUnread = false;
  });

  it("hides the dot when chatUnread is false", () => {
    renderNav();
    expect(screen.queryByLabelText("Nuevos mensajes")).toBeNull();
  });

  it("shows the dot with an accessible label when chatUnread is true", () => {
    mockCtx.chatUnread = true;
    renderNav();
    const dot = screen.getByLabelText("Nuevos mensajes");
    expect(dot).toBeTruthy();
  });

  it("only shows the dot on the Chat item, not on other tabs", () => {
    mockCtx.chatUnread = true;
    const { container } = renderNav();
    const dots = container.querySelectorAll(".ni-dot");
    expect(dots.length).toBe(1);
    const chatItem = dots[0]?.closest("button");
    expect(chatItem?.textContent).toContain("Chat");
  });
});

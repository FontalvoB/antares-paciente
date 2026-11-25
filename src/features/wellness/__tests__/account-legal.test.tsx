import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountLegalPrompt, useAccountLegalAccess } from "../privacy/AccountLegalGate";

const state = vi.hoisted(() => ({ apiFetch: vi.fn(), logout: vi.fn(), account: "account-a" }));

vi.mock("../../../utils/apiClient", () => ({ apiFetch: state.apiFetch, ApiError: Error }));
vi.mock("../../../utils/authApi", () => ({ getAccessToken: () => "fixture-token" }));
vi.mock("../../../utils/sessionIdentity", () => ({ sessionUserId: () => state.account }));
vi.mock("../../../utils/legalConsents", () => ({ createConsentRequestKey: () => "test-request" }));
vi.mock("../../../context/AppContext", () => ({ useApp: () => ({ logout: state.logout }) }));
vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", t: (value: string) => value }),
}));
vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@ionic/react", () => ({
  IonButton: ({ children, disabled, onClick }: {
    children: ReactNode; disabled?: boolean; onClick: () => void;
  }) => <button disabled={disabled} onClick={onClick}>{children}</button>,
  IonCheckbox: ({ children, checked, disabled, onIonChange }: {
    children: ReactNode; checked: boolean; disabled?: boolean;
    onIonChange: (event: { detail: { checked: boolean } }) => void;
  }) => <label><input type="checkbox" checked={checked} disabled={disabled}
    onChange={event => onIonChange({ detail: { checked: event.target.checked } })} />{children}</label>,
  IonSpinner: () => <span />,
}));

function status(accepted: boolean, versionId = "current-terms") {
  return {
    locale: "es", enforcementEnabled: true, acceptanceRequired: !accepted,
    documents: [{
      scope: "account-terms", receiptId: accepted ? "receipt" : null,
      document: { title: "Términos publicados", versionId, version: "2.0", locale: "es", content: "Texto exacto" },
    }],
  };
}

function Application({ active }: { active: boolean }) {
  const access = useAccountLegalAccess(active);
  return access.canEnter ? <p>Inicio de prueba</p> : <AccountLegalPrompt access={access} />;
}

describe("documentos legales de cuenta", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ENFORCE_ACCOUNT_LEGAL_CONSENTS", "true");
    state.account = "account-a";
    state.apiFetch.mockReset();
    state.logout.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("pide únicamente la versión pendiente y vuelve a Inicio en la misma cuenta", async () => {
    state.apiFetch.mockResolvedValueOnce(status(false))
      .mockResolvedValueOnce({ id: "receipt" }).mockResolvedValueOnce(status(true));
    const queryClient = new QueryClient();
    render(<QueryClientProvider client={queryClient}><Application active /></QueryClientProvider>);
    expect(screen.queryByText("Inicio de prueba")).toBeNull();
    expect(await screen.findByText("Texto exacto")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Aceptar y continuar" }));
    expect(await screen.findByText("Inicio de prueba")).toBeTruthy();
    expect(state.apiFetch).toHaveBeenNthCalledWith(2, "/api/v1/me/account-legal-consents/acceptances",
      expect.objectContaining({
        expectedUserId: "account-a",
        body: { versionId: "current-terms", locale: "es", idempotencyKey: "test-request" },
      }));
    expect(state.logout).not.toHaveBeenCalled();
  });

  it("cambia de cuenta sin reutilizar la autorización anterior y ofrece reintento ante fallo", async () => {
    state.apiFetch.mockResolvedValueOnce(status(true)).mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce(status(false, "terms-b"));
    const queryClient = new QueryClient();
    const app = () => <QueryClientProvider client={queryClient}><Application active /></QueryClientProvider>;
    const view = render(app());
    expect(await screen.findByText("Inicio de prueba")).toBeTruthy();
    state.account = "account-b";
    view.rerender(app());
    expect(screen.queryByText("Inicio de prueba")).toBeNull();
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Texto exacto")).toBeTruthy();
    await waitFor(() => expect(state.apiFetch).toHaveBeenLastCalledWith("/api/v1/me/account-legal-consents?locale=en",
      expect.objectContaining({ expectedUserId: "account-b" })));
  });

  it("comprueba la sesión al restaurar y vuelve a pedir la versión si cambia mientras se lee", async () => {
    const changed = Object.assign(new Error("Version changed"), { code: "ACCOUNT_LEGAL_VERSION_CHANGED" });
    const next = status(false, "new-terms");
    const privacy = { ...next.documents[0], scope: "account-privacy", document: {
      ...next.documents[0].document, versionId: "current-privacy", title: "Privacidad publicada", content: "Texto privado",
    } };
    state.apiFetch.mockResolvedValueOnce(status(false)).mockRejectedValueOnce(changed)
      .mockResolvedValueOnce({ ...next, documents: [...next.documents, privacy] })
      .mockResolvedValueOnce({ id: "terms-receipt" }).mockResolvedValueOnce({ ...next, documents: [privacy] })
      .mockResolvedValueOnce({ id: "privacy-receipt" }).mockResolvedValueOnce(status(true));
    const queryClient = new QueryClient();
    const app = (active: boolean) => <QueryClientProvider client={queryClient}><Application active={active} /></QueryClientProvider>;
    const view = render(app(false));
    expect(state.apiFetch).not.toHaveBeenCalled();
    view.rerender(app(true));
    expect(await screen.findByText("Texto exacto")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Documentos de la cuenta" }));

    const accept = () => {
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Aceptar y continuar" }));
    };
    accept();
    await waitFor(() => expect(state.apiFetch).toHaveBeenCalledTimes(3));
    await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false));
    accept();
    expect(await screen.findByText("Texto privado")).toBeTruthy();
    accept();
    expect(await screen.findByText("Inicio de prueba")).toBeTruthy();
    expect(state.apiFetch).toHaveBeenNthCalledWith(4, expect.stringContaining("/acceptances"),
      expect.objectContaining({ body: expect.objectContaining({ versionId: "new-terms" }) }));
    expect(state.apiFetch).toHaveBeenNthCalledWith(6, expect.stringContaining("/acceptances"),
      expect.objectContaining({ body: expect.objectContaining({ versionId: "current-privacy" }) }));
  });
});

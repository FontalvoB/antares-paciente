import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { LegalConsentProvider, useLegalConsents } from "../LegalConsentContext";
import { consentFailure, requireLegalConsent, type LegalConsentRequirement } from "../../utils/legalConsents";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const modal = vi.hoisted(() => ({ dismiss: null as (() => void) | null }));
vi.mock("../../utils/apiClient", async original => ({ ...await original<object>(), apiFetch: api.fetch }));
vi.mock("../../i18n/I18nContext", () => ({ useI18n: () => ({ lang: "es", t: (source: string, params?: Record<string, string>) => Object.entries(params ?? {}).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), source) }) }));
vi.mock("@ionic/react", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    IonModal: ({ isOpen, children, onDidDismiss }: { isOpen: boolean; children: ReactNode; onDidDismiss: () => void }) => {
      if (isOpen) modal.dismiss = onDidDismiss;
      return isOpen ? <div role="dialog">{children}</div> : null;
    },
    IonContent: Box, IonHeader: Box, IonToolbar: Box, IonTitle: Box, IonList: Box, IonLabel: Box, IonSpinner: () => <span />,
    IonItem: ({ children, button, onClick }: { children: ReactNode; button?: boolean; onClick?: () => void }) => button ? <button onClick={onClick}>{children}</button> : <div>{children}</div>,
    IonButton: ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => <button disabled={disabled} onClick={onClick}>{children}</button>,
    IonCheckbox: ({ children, checked, disabled, onIonChange }: { children: ReactNode; checked: boolean; disabled: boolean; onIonChange: (event: { detail: { checked: boolean } }) => void }) => <label><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onIonChange({ detail: { checked: event.target.checked } })} />{children}</label>,
  };
});

const requirement = (patch: Partial<LegalConsentRequirement> = {}): LegalConsentRequirement => ({
  scope: "food", available: true, accepted: false, disclosureId: "a".repeat(64), providers: ["Synthetic recipient"], receiptId: null, acceptedAt: null,
  documents: [{ code: "synthetic", versionId: "version-1", version: "1", title: "Synthetic heading", content: '<img src=x onerror="window.bad=1">Synthetic legal test text', locale: "es", publishedAt: "2026-01-01T00:00:00Z" }],
  ...patch,
});
const result = (scope = requirement()) => ({ locale: "es", scopes: [scope] });
function Harness({ repeat }: { repeat?: boolean }) {
  const { openPrivacyChoices } = useLegalConsents();
  const [outcome, setOutcome] = useState("");
  return <>
    <button onClick={() => { void requireLegalConsent("food", "es").then(() => repeat ? requireLegalConsent("food", "es") : undefined).then(() => setOutcome("provider-ready")).catch(() => setOutcome("cancelled")); }}>analyze</button>
    <button onClick={openPrivacyChoices}>choices</button>
    <span data-testid="outcome">{outcome}</span>
  </>;
}
function show(repeat = false) { return render(<LegalConsentProvider><Harness repeat={repeat} /></LegalConsentProvider>); }
beforeEach(() => { api.fetch.mockReset(); localStorage.clear(); });
afterEach(cleanup);

describe("contextual legal consent", () => {
  it("shows actual provider/document text safely, with an unchecked choice and cancel", async () => {
    api.fetch.mockResolvedValue(result());
    const { container } = show(); fireEvent.click(screen.getByText("analyze"));
    await screen.findByText("Synthetic recipient");
    expect(container.textContent).toContain('<img src=x onerror="window.bad=1">');
    expect(container.querySelector("img")).toBeNull();
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByText("Aceptar autorización") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByText("Cancelar")[0]);
    await waitFor(() => expect(screen.getByTestId("outcome").textContent).toBe("cancelled"));
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not offer acceptance for missing approved documents and permits retry", async () => {
    api.fetch.mockResolvedValue(result(requirement({ available: false, documents: [], disclosureId: null })));
    show(); fireEvent.click(screen.getByText("analyze"));
    await screen.findByText("La autorización aprobada todavía no está disponible. Esta función no puede iniciarse.");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("Aceptar autorización")).toBeNull();
    fireEvent.click(screen.getByText("Volver a comprobar"));
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("outcome").textContent).toBe("");
  });

  it("a changed document is presented again without inheriting the previous checkbox", async () => {
    const changed = requirement({ documents: [{ ...requirement().documents[0], versionId: "version-2", version: "2", content: "New synthetic version" }] });
    api.fetch.mockResolvedValueOnce(result()).mockRejectedValueOnce(consentFailure("DOCUMENT_VERSION_CHANGED", 409)).mockResolvedValueOnce(result(changed));
    show(); fireEvent.click(screen.getByText("analyze"));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByText("Aceptar autorización"));
    await screen.findByText("New synthetic version");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByText("Aceptar autorización") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("outcome").textContent).toBe("");
  });

  it("reuses the same acceptance key after a network failure and waits for GET confirmation", async () => {
    api.fetch.mockResolvedValueOnce(result()).mockRejectedValueOnce(new TypeError("network failed after POST"))
      .mockResolvedValueOnce({ id: "receipt" }).mockResolvedValueOnce(result(requirement({ accepted: true, receiptId: "receipt" })));
    show(); fireEvent.click(screen.getByText("analyze"));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByText("Aceptar autorización"));
    await screen.findByText("No pudimos comprobar tu autorización. Intenta de nuevo.");
    expect(screen.getByTestId("outcome").textContent).toBe("");
    fireEvent.click(screen.getByText("Aceptar autorización"));
    await waitFor(() => expect(screen.getByTestId("outcome").textContent).toBe("provider-ready"));
    const posts = api.fetch.mock.calls.filter(call => call[1]?.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0][1].body.idempotencyKey).toBe(posts[1][1].body.idempotencyKey);
  });

  it("withdraws an old receipt even while its replacement document is unavailable", async () => {
    api.fetch.mockResolvedValueOnce(result(requirement({ available: false, documents: [], receiptId: "own-old-receipt" })))
      .mockResolvedValueOnce(undefined).mockResolvedValueOnce(result(requirement({ available: false, documents: [], receiptId: null })));
    show(); fireEvent.click(screen.getByText("choices"));
    fireEvent.click(await screen.findByText("Análisis de fotos de alimentos"));
    fireEvent.click(screen.getByText("Retirar autorización"));
    await waitFor(() => expect(api.fetch).toHaveBeenCalledWith("/api/v1/me/legal-consents/acceptances/own-old-receipt", expect.objectContaining({ method: "DELETE", expectedUserId: null })));
    await waitFor(() => expect(screen.queryByText("Retirar autorización")).toBeNull());
  });

  it("el onDidDismiss tardío de una aceptación no cancela la comprobación siguiente", async () => {
    const accepted = result(requirement({ accepted: true, receiptId: "receipt" }));
    let finish!: (value: typeof accepted) => void;
    api.fetch.mockResolvedValueOnce(result()).mockResolvedValueOnce({ id: "receipt" }).mockResolvedValueOnce(accepted)
      .mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    show(true); fireEvent.click(screen.getByText("analyze"));
    fireEvent.click(await screen.findByRole("checkbox"));
    const oldDismiss = modal.dismiss!;
    fireEvent.click(screen.getByText("Aceptar autorización"));
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(4));
    oldDismiss();
    finish(accepted);
    await waitFor(() => expect(screen.getByTestId("outcome").textContent).toBe("provider-ready"));
  });
});

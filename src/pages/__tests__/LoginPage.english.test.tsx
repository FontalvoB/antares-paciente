import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nProvider } from "../../i18n/I18nContext";
import { LoginPage } from "../LoginPage";

const api = vi.hoisted(() => ({ loginUser: vi.fn(), lookupId: vi.fn(), sendOtp: vi.fn(), verifyOtp: vi.fn(), sendRecoveryCode: vi.fn(), recoverPassword: vi.fn() }));
const app = vi.hoisted(() => ({ finishLogin: vi.fn(), showToast: vi.fn() }));
vi.mock("../../utils/authApi", () => api);
vi.mock("../../context/AppContext", () => ({ useApp: () => app }));
vi.mock("../../components/Mascot", () => ({ Mascot: () => null }));
vi.mock("../../components/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("../../components/SlideCtaButton", () => ({ SlideCtaButton: ({ label, onAct, disabled }: { label: string; onAct: () => void; disabled: boolean }) => <button disabled={disabled} onClick={onAct}>{label}</button> }));
vi.mock("framer-motion", () => ({ AnimatePresence: ({ children }: { children: ReactNode }) => children, motion: { div: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div> } }));
vi.mock("@ionic/react", () => ({
  IonButton: ({ children, onClick, "aria-label": ariaLabel }: { children: ReactNode; onClick: () => void; "aria-label"?: string }) => <button type="button" aria-label={ariaLabel} onClick={onClick}>{children}</button>,
  IonInput: ({ id, value, onIonInput }: { id: string; value: string; onIonInput: (event: { detail: { value: string } }) => void }) => <input id={id} value={value} onChange={event => onIonInput({ detail: { value: event.target.value } })} />,
  IonCheckbox: () => <input type="checkbox" />,
  IonSpinner: () => null, IonIcon: () => null, IonProgressBar: () => null,
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.setItem("antares_lang", "en");
  api.lookupId.mockResolvedValue({ firstName: "María", lastName: "García", documentNumber: "QA-ID", contacts: [{ id: "email-id", type: "Email", label: "ma•••@example.invalid" }, { id: "phone-id", type: "Phone", label: "+57•••4567" }] });
  api.sendOtp.mockResolvedValue({ expiresInSeconds: 300 });
  api.sendRecoveryCode.mockResolvedValue({ expiresInSeconds: 300 });
  api.recoverPassword.mockResolvedValue(undefined);
  api.verifyOtp.mockResolvedValue({});
});
const renderLogin = () => render(<I18nProvider><LoginPage /></I18nProvider>);

describe("English account access", () => {
  it("localizes a rejected backend login without exposing its Spanish response", async () => {
    api.loginUser.mockRejectedValue(new Error("Credenciales inválidas"));
    renderLogin();
    fireEvent.change(screen.getByLabelText("ID number"), { target: { value: "QA-ID" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Example123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Let's begin" }));
    await waitFor(() => expect(app.showToast).toHaveBeenCalledWith("Invalid credentials", "err"));
  });
  it("requests recovery email in the current English UI language", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    fireEvent.change(screen.getByLabelText("ID number"), { target: { value: "QA-ID" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm identity" }));
    await screen.findByText("We found 2 contact methods linked to your ID.");
    fireEvent.click(screen.getAllByRole("radio")[0]);
    await screen.findByLabelText("Digit 1");
    expect(api.sendRecoveryCode).toHaveBeenCalledWith("QA-ID", "email-id", "en");
    fireEvent.change(screen.getByLabelText("Digit 1"), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Example123!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Example123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(api.recoverPassword).toHaveBeenCalledWith("QA-ID", "email-id", "123456", "Example123!", "en"));
  });

  it("localizes the full contact count sentence and preserves identity and contact IDs", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Activate your account" }));
    fireEvent.change(screen.getByLabelText("ID number"), { target: { value: "QA-ID" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm identity" }));
    await screen.findByText("We found 2 contact methods linked to your ID.");
    expect(screen.getByText("María García")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    await screen.findByLabelText("Digit 1");
    fireEvent.change(screen.getByLabelText("Digit 1"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enter" }));
    await waitFor(() => expect(app.finishLogin).toHaveBeenCalledWith({ nombre: "María García", cedula: "QA-ID" }));
    expect(api.sendOtp).toHaveBeenCalledWith("QA-ID", "email-id", "en");
    expect(api.verifyOtp).toHaveBeenCalledWith("QA-ID", "123456", true);
  });
});

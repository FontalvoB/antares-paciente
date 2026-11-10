import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnboardingPage } from "../OnboardingPage";
import { consentFailure, requireLegalConsent } from "../../utils/legalConsents";
vi.mock("../../utils/legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined), verifyLegalConsent: vi.fn().mockResolvedValue({ accepted: true }) }));

// Los overlays nativos de Ionic requieren navegador; aquí verificamos sus props.
vi.mock("@ionic/react", async importOriginal => ({
  ...await importOriginal<object>(),
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? <div>{children}</div> : null,
  IonDatetime: ({ locale }: { locale: string }) => <div data-testid="onboarding-date" data-locale={locale} />,
}));

const state = vi.hoisted(() => ({ lang: "es" as "es" | "en", toast: vi.fn(), insurers: vi.fn(), profile: vi.fn(), update: vi.fn(), finish: vi.fn() }));
vi.mock("../../context/AppContext", () => ({ useApp: () => ({ finishOnboarding: state.finish, showToast: state.toast, backToLogin: vi.fn() }) }));
vi.mock("../../i18n/I18nContext", async () => {
  const { default: english } = await import("../../i18n/en.json");
  const t = (key: string, params?: Record<string, string>) => {
    let text = state.lang === "en" ? (english as Record<string, string>)[key] ?? key : key;
    for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, value);
    return text;
  };
  return { useT: () => t, useI18n: () => ({ t, lang: state.lang }) };
});
vi.mock("../../components/Mascot", () => ({ Mascot: () => <span>Vita</span> }));
vi.mock("../../utils/authApi", () => ({ setFirstPassword: vi.fn() }));
vi.mock("../../utils/patientProfileApi", async importOriginal => ({ ...await importOriginal<object>(), fetchMyPatientProfile: state.profile, fetchInsurers: state.insurers, updateMyPatientProfile: state.update }));

beforeEach(() => {
  cleanup();
  state.lang = "es";
  vi.clearAllMocks();
  state.insurers.mockResolvedValue([{ id: "insurer-id", name: "Aseguradora real" }]);
  state.profile.mockRejectedValue(new Error("first access"));
  vi.mocked(requireLegalConsent).mockResolvedValue(undefined);
});
const enter = (id: string, value: string) => fireEvent(document.getElementById(id)!, new CustomEvent("ionInput", { detail: { value }, bubbles: true }));
const next = () => fireEvent.click(screen.getByText("Continuar"));

describe("onboarding requirements", () => {
  it("puts no insurance first and selects it by default", async () => {
    render(<OnboardingPage />);
    await screen.findByText("Aseguradora real");
    const select = document.querySelector("ion-select")!;
    const first = select.querySelector("ion-select-option")! as HTMLIonSelectOptionElement;
    expect(first.textContent).toBe("Sin seguro médico");
    expect(first.value).toBe("");
    expect((select as HTMLIonSelectElement).value).toBe("");
  });
  it("requires the first contact and allows the second to remain empty", async () => {
    render(<OnboardingPage />);
    next();
    next();
    expect(state.toast).toHaveBeenCalledWith("El contacto principal requiere nombre y teléfono.", "err");
    enter("onb-fam-name", "Ana");
    enter("onb-fam-cel", "+573001234567");
    next();
    await screen.findByText("Consentimiento informado");
    expect(document.getElementById("onb-pwd")).toBeNull();
  });
  it("rejects a partial backup contact instead of losing those details", () => {
    render(<OnboardingPage />);
    next();
    enter("onb-fam-name", "Ana");
    enter("onb-fam-cel", "+573001234567");
    fireEvent.click(screen.getByText("Añadir contacto opcional"));
    enter("onb-fam2-name", "Luis");
    next();
    expect(state.toast).toHaveBeenCalledWith("Completa el nombre y el teléfono del segundo contacto o déjalo vacío.", "err");
    expect(screen.queryByText("Consentimiento informado")).toBeNull();
  });
  it("continues only after the shared flow confirms a server program receipt", async () => {
    render(<OnboardingPage />);
    next();
    enter("onb-fam-name", "Ana");
    enter("onb-fam-cel", "+573001234567");
    next();
    expect(document.querySelectorAll("ion-checkbox")).toHaveLength(0);
    expect(screen.queryByText(/HIPAA/)).toBeNull();
    next();
    await waitFor(() => expect(document.getElementById("onb-pwd")).toBeTruthy());
    expect(requireLegalConsent).toHaveBeenCalledWith("program", "es");
    expect(state.update).not.toHaveBeenCalled();
  });
  it("does not claim accepted program consent when approved text is unavailable", async () => {
    vi.mocked(requireLegalConsent).mockRejectedValueOnce(consentFailure("CONSENT_DOCUMENT_UNAVAILABLE", 503));
    render(<OnboardingPage />); next();
    enter("onb-fam-name", "Ana"); enter("onb-fam-cel", "+573001234567"); next(); next();
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith("La autorización aprobada todavía no está disponible. Esta función no puede iniciarse.", "warn"));
    expect(document.getElementById("onb-pwd")).toBeNull();
    expect(state.finish).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });
});


describe("onboarding English presentation", () => {
  it("localizes personal details, SOS relationship and date picker without changing form values", async () => {
    state.lang = "en";
    render(<OnboardingPage />);
    expect(screen.getByText("Personal details")).toBeTruthy();
    expect(screen.getByText("As shown on your ID")).toBeTruthy();
    // Aseguradoras y nombres propios siguen siendo los valores del servidor.
    await screen.findByText("Aseguradora real");
    fireEvent.click(screen.getByText("Continue"));
    enter("onb-fam-name", "Ana Torres");
    enter("onb-fam-cel", "3001234567");
    const relationship = document.getElementById("onb-fam-relationship")!;
    fireEvent(relationship, new CustomEvent("ionChange", { detail: { value: "Esposo/a" } }));
    expect((relationship as HTMLIonSelectElement).value).toBe("Esposo/a");
    expect(screen.getByText("Spouse")).toBeTruthy();
    expect(screen.getByText(/Ana Torres \(Spouse\) will receive an alert/)).toBeTruthy();
    fireEvent.click(screen.getByText("Go back"));
    fireEvent.click(document.getElementById("onb-dob")!);
    expect(screen.getByTestId("onboarding-date").getAttribute("data-locale")).toBe("en-US");
  });
});

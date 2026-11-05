import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnboardingPage } from "../OnboardingPage";

const state = vi.hoisted(() => ({ toast: vi.fn(), insurers: vi.fn(), profile: vi.fn(), update: vi.fn(), finish: vi.fn() }));
vi.mock("../../context/AppContext", () => ({ useApp: () => ({ finishOnboarding: state.finish, showToast: state.toast, backToLogin: vi.fn() }) }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => (key: string) => key }));
vi.mock("../../components/Mascot", () => ({ Mascot: () => <span>Vita</span> }));
vi.mock("../../utils/authApi", () => ({ setFirstPassword: vi.fn() }));
vi.mock("../../utils/patientProfileApi", async importOriginal => ({ ...await importOriginal<object>(), fetchMyPatientProfile: state.profile, fetchInsurers: state.insurers, updateMyPatientProfile: state.update }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.insurers.mockResolvedValue([{ id: "insurer-id", name: "Aseguradora real" }]);
  state.profile.mockRejectedValue(new Error("first access"));
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
  it("enables consent controls only after the document end, then requires all acceptances", async () => {
    render(<OnboardingPage />);
    next();
    enter("onb-fam-name", "Ana");
    enter("onb-fam-cel", "+573001234567");
    next();
    const checkboxes = Array.from(document.querySelectorAll("ion-checkbox")) as HTMLIonCheckboxElement[];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every(checkbox => checkbox.disabled)).toBe(true);
    const region = screen.getByRole("region");
    Object.defineProperties(region, { clientHeight: { value: 180 }, scrollHeight: { value: 400 }, scrollTop: { value: 220 } });
    fireEvent.scroll(region);
    await waitFor(() => expect(checkboxes.every(checkbox => !checkbox.disabled)).toBe(true));
    expect((screen.getByText("Continuar") as HTMLIonButtonElement).disabled).toBe(true);
    for (const checkbox of checkboxes) fireEvent(checkbox, new CustomEvent("ionChange", { detail: { checked: true }, bubbles: true }));
    expect((screen.getByText("Continuar") as HTMLIonButtonElement).disabled).toBe(false);
    next();
    expect(document.getElementById("onb-pwd")).toBeTruthy();
    expect(state.update).not.toHaveBeenCalled();
  });
});

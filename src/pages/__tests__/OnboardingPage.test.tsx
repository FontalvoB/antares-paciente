import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { OnboardingPage } from "../OnboardingPage";
import { MOCK_ACCOUNT } from "../../features/wellness/services/wellness-onboarding-service";

const state = vi.hoisted(() => ({
  finish: vi.fn(),
  back: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    finishWellnessOnboarding: state.finish,
    backToLogin: state.back,
    showToast: state.toast,
  }),
}));

vi.mock("../../i18n/I18nContext", async () => {
  const { default: english } = await import("../../i18n/en.json");
  const t = (key: string, params?: Record<string, string>) => {
    let text = (english as Record<string, string>)[key] ?? key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, value);
    }
    return text;
  };
  return { useT: () => t, useI18n: () => ({ t, lang: "en" as const }) };
});

const ionInput = (name: string, value: string) => {
  const element = document.querySelector(`ion-input[name="${name}"]`);
  if (!element) throw new Error(`ion-input[name="${name}"] not found`);
  fireEvent(
    element,
    new CustomEvent("ionInput", { detail: { value }, bubbles: true }),
  );
};

const submitForm = () => {
  const form = document.querySelector("form");
  if (!form) throw new Error("form not found");
  fireEvent.submit(form);
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("onboarding Agentic Wellness (KAN-136)", () => {
  it("empieza por el correo y explica el cambio sin cédula", () => {
    render(<OnboardingPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Email");
    expect(
      screen.getByText("Sign in with your email. No ID number, no paperwork."),
    ).toBeTruthy();
  });

  it("no avanza con un correo inválido", async () => {
    render(<OnboardingPage />);
    ionInput("email", "no-es-correo");
    submitForm();
    await screen.findByText("Enter a valid email address.");
  });

  it("detecta una cuenta existente y pide contraseña en el mismo paso", async () => {
    render(<OnboardingPage />);
    ionInput("email", MOCK_ACCOUNT.email);
    submitForm();
    await screen.findByText(
      "An account already exists with this email. Enter your password.",
    );
    expect(document.querySelector('ion-input[name="password"]')).toBeTruthy();

    ionInput("password", "incorrecta");
    submitForm();
    await screen.findByText("Incorrect email or password.");

    ionInput("password", MOCK_ACCOUNT.password);
    submitForm();
    await screen.findByText("Emergency contacts");
  });

  it("recorre correo, emergencia, términos y contraseña hasta el objetivo", async () => {
    render(<OnboardingPage />);
    ionInput("email", "ana@example.com");
    submitForm();
    await screen.findByText("Emergency contacts");

    submitForm();
    expect(
      screen.getByText("Your primary contact needs a name and phone number."),
    ).toBeTruthy();

    const contactInputs = document.querySelectorAll(
      ".emergency-contact-card-primary ion-input",
    );
    fireEvent(
      contactInputs[0],
      new CustomEvent("ionInput", {
        detail: { value: "Ana Torres" },
        bubbles: true,
      }),
    );
    fireEvent(
      contactInputs[1],
      new CustomEvent("ionInput", {
        detail: { value: "3001234567" },
        bubbles: true,
      }),
    );
    submitForm();
    await screen.findByText("Wellness terms");

    const continueButton = screen
      .getAllByText("Continue")
      .map((node) => node.closest("ion-button"))
      .find((node): node is HTMLIonButtonElement => Boolean(node));
    expect((continueButton as unknown as { disabled: boolean }).disabled).toBe(
      true,
    );
    fireEvent(
      document.querySelector("ion-checkbox")!,
      new CustomEvent("ionChange", {
        detail: { checked: true },
        bubbles: true,
      }),
    );
    await waitFor(() =>
      expect(
        (continueButton as unknown as { disabled: boolean }).disabled,
      ).toBe(false),
    );
    fireEvent.click(continueButton!);
    await screen.findByText("Create your password");

    ionInput("new-password", "Segura123!");
    ionInput("confirm-password", "Segura123!");
    submitForm();
    await screen.findByText("Your goal");
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
  });

  it("mantiene el aviso de bienestar y emergencia visible", () => {
    render(<OnboardingPage />);
    expect(
      screen.getByText(
        /General wellness information\. Not medical advice\. In an emergency, call 911\./,
      ),
    ).toBeTruthy();
  });
});

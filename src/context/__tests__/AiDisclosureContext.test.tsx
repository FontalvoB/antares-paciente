import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { AiDisclosureProvider, useAiDisclosure } from "../AiDisclosureContext";
import {
  aiDisclosureAccepted,
  requireAiDisclosure,
  withdrawAiDisclosure,
} from "../../utils/aiDisclosure";

const auth = vi.hoisted(() => ({ token: "" }));
vi.mock("../../utils/authApi", () => ({
  getAccessToken: () => auth.token,
  onSessionInvalid: () => () => {},
}));
vi.mock("@capacitor/browser", () => ({
  Browser: { open: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "es",
    t: (source: string, params?: Record<string, string>) =>
      Object.entries(params ?? {}).reduce(
        (text, [key, value]) => text.replaceAll(`{${key}}`, value),
        source,
      ),
  }),
}));
vi.mock("@ionic/react", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    IonModal: ({
      isOpen,
      children,
    }: {
      isOpen: boolean;
      children: ReactNode;
    }) => (isOpen ? <div role="dialog">{children}</div> : null),
    IonHeader: Box,
    IonToolbar: Box,
    IonTitle: Box,
    IonContent: Box,
    IonList: Box,
    IonLabel: Box,
    IonItem: Box,
    IonIcon: () => <span />,
    IonButton: ({
      children,
      disabled,
      onClick,
    }: {
      children: ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }) => (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    IonCheckbox: ({
      children,
      checked,
      onIonChange,
    }: {
      children: ReactNode;
      checked: boolean;
      onIonChange: (event: { detail: { checked: boolean } }) => void;
    }) => (
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onIonChange({ detail: { checked: event.target.checked } })
          }
        />
        {children}
      </label>
    ),
  };
});

const tokenFor = (subject: string) =>
  `header.${btoa(JSON.stringify({ sub: subject }))}.signature`;

function Harness() {
  const { openAiDisclosure, accepted } = useAiDisclosure();
  const [outcome, setOutcome] = useState("");
  return (
    <>
      <button
        onClick={() => {
          void requireAiDisclosure("chat")
            .then(() => setOutcome("sent"))
            .catch((error) => setOutcome(error?.code ?? "error"));
        }}
      >
        ask
      </button>
      <button onClick={openAiDisclosure}>settings</button>
      <span data-testid="outcome">{outcome}</span>
      <span data-testid="accepted">{accepted ? "yes" : "no"}</span>
    </>
  );
}

const show = () =>
  render(
    <AiDisclosureProvider>
      <Harness />
    </AiDisclosureProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  auth.token = tokenFor("owner-a");
  withdrawAiDisclosure("owner-a");
});
afterEach(cleanup);

describe("AI disclosure modal", () => {
  it("blocks the request until the user checks the box and accepts", async () => {
    show();
    fireEvent.click(screen.getByText("ask"));
    await screen.findByText("Uso de inteligencia artificial");
    expect(screen.getByTestId("outcome").textContent).toBe("");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
    expect(
      (screen.getByText("Aceptar y continuar") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Aceptar y continuar"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome").textContent).toBe("sent"),
    );
    expect(aiDisclosureAccepted("owner-a")).toBe(true);
    expect(screen.getByTestId("accepted").textContent).toBe("yes");
    expect(screen.queryByText("Uso de inteligencia artificial")).toBeNull();
  });

  it("does not send and does not persist permission when the user declines", async () => {
    show();
    fireEvent.click(screen.getByText("ask"));
    await screen.findByText("Uso de inteligencia artificial");
    fireEvent.click(screen.getByText("No permitir"));
    await waitFor(() =>
      expect(screen.getByTestId("outcome").textContent).toBe(
        "CONSENT_CANCELLED",
      ),
    );
    expect(aiDisclosureAccepted("owner-a")).toBe(false);
    expect(screen.getByTestId("accepted").textContent).toBe("no");
  });

  it("does not ask again after acceptance and allows withdrawal from settings", async () => {
    show();
    fireEvent.click(screen.getByText("ask"));
    await screen.findByText("Uso de inteligencia artificial");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Aceptar y continuar"));
    await waitFor(() =>
      expect(screen.getByTestId("outcome").textContent).toBe("sent"),
    );

    fireEvent.click(screen.getByText("ask"));
    await waitFor(() =>
      expect(screen.getByTestId("outcome").textContent).toBe("sent"),
    );
    expect(screen.queryByText("Uso de inteligencia artificial")).toBeNull();

    fireEvent.click(screen.getByText("settings"));
    await screen.findByText("Uso de inteligencia artificial");
    expect(screen.getByText("Retirar permiso de IA")).toBeTruthy();
    fireEvent.click(screen.getByText("Retirar permiso de IA"));
    await waitFor(() => expect(aiDisclosureAccepted("owner-a")).toBe(false));
    expect(screen.getByTestId("accepted").textContent).toBe("no");
  });
});

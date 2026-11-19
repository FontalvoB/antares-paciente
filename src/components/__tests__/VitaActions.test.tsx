import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VitaActions } from "../chat/VitaActions";
import { ApiError } from "../../utils/apiClient";
import { toLocalISODate } from "../../utils/dates";
import { isComingSoonTask } from "../../data/program";

const mocks = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), tests: vi.fn(), toast: vi.fn(), comingSoon: vi.fn(), invalidate: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../data/program", async original => {
  const actual = await original<typeof import("../../data/program")>();
  mocks.comingSoon.mockImplementation(actual.isComingSoonTask);
  return { ...actual, isComingSoonTask: mocks.comingSoon };
});
vi.mock("../../utils/apiClient", async original => ({ ...await original<object>(), apiFetch: mocks.api }));
vi.mock("../../utils/legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../context/AppContext", () => ({ useApp: () => ({ navigate: mocks.navigate, openTests: mocks.tests, showToast: mocks.toast }) }));
vi.mock("../../utils/queryClient", () => ({ queryClient: { invalidateQueries: mocks.invalidate } }));
vi.mock("../../i18n/I18nContext", () => ({ useI18n: () => ({ lang: "es", t: (key: string) => key }) }));
vi.mock("@ionic/react", async () => {
  const React = await import("react");
  return {
    IonButton: ({ children, onClick, disabled }: any) => React.createElement("button", { onClick, disabled }, children),
    IonSpinner: () => null,
    IonAlert: ({ isOpen, header, message, buttons }: any) => isOpen ? React.createElement("div", { role: "dialog" }, header, message, buttons.map((button: any) => React.createElement("button", { key: button.text, onClick: button.handler }, button.text))) : null,
  };
});

const action = () => ({ type: "navigate" as const, destination: "podcast" as const, resourceId: "assigned-content", localDate: toLocalISODate(), resourceVersion: "a".repeat(64) });
const proposal = () => ({ proposalToken: "stable-synthetic-proposal", taskCode: "podcast", localDate: action().localDate, resourceVersion: action().resourceVersion, expiresAt: new Date(Date.now() + 60_000).toISOString(), requiresConfirmation: true });
const calls = (suffix: string) => mocks.api.mock.calls.filter(([path]) => String(path).includes(suffix));
const fixture = async (path: string) => {
  if (path.includes("/context?")) return { status: "ok", localDate: action().localDate, resourceVersion: action().resourceVersion, actions: [action()] };
  if (path.endsWith("proposals")) return proposal();
  if (path.endsWith("confirmations")) return { taskCompletionId: "canonical-completion" };
  throw new Error("Unexpected API path");
};

describe("acciones Vita y confirmación de actividad", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("copp_access_token", `header.${btoa(JSON.stringify({ sub: "owner-a" }))}.signature`);
    mocks.api.mockReset(); mocks.api.mockImplementation(fixture);
    mocks.invalidate.mockClear(); mocks.navigate.mockClear(); mocks.toast.mockClear();
    vi.mocked(isComingSoonTask).mockImplementation(() => false);
  });
  afterEach(cleanup);

  it.each([['podcast', 'Podcast'], ['exercise', 'Ejercicios']] as const)('bloquea la navegación y el registro de %s', async (destination, label) => {
    const policy = await vi.importActual<typeof import('../../data/program')>('../../data/program');
    vi.mocked(isComingSoonTask).mockImplementation(policy.isComingSoonTask);
    render(<VitaActions actions={[{ ...action(), destination }]} />);
    fireEvent.click(screen.getByText(label));
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith('Esta actividad estará disponible próximamente.', 'info');
    expect(screen.queryByText('Registrar que terminé')).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("navegar revalida la revisión, sin preparar ni completar una tarea", async () => {
    render(<VitaActions actions={[action()]} />);
    fireEvent.click(screen.getByText("Podcast"));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("program-podcast"));
    expect(calls("/context?")).toHaveLength(1);
    expect(calls("proposals")).toHaveLength(0);
    expect(calls("confirmations")).toHaveLength(0);
  });

  it("preparar y cancelar no completa ni concede XP", async () => {
    render(<VitaActions actions={[action()]} />);
    fireEvent.click(screen.getByText("Registrar que terminé"));
    await screen.findByRole("dialog");
    expect(calls("proposals")[0][1]).toMatchObject({ expectedUserId: "owner-a", body: { taskCode: "podcast", localDate: action().localDate, resourceVersion: action().resourceVersion } });
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls("confirmations")).toHaveLength(0);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("confirmación doble en vuelo produce un solo POST; éxito refresca la fuente canónica", async () => {
    let finish!: (value: unknown) => void;
    mocks.api.mockImplementation(path => path.endsWith("confirmations") ? new Promise(resolve => { finish = resolve; }) : fixture(path));
    render(<VitaActions actions={[action()]} />);
    fireEvent.click(screen.getByText("Registrar que terminé")); await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Confirmar")); fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => expect(calls("confirmations")).toHaveLength(1));
    await act(async () => finish({ taskCompletionId: "completion" }));
    await screen.findByText("Actividad registrada.");
    expect(calls("confirmations")[0][1]).toMatchObject({ expectedUserId: "owner-a", body: { proposalToken: "stable-synthetic-proposal", confirmed: true } });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["program"] });
    await waitFor(() => expect(calls("/context?")).toHaveLength(2));
    expect(calls("/context?")[1][0]).not.toContain("resourceVersion=");
  });

  it.each([403, 409, 503])("maneja %s sin confirmar ni presentar éxito", async status => {
    mocks.api.mockImplementation(path => path.endsWith("proposals") ? Promise.reject(new ApiError({ status, message: "synthetic failure" })) : fixture(path));
    render(<VitaActions actions={[action()]} />);
    fireEvent.click(screen.getByText("Registrar que terminé"));
    await screen.findByRole("status");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls("confirmations")).toHaveLength(0);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("un reintento de confirmación conserva el token idempotente", async () => {
    let attempts = 0;
    mocks.api.mockImplementation(path => path.endsWith("confirmations") && ++attempts === 1 ? Promise.reject(new ApiError({ status: 503, message: "synthetic" })) : fixture(path));
    render(<VitaActions actions={[action()]} />);
    fireEvent.click(screen.getByText("Registrar que terminé")); await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Confirmar")); await screen.findByRole("status");
    fireEvent.click(screen.getByText("Confirmar")); await screen.findByText("Actividad registrada.");
    expect(calls("confirmations").map(([, options]) => options.body.proposalToken)).toEqual(["stable-synthetic-proposal", "stable-synthetic-proposal"]);
  });

  it.each([403, 409])("confirmación %s retira la propuesta sin repetir ni conceder XP", async status => {
    mocks.api.mockImplementation(path => path.endsWith("confirmations") ? Promise.reject(new ApiError({ status, message: "synthetic" })) : fixture(path));
    render(<VitaActions actions={[action()]} />);
    fireEvent.click(screen.getByText("Registrar que terminé")); await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Confirmar")); await screen.findByRole("status");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls("confirmations")).toHaveLength(1);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("un cambio de cuenta descarta la propuesta que llega tarde", async () => {
    let finish!: (value: unknown) => void;
    mocks.api.mockImplementation(path => path.endsWith("proposals") ? new Promise(resolve => { finish = resolve; }) : fixture(path));
    const { rerender } = render(<VitaActions actions={[action()]} />);
    fireEvent.click(screen.getByText("Registrar que terminé"));
    await waitFor(() => expect(calls("proposals")).toHaveLength(1));
    localStorage.setItem("copp_access_token", `header.${btoa(JSON.stringify({ sub: "owner-b" }))}.signature`);
    rerender(<VitaActions actions={[action()]} />);
    await act(async () => finish(proposal()));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls("confirmations")).toHaveLength(0);
  });

  it("evaluaciones solo navega, sin ofrecer registrar respuestas o tareas", () => {
    render(<VitaActions actions={[{ ...action(), destination: "assessments" }]} />);
    expect(screen.queryByText("Registrar que terminé")).toBeNull();
  });
});

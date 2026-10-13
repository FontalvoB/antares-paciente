import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AppProvider, useApp } from "../AppContext";
import { I18nProvider } from "../../i18n/I18nContext";

vi.mock("../../utils/patientProfileApi", () => ({
  fetchMyPatientProfile: vi.fn().mockResolvedValue(null),
  toUserProfile: vi.fn(() => ({})),
}));

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  sendChatMessage: vi.fn(),
  streamChatMessage: vi.fn(),
}));

vi.mock("../../utils/authApi", () => ({
  restoreSession: vi.fn().mockResolvedValue(null),
  getMe: vi.fn().mockResolvedValue(null),
  getAccessToken: vi.fn(() => null),
  isAccessTokenExpired: vi.fn(() => false),
  logoutUser: vi.fn().mockResolvedValue(undefined),
  onSessionInvalid: vi.fn(() => () => {}),
}));

vi.mock("../../utils/appointmentsApi", () => ({
  hasRealSession: vi.fn(() => false),
  fetchMyAppointments: vi.fn().mockResolvedValue({ items: [] }),
  fetchMyRequests: vi.fn().mockResolvedValue([]),
  fetchMyContext: vi.fn().mockResolvedValue({ patient: null }),
  fetchProfessionalsCatalog: vi.fn().mockResolvedValue({ data: [] }),
  fetchSpecialties: vi.fn().mockResolvedValue([]),
  cancelAppointment: vi.fn(),
  createRequest: vi.fn(),
}));


import { hasRealSession, fetchMyContext } from "../../utils/appointmentsApi";
import { queryClient } from "../../utils/queryClient";
function Harness() {
  const { finishLogin, logout, authLoading, patientCareContext, refreshAppointments } = useApp();
  return <div>
    <span data-testid="patient">{patientCareContext?.patientId ?? "empty"}</span>
    <button onClick={() => void refreshAppointments()}>refresh</button>
    <span data-testid="ready">{String(!authLoading)}</span>
    <button onClick={() => finishLogin({ nombre: "Segundo paciente" }, "app")}>login</button>
    <button onClick={logout}>logout</button>
  </div>;
}

describe("cambio de paciente", () => {
  beforeEach(() => { queryClient.clear(); localStorage.clear(); vi.mocked(hasRealSession).mockReturnValue(false); });
  it("no reutiliza métricas del usuario anterior ni respuestas que lleguen tarde", async () => {
    render(<I18nProvider><AppProvider><Harness /></AppProvider></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    queryClient.setQueryData(["program", "metrics-history"], { patient: "primero", bmi: 31 });
    let resolveOld!: (value: unknown) => void;
    const pending = queryClient.fetchQuery({ queryKey: ["program", "snapshot"],
      queryFn: () => new Promise(resolve => { resolveOld = resolve; }) }).catch(() => undefined);
    fireEvent.click(screen.getByText("logout"));
    expect(queryClient.getQueryData(["program", "metrics-history"])).toBeUndefined();
    fireEvent.click(screen.getByText("login"));
    queryClient.setQueryData(["program", "snapshot"], { patient: "segundo", xp: 365 });
    resolveOld({ patient: "primero", xp: 1390 });
    await pending;
    expect(queryClient.getQueryData(["program", "snapshot"])).toEqual({ patient: "segundo", xp: 365 });
    expect(queryClient.getQueryData(["program", "metrics-history"])).toBeUndefined();
  });
  it("limpia el contexto de citas y descarta respuestas del paciente anterior", async () => {
    vi.mocked(hasRealSession).mockReturnValue(true);
    vi.mocked(fetchMyContext).mockResolvedValue({ patient: { id: "primero", organizationId: "org" } } as Awaited<ReturnType<typeof fetchMyContext>>);
    render(<I18nProvider><AppProvider><Harness /></AppProvider></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("patient").textContent).toBe("primero"));
    let resolveOld!: (value: Awaited<ReturnType<typeof fetchMyContext>>) => void;
    vi.mocked(fetchMyContext).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    fireEvent.click(screen.getByText("refresh"));
    fireEvent.click(screen.getByText("logout"));
    expect(screen.getByTestId("patient").textContent).toBe("empty");
    vi.mocked(fetchMyContext).mockResolvedValue({ patient: { id: "segundo", organizationId: "org" } } as Awaited<ReturnType<typeof fetchMyContext>>);
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("patient").textContent).toBe("segundo"));
    await act(async () => {
      resolveOld({ patient: { id: "primero", organizationId: "org" } } as Awaited<ReturnType<typeof fetchMyContext>>);
    });
    await waitFor(() => expect(screen.getByTestId("patient").textContent).toBe("segundo"));
  });

});

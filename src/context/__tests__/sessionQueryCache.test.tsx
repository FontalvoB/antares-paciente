import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AppProvider, useApp } from "../AppContext";
import { I18nProvider, useI18n } from "../../i18n/I18nContext";

vi.mock("../../utils/patientProfileApi", () => ({
  fetchMyPatientProfile: vi.fn().mockResolvedValue(null),
  toUserProfile: vi.fn(() => ({})),
}));

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  sendChatMessage: vi.fn(),
  streamChatMessage: vi.fn(),
}));

vi.mock("../../utils/pushNotifications", () => ({ unregisterPushDevice: vi.fn().mockResolvedValue(undefined) }));

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


import { hasRealSession, fetchMyContext, fetchProfessionalsCatalog, fetchSpecialties } from "../../utils/appointmentsApi";
import { getAccessToken, getMe, restoreSession, logoutUser } from "../../utils/authApi";
import { unregisterPushDevice } from "../../utils/pushNotifications";
import { queryClient } from "../../utils/queryClient";
function Harness() {
  const { finishLogin, logout, authLoading, user, patientCareContext, refreshAppointments, professionalsCatalog, specialties, chat } = useApp();
  const { setLang } = useI18n();
  return <div>
    <input aria-label="Draft" defaultValue="Unsent patient note" />
    <button onClick={() => setLang("en")}>English</button>
    <span data-testid="catalog">{JSON.stringify(professionalsCatalog)}</span>
    <span data-testid="specialties">{JSON.stringify(specialties)}</span>
    <span data-testid="chat">{chat.map(message => message.text).join("\n")}</span>
    <span data-testid="contact">{JSON.stringify(user)}</span>
    <span data-testid="patient">{patientCareContext?.patientId ?? "empty"}</span>
    <button onClick={() => void refreshAppointments()}>refresh</button>
    <span data-testid="ready">{String(!authLoading)}</span>
    <button onClick={() => finishLogin({ nombre: "Segundo paciente" }, "app")}>login</button>
    <button onClick={logout}>logout</button>
  </div>;
}

describe("cambio de paciente", () => {
  beforeEach(() => {
    queryClient.clear(); localStorage.clear();
    vi.mocked(hasRealSession).mockReturnValue(false);
    vi.mocked(restoreSession).mockResolvedValue(null);
    vi.mocked(getMe).mockResolvedValue(null);
    vi.mocked(getAccessToken).mockReturnValue(null);
    vi.mocked(fetchProfessionalsCatalog).mockReset().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 100, totalPages: 0 });
    vi.mocked(fetchSpecialties).mockReset().mockResolvedValue([]);
  });
  it("restaura la cuenta del wearable aunque /me falle al reabrir sin backend", async () => {
    const claims = { "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "patient-offline" };
    const token = `header.${btoa(JSON.stringify(claims))}.signature`;
    vi.mocked(restoreSession).mockResolvedValue({ accessToken: token, tokenType: "Bearer", expiresIn: 900 });
    render(<I18nProvider><AppProvider><Harness /></AppProvider></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(JSON.parse(screen.getByTestId("contact").textContent!).id).toBe("patient-offline");
    fireEvent.click(screen.getByText("logout"));
    expect(JSON.parse(screen.getByTestId("contact").textContent!).id).toBeFalsy();
  });

  it("inicia la limpieza del token push antes de cerrar auth sin esperar a la red", async () => {
    vi.mocked(unregisterPushDevice).mockImplementationOnce(() => new Promise(() => {}));
    render(<I18nProvider><AppProvider><Harness /></AppProvider></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    fireEvent.click(screen.getByText("logout"));
    expect(unregisterPushDevice).toHaveBeenCalled();
    expect(logoutUser).toHaveBeenCalled();
    expect(vi.mocked(unregisterPushDevice).mock.invocationCallOrder.at(-1)!).toBeLessThan(vi.mocked(logoutUser).mock.invocationCallOrder.at(-1)!);
  });

  it("identifica la cuenta al iniciar sesión sin esperar la consulta de perfil", async () => {
    render(<I18nProvider><AppProvider><Harness /></AppProvider></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    vi.mocked(getAccessToken).mockReturnValue(`header.${btoa(JSON.stringify({ sub: "patient-login" }))}.signature`);
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(JSON.parse(screen.getByTestId("contact").textContent!).id).toBe("patient-login"));
  });
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
    const blankProfile = JSON.parse(screen.getByTestId("contact").textContent!);
    expect(Object.values(blankProfile).every(value => value === "")).toBe(true);
    vi.mocked(fetchMyContext).mockResolvedValue({ patient: { id: "segundo", organizationId: "org" } } as Awaited<ReturnType<typeof fetchMyContext>>);
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("patient").textContent).toBe("segundo"));
    await act(async () => {
      resolveOld({ patient: { id: "primero", organizationId: "org" } } as Awaited<ReturnType<typeof fetchMyContext>>);
    });
    await waitFor(() => expect(screen.getByTestId("patient").textContent).toBe("segundo"));
  });

  it("recarga catálogos en inglés y descarta el español tardío sin desmontar el borrador", async () => {
    vi.mocked(hasRealSession).mockReturnValue(true);
    const catalog = (name: string): Awaited<ReturnType<typeof fetchProfessionalsCatalog>> => ({ data: [{
      id: "doctor", employeeId: "employee", fullName: "Ana Ruiz", professionalTypeName: "Physician",
      professionalTypeDisplayName: name, specialties: [], locations: [], clinicIds: [], status: "Active",
    }], total: 1, page: 1, pageSize: 100, totalPages: 1 });
    vi.mocked(fetchProfessionalsCatalog).mockResolvedValue(catalog("Médico"));
    vi.mocked(fetchSpecialties).mockResolvedValue([{ id: "specialty", name: "Medicina de familia" }] as Awaited<ReturnType<typeof fetchSpecialties>>);
    render(<I18nProvider><AppProvider><Harness /></AppProvider></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("catalog").textContent).toContain("Médico"));
    let resolveSpanish!: (value: Awaited<ReturnType<typeof fetchProfessionalsCatalog>>) => void;
    const beforeRefresh = vi.mocked(fetchProfessionalsCatalog).mock.calls.length;
    vi.mocked(fetchProfessionalsCatalog).mockImplementationOnce(() => new Promise(resolve => { resolveSpanish = resolve; }));
    fireEvent.click(screen.getByText("refresh"));
    await waitFor(() => expect(vi.mocked(fetchProfessionalsCatalog).mock.calls.length).toBeGreaterThan(beforeRefresh));
    vi.mocked(fetchProfessionalsCatalog).mockResolvedValue(catalog("Physician"));
    vi.mocked(fetchSpecialties).mockResolvedValue([{ id: "specialty", name: "Family medicine" }] as Awaited<ReturnType<typeof fetchSpecialties>>);
    const draft = screen.getByLabelText("Draft");
    fireEvent.click(screen.getByText("English"));
    await waitFor(() => expect(screen.getByTestId("specialties").textContent).toContain("Family medicine"));
    await act(async () => resolveSpanish(catalog("Médico antiguo")));
    expect(screen.getByTestId("catalog").textContent).toContain('"professionalTypeDisplayName":"Physician"');
    expect(screen.getByTestId("catalog").textContent).not.toContain("Médico");
    expect(screen.getByLabelText("Draft")).toBe(draft);
    expect(draft).toHaveProperty("value", "Unsent patient note");
    expect(screen.getByTestId("chat").textContent).not.toContain("Hola");
    fireEvent.click(screen.getByText("logout"));
    expect(screen.getByTestId("chat").textContent).not.toContain("Hola");
  });

});

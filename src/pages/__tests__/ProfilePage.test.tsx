import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "../ProfilePage";

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@ionic/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ionic/react")>()),
  IonModal: () => null,
}));

// framer-motion mockeado: las animaciones WAAPI en happy-dom generan
// AbortError/Unhandled Rejection que marcan el run como fallido aunque los
// tests pasen (mismo criterio que PanicOverlay.test.tsx).
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const strip = (props: Record<string, unknown>) => {
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileTap: _whileTap,
      whileHover: _whileHover,
      variants: _variants,
      ...rest
    } = props;
    return rest;
  };
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        function MotionComponent(props: Record<string, unknown>) {
          return React.createElement(tag, strip(props));
        },
    },
  );
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    MotionConfig: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: motionProxy,
    useReducedMotion: () => false,
  };
});

// Estado mutable compartido con los mocks (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  lang: "es" as "es" | "en",
}));

const navigateMock = vi.hoisted(() => vi.fn());
const openTestsMock = vi.hoisted(() => vi.fn());

// Mock del endpoint de perfil: el guardado del contacto de emergencia.
const profileMock = vi.hoisted(() => ({
  update: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../utils/patientProfileApi", () => ({
  updateMyPatientProfile: profileMock.update,
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    user: {
      nombre: "Marta Ríos",
      cedula: "10247381",
      email: "marta.rios@example.com",
      celular: "3001234567",
      dob: "1990-01-01",
      seguro: "",
      poliza: "",
      fam1Nombre: "Ana Torres",
      fam1Parentesco: "Madre",
      fam1Cel: "3009876543",
      fam1Email: "ana@example.com",
    },
    navigate: navigateMock,
    openPanic: vi.fn(),
    showToast: vi.fn(),
    logout: vi.fn(),
    openTests: openTestsMock,
    refreshPatientProfile: profileMock.refresh,
  }),
}));

vi.mock("../../i18n/I18nContext", async () => {
  const { default: english } = await import("../../i18n/en.json");
  return ({
  useI18n: () => ({
    lang: mockState.lang,
    toggleLang: vi.fn(),
    t: (key: string, params?: Record<string, string>) => {
      let out = mockState.lang === "en" ? (english as Record<string, string>)[key] ?? key : key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          out = out.split(`{${k}}`).join(v);
        }
      }
      return out;
    },
  }),
  useT: () => (key: string) => key,
});
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe("ProfilePage v5.1", () => {
  beforeEach(() => {
    mockState.lang = "es";
    navigateMock.mockClear();
    openTestsMock.mockClear();
    profileMock.update.mockReset().mockResolvedValue({});
    profileMock.refresh.mockReset().mockResolvedValue(undefined);
  });

  it("muestra los datos y las secciones de bienestar del mapa", () => {
    renderPage();

    expect(screen.getByText("Marta Ríos")).toBeTruthy();
    expect(screen.getByText("10247381")).toBeTruthy();
    expect(screen.getByLabelText("Mi Avatar")).toBeTruthy();
    expect(screen.getByText("Cuenta y preferencias")).toBeTruthy();
    fireEvent.click(screen.getByText("Evaluaciones de bienestar"));
    expect(openTestsMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Plan nutricional"));
    fireEvent.click(screen.getByText("Plan de ejercicios"));
    fireEvent.click(screen.getByText("Cambiar objetivo"));
    expect(navigateMock.mock.calls).toEqual([
      ["wellness-diet"],
      ["wellness-exercise"],
      ["wellness-goal"],
    ]);
  });

  it("omite los accesos fuera del mapa", () => {
    renderPage();

    for (const title of [
      "Mi historial de bienestar",
      "Visualización del perfil",
      "Calendario de citas",
      "Fuentes y referencias médicas",
      "Equipo Agentic Wellness IA",
      "Medicamentos y suplementos",
      "Privacidad en la Liga",
      "Accesorio y datos de bienestar",
    ]) {
      expect(screen.queryByText(title, { exact: true })).toBeNull();
    }
    expect(screen.queryByLabelText("Hablar con Vita")).toBeNull();
  });

  it("traduce las acciones del plan al inglés", () => {
    mockState.lang = "en";
    renderPage();
    expect(screen.getByText("Exercise plan")).toBeTruthy();
    expect(screen.getByText("See today's routine")).toBeTruthy();
  });

  it("el banner Personaliza tu avatar usa el retrato de doctora existente (KAN-97)", () => {
    const { container } = renderPage();

    const banner = container.querySelector(".pf-avatar-feature");
    expect(banner).toBeTruthy();
    const doctor = banner?.querySelector("img.pf-avatar-doctor");
    expect(doctor).toBeTruthy();
    expect(doctor?.getAttribute("src")).toContain("vita-coach");
    expect(container.querySelector(".mascot")).toBeNull();
  });

  it("edita el contacto de emergencia y refresca el perfil tras guardar", async () => {
    renderPage();

    const emailInput = document.getElementById("pf-emg-mail");
    expect(emailInput).toBeTruthy();
    fireEvent(
      emailInput!,
      new CustomEvent("ionInput", { detail: { value: "nuevo@correo.com" } }),
    );
    fireEvent.click(screen.getByText("Guardar contacto de emergencia"));

    await waitFor(() => expect(profileMock.update).toHaveBeenCalledTimes(1));
    expect(profileMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        emergencyName: "Ana Torres",
        emergencyPhone: "3009876543",
        emergencyEmail: "nuevo@correo.com",
      }),
    );
    // El user del contexto se re-hidrata (PanicOverlay lee fam1* para SOS).
    expect(profileMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("no guarda un correo suelto sin nombre ni teléfono del contacto", async () => {
    renderPage();

    fireEvent(
      document.getElementById("pf-emg-name")!,
      new CustomEvent("ionInput", { detail: { value: "" } }),
    );
    fireEvent(
      document.getElementById("pf-emg-cel")!,
      new CustomEvent("ionInput", { detail: { value: "" } }),
    );
    fireEvent(
      document.getElementById("pf-emg-mail")!,
      new CustomEvent("ionInput", { detail: { value: "solo@correo.com" } }),
    );
    fireEvent.click(screen.getByText("Guardar contacto de emergencia"));

    await waitFor(() => expect(profileMock.update).not.toHaveBeenCalled());
  });
});

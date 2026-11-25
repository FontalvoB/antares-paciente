import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n/I18nContext";
import { WellnessExercise } from "../exercise/WellnessExercise";
import { PanicOverlay } from "../../../components/PanicOverlay";
import { SosLayer } from "../../../components/SosLayer";
import { SosQuickAccess } from "../../../components/SosQuickAccess";
import { requestSos } from "../sos/sos-store";

/**
 * KAN-137: el SOS es un acceso global. Se monta como en el Shell (capa en
 * <body>) junto a una sesión de ejercicio real y se comprueba que se ve, que
 * abre la cuenta regresiva y que ningún modal lo tapa.
 */

const store = vi.hoisted(() => {
  type State = { flow: string; screen: string; panicOpen: boolean; panicEntry: "countdown" | "protocol"; sosActive: boolean; user: Record<string, string> };
  let state: State = { flow: "app", screen: "wellness-exercise", panicOpen: false, panicEntry: "countdown", sosActive: false, user: {} };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<State>) => {
      state = { ...state, ...patch };
      listeners.forEach(listener => listener());
    },
    reset: (next: State) => {
      state = next;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

const actions = vi.hoisted(() => ({ navigate: vi.fn(), showToast: vi.fn(), activateSos: vi.fn() }));

// KAN-167: el orbe de Vita tiene sus propias pruebas (vita-entry.test.tsx).
vi.mock("../vita", () => ({ VitaEntry: () => null }));
vi.mock("../../../context/AppContext", async () => {
  const React = await import("react");
  return {
    useApp: () => {
      const state = React.useSyncExternalStore(store.subscribe, store.get);
      return {
        ...state,
        ...actions,
        chatUnread: false,
        openPanic: () => store.set({ panicOpen: true, panicEntry: "countdown", sosActive: false }),
        closePanic: () => store.set({ panicOpen: false, sosActive: false }),
      };
    },
  };
});

vi.mock("../../../context/WearableContext", () => ({ useWearable: () => ({ info: {}, samples: {} }) }));
vi.mock("../../../services/sos/sos-service", () => ({
  activateSosAlert: vi.fn(),
  fetchActiveSosAlert: vi.fn(),
  cancelSosAlert: vi.fn(),
  getCoordinatesBestEffort: vi.fn(async () => null),
  getEmergencyLocation: vi.fn(async () => ({ country: null, coordinates: null, status: "unavailable" })),
  SosServiceError: class SosServiceError extends Error {},
}));
const dialMock = vi.hoisted(() => vi.fn(() => true));
vi.mock("../../../utils/nativeDialer", () => ({ openNativeDialer: dialMock }));
vi.mock("../../../utils/emergencyCityRouting", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../utils/emergencyCityRouting")>(),
  loadEmergencyCityDirectory: async () => null,
}));
// Ionic sin hidratar Stencil (happy-dom no soporta sus hojas CSS); el layout real lo cubre el E2E.
vi.mock("@ionic/react", async () => {
  const React = await import("react");
  const element = (tag: string) => function IonicTestElement(props: Record<string, unknown>) {
    const { children, icon: _icon, expand: _expand, fill: _fill, lines: _lines, slot: _slot, cssClass: _css, ...rest } = props;
    return React.createElement(tag, rest, children as React.ReactNode);
  };
  return {
    IonActionSheet: () => null, IonBadge: element("span"), IonButton: element("button"), IonCard: element("article"),
    IonCardContent: element("div"), IonIcon: element("span"), IonItem: element("div"), IonLabel: element("div"),
    IonList: element("div"), IonNote: element("aside"), IonSegment: element("div"), IonSegmentButton: element("button"),
    IonProgressBar: element("progress"), IonRange: element("div"), IonToggle: element("div"),
  };
});
// Animaciones fuera del alcance: evitan AbortError de WAAPI en happy-dom.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const strip = ({ initial: _i, animate: _a, exit: _e, transition: _t, whileTap: _w, ...rest }: Record<string, unknown>) => rest;
  // Un componente estable por etiqueta: si cambiara en cada render, React remontaría el árbol.
  const cache = new Map<string, (props: Record<string, unknown>) => React.ReactElement>();
  const motion = new Proxy({}, {
    get: (_target, tag: string) => {
      if (!cache.has(tag)) cache.set(tag, (props: Record<string, unknown>) => React.createElement(tag, strip(props)));
      return cache.get(tag);
    },
  });
  const Pass = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  return { AnimatePresence: Pass, MotionConfig: Pass, motion, useReducedMotion: () => false };
});

function renderShell() {
  return render(
    <I18nProvider>
      <div className="app-shell">
        <WellnessExercise />
      </div>
      <SosLayer>
        <SosQuickAccess />
        <PanicOverlay />
      </SosLayer>
    </I18nProvider>,
  );
}

const nextFrame = () => act(async () => {
  await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("antares.lang", "es");
  store.reset({ flow: "app", screen: "wellness-exercise", panicOpen: false, panicEntry: "countdown", sosActive: false, user: { nombre: "Ana", fam1Nombre: "Luz", fam1Cel: "+573001234567" } });
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("ion-modal").forEach(modal => modal.remove());
  document.documentElement.classList.remove("kb-open");
});

describe("KAN-137 — SOS global durante la sesión de ejercicio", () => {
  it("el SOS de la barra abre la cuenta regresiva sin cerrar la sesión", async () => {
    renderShell();
    fireEvent.click(screen.getByText("Empezar sesión"));
    expect(screen.getByText("Ejercicio 1 de 4")).toBeTruthy();

    const navSos = document.querySelector(".bnav .ni-center");
    expect(navSos?.getAttribute("aria-label")).toBe("Abrir SOS de emergencia");
    await nextFrame();
    // Con la barra a la vista no se duplica el botón.
    expect(document.querySelector(".sos-quick-access")).toBeNull();

    fireEvent.click(navSos!);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Llamaremos a emergencias en 5\ss/);
    // Capa propia en <body>, fuera del árbol de la pantalla y de los modales.
    expect(document.querySelector("body > .sos-layer [role='alert']")).toBe(alert);
    // La sesión sigue debajo, intacta.
    expect(screen.getByText("Ejercicio 1 de 4")).toBeTruthy();
  });

  it("un modal abierto no tapa el SOS: aparece el acceso flotante en la capa global", async () => {
    renderShell();
    const modal = document.createElement("ion-modal");
    document.body.appendChild(modal);
    await nextFrame();
    await waitFor(() => expect(document.querySelector(".sos-layer .sos-quick-access")).toBeTruthy());

    fireEvent.click(document.querySelector(".sos-quick-access")!);
    expect(await screen.findByRole("alert")).toBeTruthy();
    // El modal abierto ya no atrapa el foco mientras el SOS está en pantalla.
    expect(modal.classList.contains("ion-disable-focus-trap")).toBe(true);
    expect(document.querySelector(".sos-quick-access")).toBeNull();
  });

  it("con el teclado abierto también se muestra el acceso flotante", async () => {
    renderShell();
    document.documentElement.classList.add("kb-open");
    await nextFrame();
    await waitFor(() => expect(document.querySelector(".sos-quick-access")).toBeTruthy());
  });

  it("voz/IA: el evento wellness:sos abre el SOS", async () => {
    renderShell();
    act(() => requestSos("voice"));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("en el registro inicial sin contactos no se muestra", async () => {
    store.reset({ flow: "onboarding", screen: "home", panicOpen: false, panicEntry: "countdown", sosActive: false, user: { nombre: "Ana" } });
    render(
      <I18nProvider>
        <SosLayer>
          <SosQuickAccess />
          <PanicOverlay />
        </SosLayer>
      </I18nProvider>,
    );
    await nextFrame();
    expect(document.querySelector(".sos-quick-access")).toBeNull();
    act(() => requestSos("voice"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

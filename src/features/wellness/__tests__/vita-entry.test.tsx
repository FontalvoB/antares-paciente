import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VitaEntry } from "../vita";
import { WellnessHome } from "../home/WellnessHome";
import { WellnessProtocol } from "../protocol/WellnessProtocol";
import { WellnessDiet } from "../nutrition/WellnessDiet";
import { WellnessCloseDay } from "../checkin/WellnessCloseDay";
import { WellnessExercise } from "../exercise/WellnessExercise";
import { localISODate, savePlanSnapshot } from "../state/wellness-home-store";
import { sendChatMessage } from "../../../services/chat/chat-service";
import { VITA_DOCK_KEY } from "../vita/dock";
import { readVitaVoiceOrigin } from "../../../services/chat/vita-origin";

// Datos personales sintéticos: ninguno debe aparecer en el payload.
const PERSONAL = {
  id: "patient-7f3c2a10-4b1e-4c55-9d2e-1a2b3c4d5e6f",
  nombre: "Ana Torres",
  email: "ana.torres@example.test",
  cedula: "1020304050",
  telefono: "+57 300 555 0101",
};

const state = vi.hoisted(() => ({ openVoice: vi.fn(), navigate: vi.fn(), toast: vi.fn() }));

vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({
    user: { ...PERSONAL },
    threadId: "proactive-thread",
    navigate: state.navigate,
    openVoice: state.openVoice,
    openTests: vi.fn(),
    showToast: state.toast,
  }),
}));
vi.mock("../../../i18n/I18nContext", () => {
  const t = (key: string, params?: Record<string, string>) =>
    Object.entries(params ?? {}).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), key);
  return { useT: () => t, useI18n: () => ({ t, lang: "es" as const }) };
});
vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
// happy-dom no completa ni cancela limpio las animaciones WAAPI de motion.
vi.mock("framer-motion", async (original) => ({
  ...(await original<object>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className, role }: { children: ReactNode; className?: string; role?: string }) =>
      <div className={className} role={role}>{children}</div>,
  },
}));
vi.mock("../../../components/LanguageToggle", () => ({ LanguageToggle: () => null }));
// Sesión sintética: el `sub` del JWT define el espacio opaco del historial.
const ACCOUNT = "0f8fad5b-d9cb-469f-a165-70867728950e";
vi.mock("../../../utils/authApi", () => ({
  getAccessToken: () => "x." + btoa(JSON.stringify({ sub: "0f8fad5b-d9cb-469f-a165-70867728950e" })) + ".x",
}));
vi.mock("../../../services/chat/chat-service", () => ({
  CHAT_UNAVAILABLE_MESSAGE: "El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
  sendChatMessage: vi.fn(),
}));
vi.mock("../../../services/chat/vita-attachments-service", () => ({
  VITA_ATTACHMENT_LIMIT: 3,
  VITA_ATTACHMENT_MAX_BYTES: 10 * 1024 * 1024,
  VITA_FILE_ACCEPT: "image/png",
  uploadVitaAttachment: vi.fn().mockResolvedValue({
    attachmentId: "att-1", kind: "image", contentType: "image/png", sizeBytes: 68,
    pageCount: null, expiresAt: new Date(Date.now() + 600_000).toISOString(),
  }),
  deleteVitaAttachment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../services/media/camera-service", () => ({ captureChatImage: vi.fn(), dataUrlToBlob: vi.fn() }));
vi.mock("../../../components/chat/VitaActions", () => ({ VitaActions: () => null }));
vi.mock("../../../components/chat/ChatFeedbackAction", () => ({ ChatFeedbackAction: () => null }));
vi.mock("@ionic/react", async (original) => ({
  ...(await original<object>()),
  IonButton: ({ children, onClick, disabled, "aria-label": label, className }: ComponentProps<"button">) =>
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={className}>{children}</button>,
  IonIcon: () => null,
  IonSpinner: () => null,
  IonModal: ({ isOpen, children, onDidDismiss }: { isOpen: boolean; children: ReactNode; onDidDismiss?: () => void }) =>
    isOpen ? <div role="dialog" onKeyUp={() => onDidDismiss?.()}>{children}</div> : null,
  IonActionSheet: () => null,
  IonTextarea: ({ value, onIonInput, onKeyDown, "aria-label": label }: {
    value: string; "aria-label": string;
    onIonInput: (event: { detail: { value: string } }) => void;
    onKeyDown: ComponentProps<"textarea">["onKeyDown"];
  }) => <textarea aria-label={label} value={value} onKeyDown={onKeyDown}
    onChange={(event) => onIonInput({ detail: { value: event.currentTarget.value } })} />,
}));

const orb = (module: string) => document.querySelector(`[data-vita-module="${module}"] .vita-entry-trigger`) as HTMLButtonElement | null;
/** Abre el panel: en Home la entrada es el orbe de WellnessFrame (KAN-121). */
const openPanelFrom = (module: string) =>
  fireEvent.click(module === "home" ? document.querySelector<HTMLElement>("button.wh-orb-button")! : orb(module)!);

function sentPayload() {
  const [message, threadId, language, attachments, , options] = vi.mocked(sendChatMessage).mock.calls.at(-1)!;
  return { message, threadId, language, attachments, options, moduleContext: options?.moduleContext };
}

function expectNoPersonalData(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const secret of Object.values(PERSONAL)) expect(serialized).not.toContain(secret);
  expect(serialized).not.toMatch(/patient|cedula|email|telefono|nombre/i);
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.mocked(sendChatMessage).mockResolvedValue({ reply: "Prueba un paso pequeño hoy.", threadId: "proactive-thread", executionId: "exec-1" });
  const today = new Date();
  savePlanSnapshot({
    name: "Ana", goal: "bajar", startDate: localISODate(today), createdAt: today.toISOString(),
    totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
  });
});
afterEach(() => vi.useRealTimers());

describe("VitaEntry — orbe en módulos", () => {
  it.each([
    ["exercise", () => <WellnessExercise />],
    ["protocol", () => <WellnessProtocol />],
    ["diet", () => <WellnessDiet />],
    ["close-day", () => <WellnessCloseDay />],
  ])("el orbe aparece en %s con aria-expanded y etiqueta descriptiva", (module, View) => {
    render(<View />);
    const trigger = orb(module);
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute("aria-expanded")).toBe("false");
    expect(trigger!.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger!.getAttribute("aria-label")).toMatch(/^Preguntar a Vita sobre /);
  });

  it.each([
    ["home", () => <WellnessHome />, "adherencePct"],
    ["protocol", () => <WellnessProtocol />, "pendingSteps"],
    ["diet", () => <WellnessDiet />, "mealsTotal"],
  ])("desde %s envía el contexto del módulo sin datos personales", async (module, View, key) => {
    render(<View />);
    openPanelFrom(module);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Escribe un mensaje…"), { target: { value: "¿Qué hago ahora?" } });
    await act(async () => { fireEvent.click(within(dialog).getByLabelText("Enviar")); });
    const payload = sentPayload();
    // Sin hilo del cliente: el backend lo deriva del JWT.
    expect(payload.threadId).toBe("");
    expect(payload.options?.omitThreadId).toBe(true);
    expectNoPersonalData(vi.mocked(sendChatMessage).mock.calls.at(-1));
    expect(JSON.stringify(vi.mocked(sendChatMessage).mock.calls.at(-1))).not.toContain(ACCOUNT);
    expect(payload.moduleContext?.module).toBe(module);
    expect(payload.moduleContext?.summary).toHaveProperty(key);
    expectNoPersonalData(payload.moduleContext);
    expect(await within(dialog).findByText("Prueba un paso pequeño hoy.")).toBeTruthy();
  });
});

describe("VitaEntry — entrada única en Home (WellnessFrame)", () => {
  it("el orbe de la cabecera abre el panel, refleja aria-expanded y no hay orbe flotante", () => {
    render(<WellnessHome />);
    expect(document.querySelectorAll(".vita-entry-trigger")).toHaveLength(0);
    const frameOrb = document.querySelector<HTMLElement>("button.wh-orb-button")!;
    expect(frameOrb.getAttribute("aria-haspopup")).toBe("dialog");
    expect(frameOrb.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(frameOrb);
    expect(frameOrb.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('[data-vita-panel="home"]')).toBeTruthy();
    expect(state.openVoice).not.toHaveBeenCalled();
    // Escape cierra y aria-expanded vuelve a false.
    fireEvent.keyDown(screen.getByLabelText("Escribe un mensaje…"), { key: "Escape" });
    expect(document.querySelector('[data-vita-panel="home"]')).toBeNull();
    expect(frameOrb.getAttribute("aria-expanded")).toBe("false");
  });

  it("el compositor de la cabecera abre el mismo panel", () => {
    render(<WellnessHome />);
    fireEvent.click(screen.getByText("Pregúntame o cuéntame cómo te sientes..."));
    expect(document.querySelectorAll('[data-vita-panel="home"]')).toHaveLength(1);
  });
});

describe("VitaEntry — panel", () => {
  it("Escape cierra el panel y el orbe vuelve a aria-expanded=false", () => {
    render(<VitaEntry module="exercise" summary={{ day: 3 }} />);
    fireEvent.click(orb("exercise")!);
    expect(orb("exercise")!.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(within(dialog).getByLabelText("Escribe un mensaje…"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(orb("exercise")!.getAttribute("aria-expanded")).toBe("false");
  });

  it("muestra sugerencias rápidas del módulo y las envía con el mismo servicio", async () => {
    render(<VitaEntry module="diet" />);
    fireEvent.click(orb("diet")!);
    await act(async () => { fireEvent.click(screen.getByText("¿Qué puedo comer hoy según mi plan?")); });
    expect(sentPayload().message).toBe("¿Qué puedo comer hoy según mi plan?");
    expect(sentPayload().language).toBe("es");
  });

  it("descarta del resumen claves y valores personales aunque el llamador los pase", async () => {
    render(<VitaEntry module="profile" summary={{
      language: "es", nombre: PERSONAL.nombre, email: PERSONAL.email, phone: PERSONAL.telefono,
      document: PERSONAL.cedula, address: "Calle 1", patientId: PERSONAL.id, note: PERSONAL.email,
    }} />);
    fireEvent.click(orb("profile")!);
    await act(async () => { fireEvent.click(screen.getByText("¿Cómo uso mejor la app?")); });
    expect(sentPayload().moduleContext).toEqual({ module: "profile", summary: { language: "es" } });
  });

  it("la voz recibe el mismo contexto acotado del módulo de origen", () => {
    render(<VitaEntry module="diet" summary={{ mealsLogged: 2, mealsTotal: 4, nombre: PERSONAL.nombre }} />);
    fireEvent.click(orb("diet")!);
    fireEvent.click(screen.getByLabelText("Hablar con Vita"));
    expect(state.openVoice).toHaveBeenCalledTimes(1);
    expect(readVitaVoiceOrigin()).toEqual({ module: "diet", summary: { mealsLogged: 2, mealsTotal: 4 } });
  });

  it("al reabrir, el texto libre del usuario no se restaura desde el almacenamiento", async () => {
    const first = render(<VitaEntry module="home" />);
    fireEvent.click(orb("home")!);
    fireEvent.change(screen.getByLabelText("Escribe un mensaje…"), { target: { value: "Me llamo Ana Torres" } });
    await act(async () => { fireEvent.click(screen.getByLabelText("Enviar")); });
    expect(screen.getByText("Me llamo Ana Torres")).toBeTruthy();
    first.unmount();
    render(<VitaEntry module="home" />);
    fireEvent.click(orb("home")!);
    expect(screen.queryByText("Me llamo Ana Torres")).toBeNull();
    expect(screen.getByText("Mensaje enviado. Tu texto no se guarda en este dispositivo.")).toBeTruthy();
    // La respuesta a un texto libre tampoco se restaura.
    expect(screen.queryByText("Prueba un paso pequeño hoy.")).toBeNull();
    expect(screen.getByText("Respuesta no guardada en este dispositivo.")).toBeTruthy();
    const raw = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
      .filter((key) => key.startsWith("wellness.vita."))
      .map((key) => localStorage.getItem(key)).join(" ");
    expect(raw).not.toMatch(/Ana|Torres/);
  });

  it("adjunta una imagen y la envía como adjunto del turno", async () => {
    render(<VitaEntry module="diet" />);
    fireEvent.click(orb("diet")!);
    const input = document.querySelector("input[data-vita-file-input]") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["png"], "plato.png", { type: "image/png" })] } });
    });
    await waitFor(() => expect(screen.getByText("Imagen adjunta")).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByLabelText("Enviar")); });
    expect(sentPayload().attachments).toEqual(["att-1"]);
    expect(sentPayload().message).toBe("Ayúdame a entender estos archivos.");
  });

  it("un fallo del servicio muestra indisponibilidad sin respuesta inventada", async () => {
    vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error("503"));
    render(<VitaEntry module="home" />);
    fireEvent.click(orb("home")!);
    await act(async () => { fireEvent.click(screen.getByText("¿Qué me conviene priorizar hoy?")); });
    expect(await screen.findByText(/no está disponible/)).toBeTruthy();
  });

  it("minimiza a pestaña compacta persistente y se restaura al tocarla", () => {
    render(<VitaEntry module="home" />);
    fireEvent.click(orb("home")!);
    fireEvent.click(screen.getByLabelText("Minimizar Vita"));
    expect(localStorage.getItem(VITA_DOCK_KEY)).toBe("minimized");
    const tab = screen.getByLabelText("Mostrar a Vita");
    expect(orb("home")).toBeNull();
    fireEvent.click(tab);
    expect(localStorage.getItem(VITA_DOCK_KEY)).toBe("expanded");
  });
});

describe("VitaEntry — aviso proactivo", () => {
  it("aparece como máximo una vez por día local y se puede descartar", () => {
    vi.useFakeTimers();
    const first = render(<VitaEntry module="home" />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("Estoy aquí si quieres repasar tu día conmigo.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Descartar aviso de Vita"));
    expect(screen.queryByText("Estoy aquí si quieres repasar tu día conmigo.")).toBeNull();
    first.unmount();
    render(<VitaEntry module="diet" />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText("Estoy aquí si quieres repasar tu día conmigo.")).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CSSProperties, ReactNode } from "react";
import { RequestAppointmentWizard } from "../RequestAppointmentWizard";
import { RescheduleAppointmentSheet } from "../RescheduleAppointmentSheet";
import type { ListedAppointment } from "../../data/appointments";

const state = vi.hoisted(() => ({
  lang: "en" as "es" | "en",
  range: vi.fn(), day: vi.fn(), submit: vi.fn(), reschedule: vi.fn(),
  professionals: vi.fn(), available: vi.fn(),
}));
vi.mock("../../i18n/I18nContext", async () => {
  const { default: english } = await import("../../i18n/en.json");
  const t = (key: string, params?: Record<string, string>) => {
    let value = state.lang === "en" ? (english as Record<string, string>)[key] ?? key : key;
    for (const [name, replacement] of Object.entries(params ?? {})) value = value.replaceAll(`{${name}}`, replacement);
    return value;
  };
  return { useT: () => t, useI18n: () => ({ t, lang: state.lang }) };
});
vi.mock("../../context/AppContext", () => ({ useApp: () => ({
  realMode: true,
  specialties: [{ id: "family-id", code: "FAMILY_MEDICINE", name: "Medicina General", category: "Medicina", description: null, isActive: true }],
  patientCareContext: { orgId: "org-id" },
  teamProfessional: vi.fn(), refreshAppointments: vi.fn(), showToast: vi.fn(),
  submitAppointmentRequest: state.submit, rescheduleAppointmentById: state.reschedule,
}) }));
vi.mock("../../utils/appointmentsApi", () => ({
  fetchAvailabilitySlotsRange: state.range, fetchAvailabilitySlots: state.day,
  fetchProfessionalsCatalogPage: state.professionals, fetchAvailableProfessionals: state.available,
}));
const outsideProfessional = () => ({ id: "outside-top", employeeId: "employee", fullName: "Ana Ruiz", professionalTypeName: "Physician", professionalTypeDisplayName: state.lang === "en" ? "Physician" : "Médico", specialties: [], locations: [], clinicIds: [], status: "Active" });
vi.mock("../ProfessionalPickerModal", () => ({ ProfessionalPickerModal: ({ isOpen, onSelect }: { isOpen: boolean; onSelect: (value: ReturnType<typeof outsideProfessional>) => void }) => isOpen ? <button onClick={() => onSelect(outsideProfessional())}>Choose outside professional</button> : null }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: { div: ({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) => <div className={className} style={style}>{children}</div> },
}));
vi.mock("@ionic/react", async importOriginal => ({
  ...await importOriginal<object>(),
  IonContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? <div>{children}</div> : null,
  IonDatetime: ({ locale, onIonChange }: { locale: string; onIonChange: (event: { detail: { value: string } }) => void }) =>
    <input aria-label="Selected date" data-locale={locale} type="date" onChange={event => onIonChange({ detail: { value: event.target.value } })} />,
}));

const slotStart = "2026-11-05T10:00:00-05:00";
const slots = [{ start: slotStart, end: "2026-11-05T10:30:00-05:00", durationMinutes: 30, isAvailable: true, conflictReason: null, availableProfessionalCount: 1 }];
const appointment: ListedAppointment = {
  id: "appointment-id", professionalId: "professional-id", name: "Dr. Ramírez", when: "CONFIRMADA",
  mode: "Telemedicina", accent: "", emoji: "", role: "Medicina General", time: "10:00", day: "Hoy", motivo: "Medicina General", color: "",
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T12:00:00-05:00"));
  state.lang = "en";
  state.professionals.mockResolvedValue({ data: [], total: 0 });
  state.available.mockResolvedValue({ professionals: [] });
  state.range.mockResolvedValue({ days: [{ date: "2026-11-05", slots }] });
  state.day.mockResolvedValue({ slots });
  state.submit.mockResolvedValue(true);
  state.reschedule.mockResolvedValue({ ok: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Fechas y errores de citas en inglés", () => {
  it("actualiza la profesión elegida fuera del top y conserva motivo, profesional y horario", async () => {
    state.lang = "es";
    const props = { onCancel: vi.fn(), onSubmitted: vi.fn() };
    const { container, rerender } = render(<RequestAppointmentWizard {...props} />);
    fireEvent(container.querySelector("ion-radio-group")!, new CustomEvent("ionChange", { detail: { value: "family-id" }, bubbles: true }));
    fireEvent.click(screen.getByLabelText("Buscar profesional…"));
    fireEvent.click(screen.getByText("Choose outside professional"));
    fireEvent.click(screen.getByText("Continuar"));
    await waitFor(() => expect(container.querySelector(".req-slot")).toBeTruthy());
    fireEvent.click(container.querySelector(".req-slot")!);
    fireEvent.click(screen.getByText("Continuar"));
    await waitFor(() => expect(document.getElementById("req-motivo")).toBeTruthy());
    fireEvent(document.getElementById("req-motivo")!, new CustomEvent("ionInput", { detail: { value: "Keep my patient-authored reason" }, bubbles: true }));
    expect(screen.getAllByText("Médico").length).toBeGreaterThan(0);
    state.lang = "en";
    state.professionals.mockImplementation(({ search }: { search?: string }) => Promise.resolve({ data: search ? [outsideProfessional()] : [], total: search ? 1 : 0 }));
    rerender(<RequestAppointmentWizard {...props} />);
    await screen.findByText("Physician");
    expect(state.professionals).toHaveBeenCalledWith(expect.objectContaining({ search: "Ana Ruiz", specialtyId: "family-id" }));
    fireEvent(container.querySelector("ion-radio-group.req-modes")!, new CustomEvent("ionChange", { detail: { value: "Videollamada" }, bubbles: true }));
    fireEvent.click(screen.getByText("Request appointment"));
    await waitFor(() => expect(state.submit).toHaveBeenCalledWith(expect.objectContaining({ professionalId: "outside-top", preferredStart: slotStart, reason: "Keep my patient-authored reason" })));
  });
  it("muestra mes, días, encabezados y cupo en inglés y conserva el ISO al solicitar", async () => {
    const { container } = render(<RequestAppointmentWizard onCancel={vi.fn()} onSubmitted={vi.fn()} />);
    fireEvent(container.querySelector("ion-radio-group")!, new CustomEvent("ionChange", { detail: { value: "family-id" }, bubbles: true }));
    fireEvent.click(screen.getByText("Continue"));
    await waitFor(() => expect(container.querySelector(".req-cal-month")?.textContent).toBe("November 2026"));
    expect([...container.querySelectorAll(".req-cal-week span")].map(node => node.textContent)).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
    expect(container.querySelector(".req-times-title")?.textContent).toBe("Thursday, November 5");
    expect(container.querySelector(".req-times-sub")?.textContent).toBe("1 time · General medicine");
    expect(container.querySelector('[aria-label="Thursday, November 5 · Open"]')).toBeTruthy();
    fireEvent.click(container.querySelector(".req-slot")!);
    fireEvent.click(screen.getByText("Continue"));
    await waitFor(() => expect(document.getElementById("req-motivo")).toBeTruthy());
    fireEvent(document.getElementById("req-motivo")!, new CustomEvent("ionInput", { detail: { value: "A patient authored reason" }, bubbles: true }));
    fireEvent(container.querySelector("ion-radio-group.req-modes")!, new CustomEvent("ionChange", { detail: { value: "Videollamada" }, bubbles: true }));
    fireEvent.click(screen.getByText("Request appointment"));
    await waitFor(() => expect(state.submit).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-11-05", preferredStart: slotStart, mode: "Videollamada", reason: "A patient authored reason" })));
  });

  it("localiza la fecha de reprogramación y conserva el slot original", async () => {
    const { container } = render(<RescheduleAppointmentSheet appointment={appointment} onClose={vi.fn()} onDone={vi.fn()} />);
    const picker = screen.getByLabelText("Selected date");
    expect(picker.getAttribute("data-locale")).toBe("en-US");
    fireEvent.change(picker, { target: { value: "2026-11-05" } });
    await screen.findByText("1 time available");
    expect(screen.getByText("Thursday, November 5")).toBeTruthy();
    fireEvent.click(container.querySelector(".req-slot")!);
    fireEvent.click(screen.getByText("Confirm reschedule"));
    await waitFor(() => expect(state.reschedule).toHaveBeenCalledWith("appointment-id", { newStart: slotStart, reason: null }));
  });

  it("oculta detalles de servidor sin traducción y permite cambiar el idioma del error", async () => {
    state.day.mockRejectedValue(new Error("Detalle clínico nuevo en español"));
    const props = { appointment, onClose: vi.fn(), onDone: vi.fn() };
    const { rerender } = render(<RescheduleAppointmentSheet {...props} />);
    fireEvent.change(screen.getByLabelText("Selected date"), { target: { value: "2026-11-05" } });
    await waitFor(() => expect(screen.getAllByText("Could not load availability").length).toBeGreaterThan(0));
    expect(screen.queryByText("Detalle clínico nuevo en español")).toBeNull();
    state.lang = "es";
    rerender(<RescheduleAppointmentSheet {...props} />);
    expect(screen.getByText("Detalle clínico nuevo en español")).toBeTruthy();
    expect(screen.getByLabelText("Selected date").getAttribute("data-locale")).toBe("es-ES");
  });
});

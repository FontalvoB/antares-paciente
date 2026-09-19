import { describe, expect, it } from "vitest";
import type { AppointmentStatus, PreVisitIntakeDto } from "../appointmentsApi";
import {
  PRE_VISIT_INTAKE_LIMITS,
  emptyPreVisitIntakeForm,
  hasPreVisitIntakeContent,
  intakeFormFromDto,
  intakeInputFromForm,
  isPreVisitIntakeEditable,
  preVisitIntakeVisible,
  validatePreVisitIntake,
} from "../preVisitIntake";

const VALID_FORM = {
  reason: "Dolor de cabeza persistente",
  symptoms: "Desde hace 3 días",
  allergies: "Penicilina",
  medications: "Losartán 50 mg",
};

function dto(overrides: Partial<PreVisitIntakeDto> = {}): PreVisitIntakeDto {
  return {
    id: "intake-1",
    appointmentId: "apt-1",
    patientId: "pat-1",
    reason: "Dolor de cabeza",
    symptoms: null,
    allergies: null,
    medications: null,
    createdAt: "2026-09-18T12:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

describe("preVisitIntake — validación", () => {
  it("sin motivo (o solo espacios) → required", () => {
    expect(
      validatePreVisitIntake({ ...VALID_FORM, reason: "   " }),
    ).toEqual({ reason: "required" });
  });

  it("motivo sobre el límite → tooLong", () => {
    const reason = "a".repeat(PRE_VISIT_INTAKE_LIMITS.reason + 1);
    expect(validatePreVisitIntake({ ...VALID_FORM, reason }).reason).toBe(
      "tooLong",
    );
  });

  it("motivo exactamente en el límite → válido", () => {
    const reason = "a".repeat(PRE_VISIT_INTAKE_LIMITS.reason);
    expect(validatePreVisitIntake({ ...VALID_FORM, reason })).toEqual({});
  });

  it("textos opcionales sobre su límite → tooLong por campo", () => {
    const errors = validatePreVisitIntake({
      ...VALID_FORM,
      symptoms: "a".repeat(PRE_VISIT_INTAKE_LIMITS.symptoms + 1),
      allergies: "a".repeat(PRE_VISIT_INTAKE_LIMITS.allergies + 1),
      medications: "a".repeat(PRE_VISIT_INTAKE_LIMITS.medications + 1),
    });
    expect(errors).toEqual({
      symptoms: "tooLong",
      allergies: "tooLong",
      medications: "tooLong",
    });
  });

  it("formulario válido → sin errores", () => {
    expect(validatePreVisitIntake(VALID_FORM)).toEqual({});
  });
});

describe("preVisitIntake — normalización", () => {
  it("intakeInputFromForm recorta y convierte opcionales vacíos en null", () => {
    expect(
      intakeInputFromForm({
        reason: "  Dolor  ",
        symptoms: "  ",
        allergies: "\n",
        medications: " Losartán ",
      }),
    ).toEqual({
      reason: "Dolor",
      symptoms: null,
      allergies: null,
      medications: "Losartán",
    });
  });

  it("intakeFormFromDto(null/undefined) → formulario vacío", () => {
    expect(intakeFormFromDto(null)).toEqual(emptyPreVisitIntakeForm());
    expect(intakeFormFromDto(undefined)).toEqual(emptyPreVisitIntakeForm());
  });

  it("intakeFormFromDto lleva los campos y normaliza null a cadena vacía", () => {
    expect(intakeFormFromDto(dto({ symptoms: "Náuseas" }))).toEqual({
      reason: "Dolor de cabeza",
      symptoms: "Náuseas",
      allergies: "",
      medications: "",
    });
  });

  it("hasPreVisitIntakeContent ignora solo-espacios y detecta cualquier campo", () => {
    expect(
      hasPreVisitIntakeContent({
        reason: "  ",
        symptoms: "\n",
        allergies: "",
        medications: " ",
      }),
    ).toBe(false);
    expect(
      hasPreVisitIntakeContent({ ...emptyPreVisitIntakeForm(), allergies: "Penicilina" }),
    ).toBe(true);
  });
});

describe("preVisitIntake — ciclo de vida", () => {
  it("solo la cita Confirmed permite editar", () => {
    expect(isPreVisitIntakeEditable("Confirmed")).toBe(true);
    const others: AppointmentStatus[] = [
      "Requested",
      "InProgress",
      "Completed",
      "Cancelled",
      "NoShow",
    ];
    for (const status of others) {
      expect(isPreVisitIntakeEditable(status)).toBe(false);
    }
    expect(isPreVisitIntakeEditable(undefined)).toBe(false);
    expect(isPreVisitIntakeEditable(null)).toBe(false);
  });

  it("el CTA se muestra en Confirmed e InProgress (lectura) y no en terminales", () => {
    expect(preVisitIntakeVisible("Confirmed")).toBe(true);
    expect(preVisitIntakeVisible("InProgress")).toBe(true);
    const hidden: AppointmentStatus[] = [
      "Requested",
      "Completed",
      "Cancelled",
      "NoShow",
    ];
    for (const status of hidden) {
      expect(preVisitIntakeVisible(status)).toBe(false);
    }
    expect(preVisitIntakeVisible(undefined)).toBe(false);
  });
});

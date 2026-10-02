import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUS_LABELS,
  canJoinAppointment,
  mapAppointmentToListed,
  mapRequestToListed,
  pastAppointmentChip,
} from "../appointments";
import type {
  AppointmentDto,
  AppointmentRequestDto,
} from "../../utils/appointmentsApi";

/** Cita del backend con defaults de campos no relevantes al test. */
function appointmentDto(
  overrides: Partial<AppointmentDto> = {},
): AppointmentDto {
  return {
    id: "apt-1",
    requestId: null,
    patientId: "pat-1",
    patientName: "María González",
    professionalId: "pro-1",
    professionalName: "Dr. Carlos Ramírez",
    specialtyId: "spe-1",
    specialtyName: "Medicina general",
    organizationId: "org-1",
    clinicId: null,
    locationId: null,
    locationName: null,
    scheduledStart: "2026-09-18T15:00:00.000Z",
    scheduledEnd: "2026-09-18T15:30:00.000Z",
    durationMinutes: 30,
    status: "Confirmed",
    rescheduleCount: 0,
    cancellationReason: null,
    createdAt: "2026-09-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("mapAppointmentToListed — ventana de sala en la lista", () => {
  it("lleva roomOpensAt/roomClosesAt y status a la fila", () => {
    const listed = mapAppointmentToListed(
      appointmentDto({
        status: "InProgress",
        roomOpensAt: "2026-09-18T14:50:00.000Z",
        roomClosesAt: "2026-09-18T16:00:00.000Z",
      }),
    );

    expect(listed.status).toBe("InProgress");
    expect(listed.roomOpensAt).toBe("2026-09-18T14:50:00.000Z");
    expect(listed.roomClosesAt).toBe("2026-09-18T16:00:00.000Z");
    expect(listed.when).toBe(APPOINTMENT_STATUS_LABELS.InProgress);
  });

  it("sin campos enriquecidos → null (la sala no bloquea la entrada)", () => {
    const listed = mapAppointmentToListed(appointmentDto());

    expect(listed.status).toBe("Confirmed");
    expect(listed.roomOpensAt).toBeNull();
    expect(listed.roomClosesAt).toBeNull();
  });

  it("lleva ids reales y motivo de cancelación a la fila", () => {
    const listed = mapAppointmentToListed(
      appointmentDto({
        status: "Cancelled",
        cancellationReason: "El paciente lo solicitó",
      }),
    );

    expect(listed.professionalId).toBe("pro-1");
    expect(listed.specialtyId).toBe("spe-1");
    expect(listed.cancellationReason).toBe("El paciente lo solicitó");
  });
});

describe("pastAppointmentChip — 2.A.6, un color por estado final", () => {
  it("Completed → Hecha verde", () => {
    expect(pastAppointmentChip("Completed")).toEqual({
      label: "Hecha",
      className: "chip chip-teal",
    });
  });

  it("Cancelled → Cancelada rojo", () => {
    expect(pastAppointmentChip("Cancelled")).toEqual({
      label: "Cancelada",
      className: "chip chip-red",
    });
  });

  it("NoShow → No asistió ámbar", () => {
    expect(pastAppointmentChip("NoShow")).toEqual({
      label: "No asistió",
      className: "chip chip-org",
    });
  });

  it("sin estado (legado) → Hecha sin romper", () => {
    expect(pastAppointmentChip(undefined).label).toBe("Hecha");
  });
});

/** Solicitud del backend con defaults de campos no relevantes al test. */
function requestDto(
  overrides: Partial<AppointmentRequestDto> = {},
): AppointmentRequestDto {
  return {
    id: "req-1",
    patientId: "pat-1",
    patientName: "María González",
    professionalId: null,
    specialtyId: "spe-1",
    specialtyName: "Medicina general",
    organizationId: "org-1",
    clinicId: null,
    locationId: null,
    preferredStart: null,
    reason: "Control preventivo",
    status: "Pending",
    createdAt: "2026-09-10T12:00:00.000Z",
    rejectionReason: null,
    ...overrides,
  };
}

describe("mapRequestToListed — estado legible sin sala (REQ-APP-03)", () => {
  it("Pending → En revisión con id req-*", () => {
    const listed = mapRequestToListed(requestDto({ status: "Pending" }));
    expect(listed.when).toBe("En revisión");
    expect(listed.id.startsWith("req-")).toBe(true);
    expect(listed.pending).toBe(true);
    expect(listed.status).toBeUndefined();
  });

  it("Approved → Aprobada", () => {
    expect(mapRequestToListed(requestDto({ status: "Approved" })).when).toBe(
      "Aprobada",
    );
  });

  it("Rejected → Rechazada", () => {
    expect(mapRequestToListed(requestDto({ status: "Rejected" })).when).toBe(
      "Rechazada",
    );
  });
});

describe("canJoinAppointment — Unirse solo con sala potencial", () => {
  it("Confirmed con id real → true", () => {
    expect(canJoinAppointment({ id: "apt-uuid-1", status: "Confirmed" })).toBe(
      true,
    );
  });

  it("InProgress con id real → true", () => {
    expect(canJoinAppointment({ id: "apt-uuid-1", status: "InProgress" })).toBe(
      true,
    );
  });

  it.each(["Completed", "Cancelled", "NoShow", "Requested"] as const)(
    "%s nunca abre sala",
    (status) => {
      expect(canJoinAppointment({ id: "apt-uuid-1", status })).toBe(false);
    },
  );

  it("solicitud (sin estado) → false", () => {
    expect(canJoinAppointment({ id: "req-abc", status: undefined })).toBe(
      false,
    );
  });

  it("Confirmed con id req-* → false (defensa ante ids no reales)", () => {
    expect(canJoinAppointment({ id: "req-abc", status: "Confirmed" })).toBe(
      false,
    );
  });
});

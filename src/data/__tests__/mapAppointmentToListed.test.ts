import { describe, expect, it } from "vitest";
import { APPOINTMENT_STATUS_LABELS, mapAppointmentToListed } from "../appointments";
import type { AppointmentDto } from "../../utils/appointmentsApi";

/** Cita del backend con defaults de campos no relevantes al test. */
function appointmentDto(overrides: Partial<AppointmentDto> = {}): AppointmentDto {
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
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { buildRealAppointments } from "../appointments";
import type { AppointmentDto, AppointmentRequestDto } from "../../utils/appointmentsApi";
const appointment = (id: string, status: AppointmentDto["status"], start: string) => ({ id, status, scheduledStart: start, scheduledEnd: new Date(Date.parse(start) + 1800000).toISOString() }) as AppointmentDto;
const request = (id: string, status: AppointmentRequestDto["status"], start: string | null) => ({ id, status, preferredStart: start, createdAt: "2026-09-01", reason: "QA" }) as AppointmentRequestDto;
afterEach(() => vi.useRealTimers());
describe("agenda real", () => {
  it("mueve solicitudes vencidas al historial y no duplica solicitudes aprobadas", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    const { upcoming, past } = buildRealAppointments([appointment("confirmed", "Confirmed", "2026-10-09T12:00:00Z")], [
      request("old", "Pending", "2026-10-04T12:00:00Z"), request("approved", "Approved", "2026-09-30T12:00:00Z"), request("pending", "Pending", "2026-10-10T12:00:00Z"),
    ]);
    expect(upcoming.map(a => a.id)).toEqual(["confirmed", "req-pending"]);
    expect(past.map(a => a.id)).toEqual(["req-old"]);
    expect(past[0].requestStatus).toBe("Pending");
  });
  it("conserva la sesión en curso y mueve confirmadas vencidas al historial", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    const { upcoming, past } = buildRealAppointments([appointment("active", "InProgress", "2026-10-08T10:00:00Z"), appointment("missed", "Confirmed", "2026-10-07T10:00:00Z")], []);
    expect(upcoming.map(a => a.id)).toEqual(["active"]);
    expect(past.map(a => a.id)).toEqual(["missed"]);
  });
  it("ordena citas y solicitudes juntas por fecha y deja las indefinidas al final", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    const { upcoming, past } = buildRealAppointments([
      appointment("later", "Confirmed", "2026-10-11T12:00:00Z"),
      appointment("old", "Completed", "2026-10-02T12:00:00Z"),
    ], [request("soon", "Pending", "2026-10-09T12:00:00Z"), request("undated", "Pending", null), request("yesterday", "Pending", "2026-10-07T12:00:00Z")]);
    expect(upcoming.map(a => a.id)).toEqual(["req-soon", "later", "req-undated"]);
    expect(upcoming[0].featured).toBe(true);
    expect(past.map(a => a.id)).toEqual(["req-yesterday", "old"]);
  });

});

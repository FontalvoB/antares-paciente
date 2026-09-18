import { beforeEach, describe, expect, it } from "vitest";
import {
  consumePendingRoomAppointmentId,
  queuePendingRoomAppointmentId,
} from "../pushNotifications";

describe("cola de sala pendiente (cold start de push)", () => {
  beforeEach(() => {
    // El estado vive a nivel de módulo: se limpia antes de cada caso.
    consumePendingRoomAppointmentId();
  });

  it("sin nada encolado devuelve null", () => {
    expect(consumePendingRoomAppointmentId()).toBeNull();
  });

  it("consume el id encolado una sola vez", () => {
    queuePendingRoomAppointmentId("appt-1");
    expect(consumePendingRoomAppointmentId()).toBe("appt-1");
    expect(consumePendingRoomAppointmentId()).toBeNull();
  });

  it("el último id encolado gana (intención más reciente)", () => {
    queuePendingRoomAppointmentId("appt-1");
    queuePendingRoomAppointmentId("appt-2");
    expect(consumePendingRoomAppointmentId()).toBe("appt-2");
  });
});

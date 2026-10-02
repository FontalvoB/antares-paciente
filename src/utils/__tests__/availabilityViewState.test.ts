import { describe, it, expect } from "vitest";
import { availabilityViewState } from "../availabilityViewState";
import type { AvailabilitySlotDto } from "../appointmentsApi";

/** Slot helper: isAvailable=true con conteo 1. */
const slot = (start = "2026-10-05T14:00:00+00:00"): AvailabilitySlotDto => ({
  start,
  end: "2026-10-05T14:30:00+00:00",
  durationMinutes: 30,
  isAvailable: true,
  conflictReason: null,
  availableProfessionalCount: 1,
});

/** Slot no disponible (TooSoon/Booked): isAvailable=false. */
const busySlot = (): AvailabilitySlotDto => ({
  ...slot(),
  isAvailable: false,
  conflictReason: "Booked",
  availableProfessionalCount: 0,
});

describe("availabilityViewState", () => {
  const fecha = "2026-10-05";

  it("loading mientras el rango (probing) está en curso", () => {
    expect(availabilityViewState(true, false, null, "", {})).toBe("loading");
  });

  it("loading mientras un día se recarga bajo demanda (dayLoading)", () => {
    expect(availabilityViewState(false, true, null, fecha, {})).toBe("loading");
  });

  it("empty: ventana de 14 días escaneada sin ningún cupo (no spinner)", () => {
    // Regresión QA TestFlight 2026-10-02: profesional sin agenda devolvía
    // days[] completo con slots vacíos y el wizard giraba para siempre.
    const daySlots = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [
        `2026-10-${String(5 + i).padStart(2, "0")}`,
        [busySlot()],
      ]),
    );
    expect(availabilityViewState(false, false, null, "", daySlots)).toBe(
      "empty",
    );
  });

  it("empty: ventana con días de slots vacíos ([]), contrato days[]", () => {
    const daySlots = { "2026-10-05": [], "2026-10-06": [] };
    expect(availabilityViewState(false, false, null, "", daySlots)).toBe(
      "empty",
    );
  });

  it("slots: si algún día de la ventana tiene cupo, la fecha queda elegible", () => {
    const daySlots = { "2026-10-05": [busySlot()], "2026-10-06": [slot()] };
    expect(availabilityViewState(false, false, null, "", daySlots)).toBe(
      "chooseDay",
    );
  });

  it("error: el rango fallido con date vacío muestra el error (no girar ni placeholder)", () => {
    // Regresión: dayError precede al placeholder neutro.
    expect(
      availabilityViewState(false, false, "Error del servidor (500)", "", {}),
    ).toBe("error");
  });

  it("error: también con fecha ya elegida (fallo del día bajo demanda)", () => {
    expect(
      availabilityViewState(false, false, "Sin conexión", fecha, {
        [fecha]: [],
      }),
    ).toBe("error");
  });

  it("chooseDay: sin fecha y sin rango en caché", () => {
    expect(availabilityViewState(false, false, null, "", {})).toBe("chooseDay");
  });

  it("slots: fecha elegida sin error, aunque el día quede sin cupo", () => {
    expect(
      availabilityViewState(false, false, null, fecha, { [fecha]: [] }),
    ).toBe("slots");
  });
});

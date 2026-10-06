import { describe, expect, it } from "vitest";
import { resolveEmergencyNumber } from "../emergencyNumbers";

/**
 * SOS: el número de llamada de emergencia depende de la zona horaria del
 * dispositivo. Colombia marca 123; EE. UU. marca 911; una zona desconocida
 * cae al 911 (comportamiento previo).
 */
describe("resolveEmergencyNumber — emergencias por zona horaria", () => {
  it("Colombia (America/Bogota) marca el 123", () => {
    expect(resolveEmergencyNumber("America/Bogota")).toBe("123");
  });

  it("zonas de EE. UU. marcan el 911", () => {
    const usaZones = [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
      "America/Puerto_Rico",
    ];
    for (const zone of usaZones) {
      expect(resolveEmergencyNumber(zone)).toBe("911");
    }
  });

  it("zonas de otros países y valores vacíos caen al 911", () => {
    const fallbackZones = [
      "America/Mexico_City",
      "America/Toronto",
      "Europe/Madrid",
      "UTC",
      "",
      null,
    ];
    for (const zone of fallbackZones) {
      expect(resolveEmergencyNumber(zone)).toBe("911");
    }
  });
});

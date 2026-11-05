import { describe, expect, it } from "vitest";
import { countryFromCoordinates, emergencyNumberForCountry, resolveEmergencyNumber } from "../emergencyNumbers";

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

describe("país de emergencias por coordenadas reales", () => {
  it.each([
    [4.711, -74.072, "CO", "Bogotá"],
    [6.244, -75.581, "CO", "Medellín"],
    [12.5847, -81.7006, "CO", "San Andrés"],
    [25.7617, -80.1918, "US", "Miami"],
    [40.7128, -74.006, "US", "Nueva York"],
    [61.2181, -149.9003, "US", "Alaska"],
    [21.3069, -157.8583, "US", "Hawái"],
    [18.4655, -66.1057, "US", "Puerto Rico"],
    [13.4443, 144.7937, "US", "Guam"],
    [15.185, 145.746, "US", "Islas Marianas"],
    [-14.2756, -170.702, "US", "Samoa Americana"],
    [18.3419, -64.9307, "US", "Islas Vírgenes"],
    [51.8796, -176.6581, "US", "Adak/Aleutianas"],
    [51.95, 179.6, "US", "Semisopochnoi al este del antimeridiano"],
  ])("clasifica %s,%s en %s (%s)", (latitude, longitude, expected) => {
    expect(countryFromCoordinates({ latitude: Number(latitude), longitude: Number(longitude), accuracyMeters: 20 })).toBe(expected);
  });

  it.each([
    [43.6532, -79.3832, "Toronto"],
    [49.2827, -123.1207, "Vancouver"],
    [19.4326, -99.1332, "Ciudad de México"],
    [31.69, -106.4245, "Ciudad Juárez"],
    [32.5149, -117.0382, "Tijuana"],
    [0.8119, -77.7173, "Tulcán/Ecuador"],
    [8.9936, -79.5197, "Panamá"],
    [10.4806, -66.9036, "Caracas"],
    [0, -80, "océano"],
    [40.4168, -3.7038, "España"],
    [51.5074, -0.1278, "Londres"],
    [52.52, 13.405, "Berlín"],
    [55.7558, 37.6173, "Moscú"],
    [35.6762, 139.6503, "Tokio"],
    [64.733, 177.51, "Anádyr/Rusia"],
    [0, -179.8, "Pacífico/antimeridiano"],
  ])("no atribuye %s,%s (%s) a un país soportado", (latitude, longitude) => {
    expect(countryFromCoordinates({ latitude: Number(latitude), longitude: Number(longitude) })).toBeNull();
  });

  it("pide confirmación cerca de una frontera o con incertidumbre que la cruza", () => {
    expect(countryFromCoordinates({ latitude: 32.541, longitude: -117.03, accuracyMeters: 200 })).toBeNull();
    expect(countryFromCoordinates({ latitude: 48.9, longitude: -122.5, accuracyMeters: 20_000 })).toBeNull();
    expect(countryFromCoordinates({ latitude: -4.215, longitude: -69.941, accuracyMeters: 2000 })).toBeNull();
  });

  it("rechaza números inválidos y ubicaciones sin precisión suficiente", () => {
    for (const latitude of [NaN, Infinity, -91, 91]) expect(countryFromCoordinates({ latitude, longitude: -74 })).toBeNull();
    expect(countryFromCoordinates({ latitude: 4.7, longitude: -74, accuracyMeters: Infinity })).toBeNull();
    expect(countryFromCoordinates({ latitude: 4.7, longitude: -74, accuracyMeters: 100_000 })).toBeNull();
    expect(countryFromCoordinates(null)).toBeNull();
  });

  it("las tres especialidades se solicitan al centro unificado correcto", () => {
    expect(emergencyNumberForCountry("CO")).toBe("123");
    expect(emergencyNumberForCountry("US")).toBe("911");
    expect(() => emergencyNumberForCountry(null as unknown as "CO")).toThrow();
  });
});

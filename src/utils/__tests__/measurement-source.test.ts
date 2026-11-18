import { describe, expect, it } from "vitest";
import type { MeasurementItemDto } from "../../services/measurements/types";
import { getMeasurementSourceBadge, isSupersededMeasurement } from "../measurement-source";

describe("procedencia de mediciones", () => {
  it.each([
    ["vita_chat", "Reportado por ti · Chat"],
    ["vita_voice", "Reportado por ti · Voz"],
    ["vita_whatsapp", "Reportado por ti · WhatsApp"],
  ] as const)("muestra el canal %s del reporte del paciente", (sourceChannel, label) => {
    expect(getMeasurementSourceBadge({ sourceChannel, reportedBy: "patient" }))
      .toEqual({ label, variant: "patient" });
    expect(getMeasurementSourceBadge({ sourceChannel })).toBeNull();
  });

  it("muestra el actor paciente sin atribuirle un canal Vita", () => {
    expect(getMeasurementSourceBadge({ reportedBy: "patient", sourceChannel: "app_manual" }))
      .toEqual({ label: "Reportado por ti", variant: "patient" });
  });

  it.each([
    [{ reportedBy: "professional" }, "Profesional", "prof"],
    [{ sourceChannel: "professional", reportedBy: null }, "Profesional", "prof"],
    [{ reportedBy: "device" }, "Dispositivo", "device"],
    [{ sourceChannel: "device" }, "Dispositivo", "device"],
    [{ sourceChannel: "lab", reportedBy: "professional" }, "Laboratorio", "lab"],
  ] as const)("reconoce la procedencia registrada %j", (record, label, variant) => {
    expect(getMeasurementSourceBadge(record)).toEqual({ label, variant });
  });

  it("omite la procedencia si el backend anterior solo devuelve source o devuelve null", () => {
    const legacy: Pick<MeasurementItemDto, "source" | "sourceChannel" | "reportedBy"> = {
      source: "patient",
    };
    expect(getMeasurementSourceBadge(legacy)).toBeNull();
    expect(getMeasurementSourceBadge({ sourceChannel: null, reportedBy: null })).toBeNull();
  });

  it("distingue una fila reemplazada de las demás y de las filas antiguas", () => {
    expect(isSupersededMeasurement({ status: "superseded" })).toBe(true);
    expect(isSupersededMeasurement({ status: "confirmed" })).toBe(false);
    expect(isSupersededMeasurement({ status: "pending_confirmation" })).toBe(false);
    expect(isSupersededMeasurement({})).toBe(false);
  });
});

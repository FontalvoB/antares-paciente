import { describe, it, expect } from "vitest";
import {
  resolveClinicalHistoryAvailability,
  shouldShowClinicalHistory,
  type ClinicalSourceState,
} from "../clinicalHistoryAvailability";

const ready = (count: number): ClinicalSourceState => ({
  status: "ready",
  count,
});
const loading: ClinicalSourceState = { status: "loading" };
const error: ClinicalSourceState = { status: "error" };
const unavailable: ClinicalSourceState = { status: "unavailable" };

describe("resolveClinicalHistoryAvailability — derivación de la Historia clínica", () => {
  it("todas las fuentes listas y vacías → empty (único caso que oculta)", () => {
    expect(
      resolveClinicalHistoryAvailability({
        exams: ready(0),
        documents: ready(0),
        medications: ready(0),
      }),
    ).toBe("empty");
  });

  it("una sola fuente con filas → available aunque las demás estén vacías", () => {
    expect(
      resolveClinicalHistoryAvailability({
        exams: ready(2),
        documents: ready(0),
        medications: ready(0),
      }),
    ).toBe("available");
    expect(
      resolveClinicalHistoryAvailability({
        exams: ready(0),
        documents: ready(1),
        medications: ready(0),
      }),
    ).toBe("available");
    expect(
      resolveClinicalHistoryAvailability({
        exams: ready(0),
        documents: ready(0),
        medications: ready(1),
      }),
    ).toBe("available");
  });

  it("contenido confirmado gana a un error/carga de otra fuente", () => {
    expect(
      resolveClinicalHistoryAvailability({
        exams: ready(1),
        documents: error,
        medications: loading,
      }),
    ).toBe("available");
  });

  it("sin filas y con una fuente cargando → loading (no se decide todavía)", () => {
    expect(
      resolveClinicalHistoryAvailability({
        exams: ready(0),
        documents: loading,
        medications: ready(0),
      }),
    ).toBe("loading");
  });

  it("sin filas y con error/módulo no disponible → unknown (no se oculta)", () => {
    expect(
      resolveClinicalHistoryAvailability({
        exams: error,
        documents: ready(0),
        medications: ready(0),
      }),
    ).toBe("unknown");
    expect(
      resolveClinicalHistoryAvailability({
        exams: ready(0),
        documents: ready(0),
        medications: unavailable,
      }),
    ).toBe("unknown");
  });

  it("mientras otra fuente carga → loading (no decide con datos parciales)", () => {
    expect(
      resolveClinicalHistoryAvailability({
        exams: error,
        documents: loading,
        medications: ready(0),
      }),
    ).toBe("loading");
  });

  it("count ausente en ready equivale a 0 (no inventa contenido)", () => {
    expect(
      resolveClinicalHistoryAvailability({
        exams: { status: "ready" },
        documents: { status: "ready" },
        medications: { status: "ready" },
      }),
    ).toBe("empty");
  });
});

describe("shouldShowClinicalHistory", () => {
  it("muestra la entrada salvo con vacío confirmado", () => {
    expect(shouldShowClinicalHistory("available")).toBe(true);
    expect(shouldShowClinicalHistory("loading")).toBe(true);
    expect(shouldShowClinicalHistory("unknown")).toBe(true);
    expect(shouldShowClinicalHistory("empty")).toBe(false);
  });
});

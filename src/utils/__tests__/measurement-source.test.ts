import { describe, expect, it } from "vitest";
import {
  normalizeSource,
  SOURCE_LABEL_KEYS,
  SOURCE_META,
} from "../measurement-source";

describe("measurement-source — etiquetas humanas de origen", () => {
  it("mapea alias clínicos a Consulta médica (sin crudo técnico visible)", () => {
    for (const raw of [
      "seed-hist",
      "seed_hist",
      "professional",
      "provider",
      "clinic",
      "Professional",
      " SEED-HIST ",
    ]) {
      const key = normalizeSource(raw);
      expect(SOURCE_LABEL_KEYS[key]).toBe("Consulta médica");
      expect(SOURCE_META[key]?.className).toBe("hc-src-prof");
    }
  });

  it("conserva dispositivo, laboratorio y autorreporte", () => {
    expect(SOURCE_LABEL_KEYS["device"]).toBe("Dispositivo");
    expect(SOURCE_LABEL_KEYS["lab"]).toBe("Laboratorio");
    expect(SOURCE_LABEL_KEYS["patient"]).toBe("Autorreporte");
  });

  it("origen desconocido queda sin etiqueta (el crudo se muestra tal cual)", () => {
    expect(SOURCE_LABEL_KEYS[normalizeSource("wearable-x")]).toBeUndefined();
  });
});

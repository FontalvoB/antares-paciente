import { describe, expect, it, vi, beforeEach } from "vitest";

// Trazabilidad Food AI (Fase 8, tarea 2.4): al confirmar el plato analizado,
// el foodAnalysisId viaja anidado en `intake` junto a source 'ai_photo' —
// nunca aplanado en top-level (el backend lo descartaría en silencio, B2).
const apiFetchMock = vi.fn();

vi.mock("../../../utils/apiClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../utils/apiClient")>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

import { logMeal } from "../nutrition-service";

describe("logMeal — foodAnalysisId anidado en intake (trazabilidad Food AI)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ xpAwarded: 10 });
  });

  it("propaga source ai_photo + foodAnalysisId dentro del bloque intake", async () => {
    await logMeal("alm", "2026-09-24", {
      calories: 520,
      proteinG: 30,
      source: "ai_photo",
      foodAnalysisId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/program/nutrition/log", {
      method: "POST",
      body: {
        mealCode: "alm",
        localDate: "2026-09-24",
        intake: {
          calories: 520,
          proteinG: 30,
          source: "ai_photo",
          foodAnalysisId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        },
      },
    });
  });

  it("registro manual no envía foodAnalysisId", async () => {
    await logMeal("des", undefined, { calories: 300, source: "manual" });
    const body = apiFetchMock.mock.calls[0]?.[1]?.body as {
      intake?: Record<string, unknown>;
    };
    expect(body.intake?.["source"]).toBe("manual");
    expect(body.intake?.["foodAnalysisId"]).toBeUndefined();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

// Contract test del wire de metrics-history (tarjetas del Home): URL con
// codes+days, parse del DTO tipado (heightCm + métricas sparse/ASC, target y
// favorableDirection) y propagación del 404 NO_ACTIVE_ENROLLMENT como
// ApiError — el consumidor (resolveHomeCards) degrada a requires-data.
const apiFetchMock = vi.fn();

vi.mock("../../../utils/apiClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../utils/apiClient")>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

import {
  getMetricsHistory,
  METRICS_HISTORY_CODES,
  METRICS_HISTORY_DAYS,
} from "../metrics-history-service";
import { ApiError } from "../../../utils/apiClient";
import type { MetricsHistoryDto } from "../types";

const historyFixture: MetricsHistoryDto = {
  heightCm: 168,
  metrics: [
    {
      code: "hba1c",
      unit: "%",
      target: { lo: null, hi: 5.7 },
      favorableDirection: "down",
      points: [
        { date: "2026-02-18", value: 6.4 },
        { date: "2026-06-25", value: 6.0 },
      ],
    },
    {
      // Sparse: solo bmi aparece sin unit ni target — viaja tal cual.
      code: "bmi",
      unit: null,
      target: null,
      favorableDirection: null,
      points: [{ date: "2026-03-12", value: 27.8 }],
    },
  ],
};

describe("getMetricsHistory — parse del contrato FROZEN", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("pide los códigos por defecto (bmi,hba1c,body_fat,weight,step_count,activity_kcal) con 180 días y GET", async () => {
    apiFetchMock.mockResolvedValue(historyFixture);
    const history = await getMetricsHistory();
    expect(history.metrics).toHaveLength(2);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/program/me/metrics-history?codes=bmi%2Chba1c%2Cbody_fat%2Cweight%2Cstep_count%2Cactivity_kcal&days=180",
      { method: "GET" },
    );
  });

  it("respeta codes y days custom", async () => {
    apiFetchMock.mockResolvedValue({ heightCm: null, metrics: [] });
    await getMetricsHistory(["hba1c"], 90);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/program/me/metrics-history?codes=hba1c&days=90",
      { method: "GET" },
    );
  });

  it("mapea el wire sparse/ASC sin transformar: heightCm, target y favorableDirection viajan tal cual", async () => {
    apiFetchMock.mockResolvedValue(historyFixture);
    const history = await getMetricsHistory();
    expect(history.heightCm).toBe(168);
    expect(history.metrics[0]).toEqual({
      code: "hba1c",
      unit: "%",
      target: { lo: null, hi: 5.7 },
      favorableDirection: "down",
      points: [
        { date: "2026-02-18", value: 6.4 },
        { date: "2026-06-25", value: 6.0 },
      ],
    });
    // Métrica sin unit/target/dirección (bmi) no se rellena con defaults.
    expect(history.metrics[1].unit).toBeNull();
    expect(history.metrics[1].target).toBeNull();
    expect(history.metrics[1].favorableDirection).toBeNull();
  });

  it("METRICS_HISTORY_CODES incluye weight para el fallback cliente de IMC y DAYS es 180", () => {
    expect(METRICS_HISTORY_CODES).toEqual([
      "bmi",
      "hba1c",
      "body_fat",
      "weight",
      "step_count",
      "activity_kcal",
    ]);
    expect(METRICS_HISTORY_DAYS).toBe(180);
  });
});

describe("getMetricsHistory — 404 degradado honestamente (nunca tragado)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("404 NO_ACTIVE_ENROLLMENT propaga como ApiError con code — el Home degrada a requires-data", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({
        message: "No active enrollment",
        status: 404,
        code: "NO_ACTIVE_ENROLLMENT",
        errorType: "business",
      }),
    );
    await expect(getMetricsHistory()).rejects.toMatchObject({
      status: 404,
      code: "NO_ACTIVE_ENROLLMENT",
    });
  });

  it("404 sin body ProblemDetails también viaja como ApiError", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "HTTP 404", status: 404 }),
    );
    await expect(getMetricsHistory()).rejects.toMatchObject({ status: 404 });
  });
});

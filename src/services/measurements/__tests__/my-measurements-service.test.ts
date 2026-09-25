import { describe, expect, it, vi, beforeEach } from "vitest";

// Contract test del wire self-service (Historia clínica): params pageSize/
// cursor/codes en la URL, DTO mínimo tipado, paginación por cursor opaco y
// propagación de 401/404 como ApiError — el consumidor degrada a estados
// honestos (vacío/error + reintento), nunca a una pared de error.
const apiFetchMock = vi.fn();

vi.mock("../../../utils/apiClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../utils/apiClient")>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

import {
  getMyMeasurements,
  getMyMetricsHistory,
  MY_MEASUREMENTS_PAGE_SIZE,
  MY_METRICS_HISTORY_DAYS,
} from "../my-measurements-service";
import { ApiError } from "../../../utils/apiClient";
import type { CursorPagedResult, MeasurementItemDto } from "../types";

const itemFixture: MeasurementItemDto = {
  id: "11111111-1111-4111-8111-111111111111",
  metricCode: "weight",
  metricName: "Peso",
  value: 70.5,
  unitCode: "kg",
  unitSymbol: "kg",
  observedAt: "2026-08-15T14:30:00.000+00:00",
  source: "device",
};

const pageFixture: CursorPagedResult<MeasurementItemDto> = {
  items: [itemFixture],
  nextCursor: "Y3Vyc29yLW9wYWNv",
  hasNextPage: true,
};

describe("getMyMeasurements — params y contrato FROZEN", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("sin opciones pide la ruta base con GET (el backend aplica pageSize 20)", async () => {
    apiFetchMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasNextPage: false,
    });
    const page = await getMyMeasurements();
    expect(page.items).toEqual([]);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/me/measurements", {
      method: "GET",
    });
    expect(MY_MEASUREMENTS_PAGE_SIZE).toBe(20);
  });

  it("emite pageSize, cursor y codes en la URL", async () => {
    apiFetchMock.mockResolvedValue(pageFixture);
    await getMyMeasurements({
      pageSize: 10,
      cursor: "abc+def/ghi=",
      codes: ["weight", "bmi"],
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/me/measurements?pageSize=10&cursor=abc%2Bdef%2Fghi%3D&codes=weight%2Cbmi",
      { method: "GET" },
    );
  });

  it("mapea el DTO mínimo sin transformar (sin notas, createdBy ni encounterId)", async () => {
    apiFetchMock.mockResolvedValue(pageFixture);
    const page = await getMyMeasurements({ pageSize: 20 });
    expect(page.items[0]).toEqual(itemFixture);
    expect(page.nextCursor).toBe("Y3Vyc29yLW9wYWNv");
    expect(page.hasNextPage).toBe(true);
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual([
      "id",
      "metricCode",
      "metricName",
      "observedAt",
      "source",
      "unitCode",
      "unitSymbol",
      "value",
    ]);
  });
});

describe("getMyMeasurements — errores honestos (nunca tragados)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("401 sesión inválida propaga como ApiError", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Unauthorized", status: 401 }),
    );
    await expect(getMyMeasurements()).rejects.toMatchObject({ status: 401 });
  });

  it("404 sin perfil de paciente propaga como ApiError", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({
        message: "No existe un perfil de paciente",
        status: 404,
        errorType: "business",
      }),
    );
    await expect(getMyMeasurements()).rejects.toMatchObject({ status: 404 });
  });
});

describe("getMyMetricsHistory — serie abierta (sin inscripción)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("pide codes+days al endpoint abierto con GET", async () => {
    apiFetchMock.mockResolvedValue({ heightCm: null, metrics: [] });
    await getMyMetricsHistory(["weight", "bmi"], 90);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/me/metrics-history?codes=weight%2Cbmi&days=90",
      { method: "GET" },
    );
    expect(MY_METRICS_HISTORY_DAYS).toBe(180);
  });

  it("404 sin perfil propaga como ApiError (la serie abierta no exige inscripción)", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "No existe un perfil", status: 404 }),
    );
    await expect(getMyMetricsHistory(["weight"])).rejects.toMatchObject({
      status: 404,
    });
  });
});

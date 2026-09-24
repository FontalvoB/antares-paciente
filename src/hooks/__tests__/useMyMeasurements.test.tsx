import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../../utils/apiClient";
import { measurementsKeys } from "../queryKeys";
import type { MeasurementItemDto } from "../../services/measurements/types";

const getMyMeasurementsMock = vi.fn();

vi.mock("../../services/measurements/my-measurements-service", () => ({
  getMyMeasurements: (...args: unknown[]) => getMyMeasurementsMock(...args),
}));

import { useMyMeasurements } from "../useMyMeasurements";

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function item(id: string, value: number): MeasurementItemDto {
  return {
    id,
    metricCode: "weight",
    metricName: "Peso",
    value,
    unitCode: "kg",
    unitSymbol: "kg",
    observedAt: "2026-08-15T14:30:00.000+00:00",
    source: "device",
  };
}

describe("useMyMeasurements — paginación por cursor", () => {
  beforeEach(() => {
    getMyMeasurementsMock.mockReset();
  });

  it("loading inicial → items vacíos + isLoading", async () => {
    getMyMeasurementsMock.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const { result } = renderHook(() => useMyMeasurements(), {
      wrapper: makeWrapper(newClient()),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("primera página → items + hasNextPage; loadMore concatena con el cursor y sin duplicados", async () => {
    getMyMeasurementsMock
      .mockResolvedValueOnce({
        items: [item("id-1", 70.5), item("id-2", 71)],
        nextCursor: "cursor-1",
        hasNextPage: true,
      })
      .mockResolvedValueOnce({
        // id-2 repetido por solape de ventana keyset → se deduplica.
        items: [item("id-2", 71), item("id-3", 72)],
        nextCursor: null,
        hasNextPage: false,
      });
    const client = newClient();
    const { result } = renderHook(() => useMyMeasurements({ pageSize: 2 }), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(true);
    expect(getMyMeasurementsMock).toHaveBeenCalledWith({
      pageSize: 2,
      cursor: undefined,
      codes: undefined,
    });

    await result.current.loadMore();
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.items.map((i) => i.id)).toEqual([
      "id-1",
      "id-2",
      "id-3",
    ]);
    expect(result.current.hasNextPage).toBe(false);
    expect(getMyMeasurementsMock).toHaveBeenLastCalledWith({
      pageSize: 2,
      cursor: "cursor-1",
      codes: undefined,
    });
    expect(
      client.getQueryData([...measurementsKeys.myMeasurements, 2, ""]),
    ).toBeDefined();
  });

  it("error 401 sin cache → error honesto + items vacíos (la UI muestra reintento)", async () => {
    getMyMeasurementsMock.mockRejectedValue(
      new ApiError({ message: "Unauthorized", status: 401 }),
    );
    const { result } = renderHook(() => useMyMeasurements(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.items).toEqual([]);
    expect(result.current.error?.status).toBe(401);
  });

  it("error 404 sin perfil → error honesto con status 404", async () => {
    getMyMeasurementsMock.mockRejectedValue(
      new ApiError({
        message: "No existe un perfil",
        status: 404,
        errorType: "business",
      }),
    );
    const { result } = renderHook(() => useMyMeasurements(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.status).toBe(404);
  });

  it("reload relee desde la primera página", async () => {
    getMyMeasurementsMock.mockResolvedValue({
      items: [item("id-1", 70.5)],
      nextCursor: null,
      hasNextPage: false,
    });
    const { result } = renderHook(() => useMyMeasurements(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await result.current.reload();
    await waitFor(() => expect(getMyMeasurementsMock).toHaveBeenCalledTimes(2));
  });
});

/**
 * useMyMetricsHistory — serie abierta de métricas clínicas propias.
 *
 * Envuelve `GET /api/v1/me/metrics-history` (contrato FROZEN): no exige
 * inscripción activa y devuelve `heightCm` (última talla del perfil clínico)
 * junto con las series solicitadas. Lo usa el Perfil corporal para calcular el
 * IMC cuando la talla no existe como fila de `clinical_measurements`.
 *
 * Errores: se propagan como `ApiError`; el consumidor degrada a "sin datos"
 * (nunca a una pared de error). Sin mock fallback.
 */

import { useQuery } from "@tanstack/react-query";
import { measurementsKeys } from "./queryKeys";
import {
  getMyMetricsHistory,
  MY_METRICS_HISTORY_DAYS,
} from "../services/measurements/my-measurements-service";
import type { MetricsHistoryDto } from "../services/program/types";
import type { ApiError } from "../utils/apiClient";

export function useMyMetricsHistory(
  codes: readonly string[],
  days = MY_METRICS_HISTORY_DAYS,
) {
  const codesKey = codes.join(",");
  const query = useQuery<MetricsHistoryDto, ApiError>({
    queryKey: [...measurementsKeys.myMetricsHistory, codesKey, days],
    queryFn: () => getMyMetricsHistory(codes, days),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    history: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.isError ? (query.error ?? null) : null,
    reload: () => query.refetch(),
  };
}

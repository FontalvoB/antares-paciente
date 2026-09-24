/**
 * Mediciones self-service — `GET /api/v1/me/measurements` y
 * `GET /api/v1/me/metrics-history` (Fase 7, móvil).
 *
 * El paciente se resuelve en el backend desde el JWT (anti-IDOR): el cliente
 * nunca envía ids. Sin perfil vinculado el backend responde 404; sin
 * inscripción activa `metrics-history` responde la serie igual (el endpoint
 * abierto no exige inscripción — a diferencia de
 * `/api/v1/program/me/metrics-history`).
 *
 * Defensivo, igual que metrics-history/scores-history: los errores viajan
 * como ApiError — el consumidor degrada a estados honestos, nunca a una
 * pared de error. No toasts, no mock fallback (R5.2).
 */

import { apiFetch } from "../../utils/apiClient";
import type { ApiFetchOptions } from "../../utils/apiClient";
import type { MetricsHistoryDto } from "../program/types";
import type {
  CursorPagedResult,
  GetMyMeasurementsOptions,
  MeasurementItemDto,
} from "./types";

const MY_MEASUREMENTS_PATH = "/api/v1/me/measurements";
const MY_METRICS_HISTORY_PATH = "/api/v1/me/metrics-history";

/** Tamaño de página que pide la Historia cuando no se indica otro. */
export const MY_MEASUREMENTS_PAGE_SIZE = 20;

/** Días del historial abierto cuando el llamador no indica ventana. */
export const MY_METRICS_HISTORY_DAYS = 180;

/**
 * Lee una página de mediciones clínicas propias (sin corte de fechas: el
 * backend pagina por cursor sobre todo el historial persistido).
 *
 * @param options - pageSize (1–100), cursor opaco, codes (códigos de métrica).
 * @returns Página tipada (items + nextCursor opaco + hasNextPage).
 * @throws ApiError — propagado, nunca tragado (R1.4, R7.4). 401 sesión
 *          inválida, 404 sin perfil de paciente, 400 pageSize/codes inválidos.
 */
export function getMyMeasurements(
  options: GetMyMeasurementsOptions = {},
): Promise<CursorPagedResult<MeasurementItemDto>> {
  const params = new URLSearchParams();
  if (options.pageSize != null)
    params.set("pageSize", String(options.pageSize));
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.codes?.length) params.set("codes", options.codes.join(","));
  const query = params.toString();
  return apiFetch<CursorPagedResult<MeasurementItemDto>>(
    `${MY_MEASUREMENTS_PATH}${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
}

/**
 * Lee la serie diaria por métrica del paciente autenticado (contrato FROZEN
 * `MetricsHistoryDto`: `{ heightCm, metrics: [{ code, unit, target,
 * favorableDirection, points: [{date,value}] }] }` — SOLO códigos CON filas,
 * fechas ASC). No requiere inscripción activa.
 *
 * @param codes - códigos de métrica pedidos (se emiten los del catálogo).
 * @param days - ventana pedida al backend (default 180, rango 7–365).
 * @returns El DTO del historial abierto.
 * @throws ApiError — propagado, nunca tragado. 404 sin perfil de paciente.
 */
export function getMyMetricsHistory(
  codes: readonly string[],
  days = MY_METRICS_HISTORY_DAYS,
  options: Pick<ApiFetchOptions, "cache"> = {},
): Promise<MetricsHistoryDto> {
  return apiFetch<MetricsHistoryDto>(
    `${MY_METRICS_HISTORY_PATH}?codes=${encodeURIComponent(codes.join(","))}&days=${days}`,
    { ...options, method: "GET" },
  );
}

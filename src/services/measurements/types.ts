/**
 * Mediciones self-service del paciente (Fase 7, móvil).
 *
 * Contratos FROZEN del backend (`GET /api/v1/me/measurements`,
 * `GET /api/v1/me/metrics-history`): `MeasurementItemDto` es el DTO mínimo
 * (sin notas clínicas, `createdBy` ni `encounterId`) y `CursorPagedResult`
 * expone la paginación por cursor opaco (`nextCursor` + `hasNextPage`).
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

/** Fila mínima de una medición clínica propia (wire camelCase del backend). */
export interface MeasurementItemDto {
  id: string;
  metricCode: string;
  metricName: string;
  value: number;
  unitCode: string;
  unitSymbol: string;
  /** ISO-8601 con offset (DateTimeOffset del backend). */
  observedAt: string;
  /** Origen: `device` | `patient` | `professional` | `lab` (más alias
   * clínicos como `seed-hist`/`provider`/`clinic`, que la UI agrupa como
   * consulta médica). */
  source: string;
}

/** Página por cursor opaco: `nextCursor` null + `hasNextPage` false = última. */
export interface CursorPagedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

/** Params del query `GET /api/v1/me/measurements`. */
export interface GetMyMeasurementsOptions {
  /** 1–100 (default del backend: 20). */
  pageSize?: number;
  /** Cursor opaco de la página anterior; ausente = primera página. */
  cursor?: string | null;
  /** Filtro por códigos canónicos de métrica (case-insensitive en el backend). */
  codes?: readonly string[];
}

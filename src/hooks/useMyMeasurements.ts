/**
 * useMyMeasurements — historial clínico paginado (pestaña Historia).
 *
 * Envuelve `useInfiniteQuery` de TanStack alrededor de `getMyMeasurements()`
 * (GET /api/v1/me/measurements, contrato FROZEN): primera página al montar y
 * páginas siguientes con `loadMore()` (cursor opaco del backend, concatenación
 * sin duplicados por `id`). staleTime 5 min: el historial clínico cambia en
 * días, no en segundos.
 *
 * Error contract (R5.2, patrón de useScoresHistory): NUNCA toast en un query;
 * TanStack conserva el cache previo en un refetch fallido; sin cache el query
 * queda en isError y la UI muestra estados honestos (vacío/error + reintento).
 * NO hay mock fallback: el endpoint puede 404 sin perfil — el consumidor
 * degrada a estado honesto, nunca a una pared de error.
 *
 * Sesiones: ante `onSessionInvalid` se descartan las páginas cacheadas para
 * que datos de la sesión A nunca se muestren en la sesión B; el remount tras
 * login recarga con el token nuevo.
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { useEffect, useMemo } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getMyMeasurements } from "../services/measurements/my-measurements-service";
import type {
  CursorPagedResult,
  GetMyMeasurementsOptions,
  MeasurementItemDto,
} from "../services/measurements/types";
import { measurementsKeys } from "./queryKeys";
import { onSessionInvalid } from "../utils/authApi";
import { ApiError } from "../utils/apiClient";

export interface UseMyMeasurementsResult {
  /** Items acumulados de todas las páginas cargadas (sin duplicados). */
  items: MeasurementItemDto[];
  /** Carga inicial (sin páginas en cache). */
  isLoading: boolean;
  /** Cargando una página adicional (`loadMore` en vuelo). */
  isFetchingMore: boolean;
  /** Error de la primera página sin cache (null con datos o cargando). */
  error: ApiError | null;
  /** Quedan páginas por pedir (`nextCursor` del backend). */
  hasNextPage: boolean;
  /** Pide la siguiente página con el cursor opaco (no-op sin más páginas). */
  loadMore: () => Promise<unknown>;
  /** Relee desde la primera página (reintento de error). */
  reload: () => Promise<unknown>;
}

export function useMyMeasurements(
  options: GetMyMeasurementsOptions = {},
): UseMyMeasurementsResult {
  const queryClient = useQueryClient();
  const pageSize = options.pageSize;
  const codesKey = options.codes?.join(",") ?? "";

  // Sesión invalidada → se descartan las páginas: la sesión B nunca ve
  // datos de la sesión A (el remount tras login recarga con el token nuevo).
  useEffect(
    () =>
      onSessionInvalid(() => {
        void queryClient.removeQueries({
          queryKey: measurementsKeys.myMeasurements,
        });
      }),
    [queryClient],
  );

  const query = useInfiniteQuery<
    CursorPagedResult<MeasurementItemDto>,
    ApiError,
    InfiniteData<CursorPagedResult<MeasurementItemDto>>,
    readonly unknown[],
    string | null
  >({
    queryKey: [...measurementsKeys.myMeasurements, pageSize ?? null, codesKey],
    queryFn: ({ pageParam }) =>
      getMyMeasurements({
        pageSize,
        cursor: pageParam ?? undefined,
        codes: options.codes,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage && lastPage.nextCursor
        ? lastPage.nextCursor
        : undefined,
    staleTime: 5 * 60 * 1000,
  });

  // Concatenación sin duplicados por `id`: si el historial cambia entre
  // páginas (nueva medición del anillo), la ventana keyset puede solapar.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: MeasurementItemDto[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          out.push(item);
        }
      }
    }
    return out;
  }, [query.data]);

  return {
    items,
    isLoading: query.isLoading,
    isFetchingMore: query.isFetchingNextPage,
    error: query.isError ? (query.error ?? null) : null,
    hasNextPage: query.hasNextPage ?? false,
    loadMore: () => query.fetchNextPage(),
    reload: () => query.refetch(),
  };
}

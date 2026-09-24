/**
 * useMyNutritionPlan — plan alimentario asignado (pestañas Plan/Hoy).
 *
 * Envuelve `useQuery` de TanStack alrededor de `getMyNutritionPlan()`
 * (GET /api/v1/me/nutrition-plan): 404 sin plan → `plan: null` con estado
 * vacío honesto (el servicio absorbe el 404, no es error). staleTime 5 min:
 * el plan lo prescribe el profesional y cambia en días, no en segundos.
 *
 * Error contract (R5.2, patrón de useScoresHistory): NUNCA toast en un query;
 * sin cache el query queda en isError y la UI muestra error + reintento.
 *
 * Sesiones: ante `onSessionInvalid` se descarta el plan cacheado para que
 * datos de la sesión A nunca se muestren en la sesión B.
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyNutritionPlan } from "../services/nutrition/my-nutrition-plan-service";
import type { MyNutritionPlanDto } from "../services/nutrition/my-nutrition-plan-service";
import { nutritionKeys } from "./queryKeys";
import { onSessionInvalid } from "../utils/authApi";
import { ApiError } from "../utils/apiClient";

export interface UseMyNutritionPlanResult {
  /** Plan asignado (`null` sin plan: 404 absorbido por el servicio). */
  plan: MyNutritionPlanDto | null;
  /** Carga inicial (sin plan en cache). */
  isLoading: boolean;
  /** Error real (nunca 404: sin cache el consumidor muestra reintento). */
  error: ApiError | null;
  /** Relee el plan (reintento de error). */
  refetch: () => Promise<unknown>;
}

export function useMyNutritionPlan(): UseMyNutritionPlanResult {
  const queryClient = useQueryClient();

  // Sesión invalidada → se descarta el plan: la sesión B nunca ve el plan
  // de la sesión A (el remount tras login recarga con el token nuevo).
  useEffect(
    () =>
      onSessionInvalid(() => {
        void queryClient.removeQueries({
          queryKey: nutritionKeys.myNutritionPlan,
        });
      }),
    [queryClient],
  );

  const query = useQuery<MyNutritionPlanDto | null, ApiError>({
    queryKey: [...nutritionKeys.myNutritionPlan],
    queryFn: getMyNutritionPlan,
    staleTime: 5 * 60 * 1000,
  });

  return {
    plan: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError ? (query.error ?? null) : null,
    refetch: () => query.refetch(),
  };
}

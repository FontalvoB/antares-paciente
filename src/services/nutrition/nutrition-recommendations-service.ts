import { apiFetch } from '../../utils/apiClient';
import type { NutritionRecommendationsResponseDto } from './nutrition-cycle-recommendation-types';

/** 3.10: identidad exclusiva del JWT; no se envían IDs ni se reordenan publicaciones. */
export function getMyNutritionRecommendations(language: 'es' | 'en', signal?: AbortSignal, expectedUserId?: string | null): Promise<NutritionRecommendationsResponseDto> {
  return apiFetch<NutritionRecommendationsResponseDto>('/api/v1/me/nutrition/cycles/recommendations', {
    method: 'GET', cache: 'no-store', signal, expectedUserId,
    headers: { 'Accept-Language': language, 'X-App-Language': language },
  });
}

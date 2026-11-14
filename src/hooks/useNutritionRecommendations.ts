import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { getMyNutritionRecommendations } from '../services/nutrition/nutrition-recommendations-service';
import { ApiError } from '../utils/apiClient';
import { getAccessToken, onSessionInvalid } from '../utils/authApi';
import { sessionUserId } from '../utils/sessionIdentity';
import { nutritionKeys } from './queryKeys';

const SESSION_ERROR = new ApiError({ message: 'Session expired', status: 401 });

/** Caché en memoria por cuenta/idioma; las firmas de 5 min se renuevan antes de caducar. */
export function useNutritionRecommendations() {
  const { authLoading } = useApp();
  const { lang } = useI18n();
  const userId = sessionUserId(getAccessToken());
  const client = useQueryClient();
  const [sessionInvalid, setSessionInvalid] = useState(false);
  useEffect(() => onSessionInvalid(() => {
    setSessionInvalid(true);
    client.removeQueries({ queryKey: nutritionKeys.recommendations });
  }), [client]);
  useEffect(() => { if (userId) setSessionInvalid(false); }, [userId]);

  const query = useQuery({
    queryKey: [...nutritionKeys.recommendations, userId, lang],
    queryFn: ({ signal }) => getMyNutritionRecommendations(lang, signal, userId),
    enabled: !authLoading && Boolean(userId) && !sessionInvalid,
    staleTime: 4 * 60_000,
    refetchInterval: query => query.state.error instanceof ApiError && [401, 403].includes(query.state.error.status) ? false : 4 * 60_000,
    gcTime: 0,
    retry: false,
  });
  const error = sessionInvalid || (!authLoading && !userId) ? SESSION_ERROR : query.error;
  return {
    // Un error de refetch oculta también los datos anteriores: nunca se presentan como vigentes.
    recommendations: error ? undefined : query.data,
    isLoading: !error && query.isLoading,
    isFetching: query.isFetching,
    error,
    refetch: query.refetch,
  };
}

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyNutritionPlanStatus } from '../services/nutrition/my-nutrition-plan-service'
import { nutritionKeys } from './queryKeys'
import { onSessionInvalid } from '../utils/authApi'

const statusKey = [...nutritionKeys.myNutritionPlan, 'status'] as const

export function useNutritionPlanStatus() {
  const client = useQueryClient()
  const previous = useRef<string | undefined>(undefined)
  const query = useQuery({ queryKey: statusKey, queryFn: getMyNutritionPlanStatus, staleTime: 30_000,
    refetchInterval: q => q.state.data?.status === 'active' ? 60_000 : ['generating', 'pending_review'].includes(q.state.data?.status ?? '') ? 30_000 : false,
  })
  useEffect(() => onSessionInvalid(() => { client.removeQueries({ queryKey: statusKey }); previous.current = undefined }), [client])
  useEffect(() => {
    const status = query.data?.status
    const signature = query.data ? [status, query.data.currentDay, query.data.startDate, query.data.endDate, query.data.planId, query.data.revision].join('|') : undefined
    if (previous.current !== signature && (status === 'active' || previous.current?.startsWith('active|'))) {
      void client.invalidateQueries({ queryKey: nutritionKeys.myNutritionPlan, exact: true })
      void client.invalidateQueries({ queryKey: ['program', 'snapshot'] })
    }
    previous.current = signature
  }, [client, query.data?.status, query.data?.currentDay, query.data?.startDate, query.data?.endDate, query.data?.planId, query.data?.revision])
  return { status: query.data ?? null, isLoading: query.isLoading, error: query.isError ? query.error : null, refetch: query.refetch }
}

import { useQuery } from '@tanstack/react-query';
import { useMedicationCapabilities } from './useMedicationCapabilities';
import { fetchMyMedications, isRequiredMedication } from '../utils/medicationsApi';
import { toLocalISODate } from '../utils/dates';

/** Misma consulta y mismos registros que la pantalla de medicamentos. */
export function useDailyMedications() {
  const capability = useMedicationCapabilities();
  const date = toLocalISODate();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const query = useQuery({
    queryKey: ['medications', 'workspace', capability.owner, date, zone],
    queryFn: ({signal}) => fetchMyMedications(capability.owner!, date, zone, signal),
    enabled: Boolean(capability.owner && capability.enabled), retry: false, staleTime: 0,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always',
  });
  const assigned = new Set(query.data?.treatments.filter(isRequiredMedication).map(t => t.id));
  const doses = query.data?.doses.filter(d => assigned.has(d.treatmentId) && d.status !== 'cancelled') ?? [];
  return { enabled: capability.enabled, data: query.data, isLoading: query.isLoading, isError: query.isError,
    scheduled: doses.length, recorded: doses.filter(d => d.status === 'taken').length,
    extras: query.data?.treatments.filter(t => t.productType === 'supplement' && t.status === 'active').length ?? 0 };
}

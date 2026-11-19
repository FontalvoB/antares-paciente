import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMedicationCapabilities } from './useMedicationCapabilities';
import { fetchMyMedications, fetchMyMedicationVersion, isRequiredMedication } from '../utils/medicationsApi';
import { ApiError } from '../utils/apiClient';
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
  useMedicationLiveRefresh(capability.owner, capability.enabled ? query.data?.version : undefined);
  const assigned = new Set(query.data?.treatments.filter(isRequiredMedication).map(t => t.id));
  const doses = query.data?.doses.filter(d => assigned.has(d.treatmentId) && d.status !== 'cancelled') ?? [];
  return { enabled: capability.enabled, capabilityLoading: capability.isLoading, data: query.data, isLoading: query.isLoading, isError: query.isError,
    nextDose: doses.find(d => d.status === 'pending'), scheduled: doses.length, recorded: doses.filter(d => d.status === 'taken').length,
    extras: query.data?.treatments.filter(t => t.productType === 'supplement' && t.status === 'active').length ?? 0 };
}

/** Consulta liviana por cuenta mientras la pantalla esté visible. */
export function useMedicationLiveRefresh(owner: string | undefined | null, version: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!owner || !version) return;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const next = await fetchMyMedicationVersion(owner, controller.signal);
        if (!controller.signal.aborted && next !== version) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["medications", "workspace", owner] }),
            queryClient.invalidateQueries({ queryKey: ["medications", "inventory", owner] }),
          ]);
        }
      } catch (error) {
        if (!controller.signal.aborted && error instanceof ApiError && [401, 403].includes(error.status)) {
          await queryClient.invalidateQueries({ queryKey: ["medications", "capabilities", owner] });
        }
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => void check(), 4000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [owner, queryClient, version]);
}

import { useQuery } from "@tanstack/react-query";
import { useApp } from "../context/AppContext";
import { getAccessToken } from "../utils/authApi";
import { sessionUserId } from "../utils/sessionIdentity";
import { fetchMedicationCapabilities } from "../utils/medicationsApi";

/** La habilitación de datos y acciones depende del servidor; no cambia la navegación. */
export function useMedicationCapabilities() {
  const { flow, user } = useApp();
  const owner = flow === "app" && user.id ? sessionUserId(getAccessToken()) : null;
  const query = useQuery({
    queryKey: ["medications", "capabilities", owner],
    queryFn: ({ signal }) => fetchMedicationCapabilities(owner!, signal),
    enabled: Boolean(owner),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 60_000,
  });
  const capability = !query.isError ? query.data?.modules?.medications : undefined;
  return {
    owner,
    enabled: Boolean(owner && capability?.enabled === true && capability.canView === true),
    canManage: Boolean(owner && capability?.enabled === true && capability.canManage === true),
    isLoading: Boolean(owner && query.isLoading),
    refresh: query.refetch,
  };
}

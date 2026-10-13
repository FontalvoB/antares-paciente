import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
      networkMode: "online",
    },
  },
});

/** Descarta datos y peticiones de la sesión anterior antes de montar otro usuario. */
export function resetSessionQueryCache() {
  queryClient.clear();
}

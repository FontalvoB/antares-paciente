import { useInfiniteQuery } from "@tanstack/react-query";
import { getMyDocuments } from "../services/documents/my-documents-service";

/** Cada cuenta conserva su propia consulta; el cambio de sesión cancela y limpia
 * la caché compartida mediante resetSessionQueryCache. No hay archivos de muestra. */
export function useMyDocuments(ownerId?: string) {
  const query = useInfiniteQuery({
    queryKey: ["my-documents", ownerId],
    enabled: Boolean(ownerId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getMyDocuments(pageParam, signal),
    getNextPageParam: page => page.page < page.totalPages ? page.page + 1 : undefined,
    staleTime: 0,
  });
  const unique = new Map(query.data?.pages.flatMap(page => page.items).map(item => [item.id, item]));
  return {
    items: [...unique.values()],
    loading: query.isLoading,
    error: query.isError,
    hasMore: query.hasNextPage,
    fetchingMore: query.isFetchingNextPage,
    reload: () => query.refetch(),
    loadMore: () => query.fetchNextPage(),
  };
}

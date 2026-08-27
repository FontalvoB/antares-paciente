import {
  cacheExchange,
  createClient,
  fetchExchange,
  subscriptionExchange,
} from 'urql'
import { createClient as createWsClient, type Client as WsClient } from 'graphql-ws'
import { getAccessToken } from '../utils/authApi'

/** URL del WebSocket de GraphQL. Se toma de la env VITE_COMMUNITY_WS_URL y,
 *  si no está definida, cae a ws://localhost:5200/graphql para desarrollo. */
const WS_URL = import.meta.env.VITE_COMMUNITY_WS_URL ?? 'ws://localhost:5200/graphql'

// Cliente WS activo a nivel de módulo. Se conserva la referencia para poder
// cerrar (dispose) la conexión anterior cuando se recrea el cliente urql en una
// transición de autenticación (login/logout sin recargar la página).
let activeWsClient: WsClient | null = null

/** Cierra la conexión WebSocket anterior antes de crear una nueva. */
function disposeActiveWsClient() {
  if (activeWsClient) {
    try {
      activeWsClient.dispose()
    } catch {
      // Ignorado: la conexión pudo cerrarse antes de forma natural.
    }
    activeWsClient = null
  }
}

/**
 * Crea un cliente GraphQL de la comunidad completamente nuevo: cache limpia y
 * conexión WS nueva. Se invoca en cada transición de autenticación (login/
 * logout) para que urql no sirva datos en caché del usuario anterior y el WS
 * use el token (Bearer) del usuario actual.
 *
 * El `connectionParams` del WS lee el token en el momento de la conexión, así
 * que el cliente recreado usa la cuenta nueva automáticamente.
 */
export function createCommunityClient() {
  // Cerramos la conexión WS previa antes de reemplazarla.
  disposeActiveWsClient()

  // WebSocket client para GraphQL subscriptions (lee el token actual al conectar).
  const wsClient = createWsClient({
    url: WS_URL,
    connectionParams: () => ({
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    }),
  })
  activeWsClient = wsClient

  return createClient({
    url: '/graphql',
    exchanges: [
      cacheExchange,
      subscriptionExchange({
        forwardSubscription: (operation) => ({
          subscribe: (sink) => ({
            unsubscribe: wsClient.subscribe(
              {
                query: operation.query ?? '',
                variables: operation.variables,
                operationName: operation.operationName ?? '',
              },
              sink as any,
            ),
          }),
        }),
      }),
      fetchExchange,
    ],
    fetchOptions: (): RequestInit => {
      const token = getAccessToken()
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      return { headers }
    },
  })
}

/** Instancia por defecto (para imports existentes). Las transiciones de auth
 *  usan `createCommunityClient()` para obtener un cliente con cache limpia. */
export const communityClient = createCommunityClient()

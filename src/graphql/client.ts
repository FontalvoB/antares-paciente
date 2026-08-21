import {
  cacheExchange,
  createClient,
  fetchExchange,
  subscriptionExchange,
} from 'urql'
import { createClient as createWsClient } from 'graphql-ws'
import { getAccessToken } from '../utils/authApi'

/** WebSocket client para GraphQL subscriptions (dev only). */
const wsClient = createWsClient({
  url: 'ws://localhost:5200/graphql',
  connectionParams: () => ({
    Authorization: `Bearer ${getAccessToken() ?? ''}`,
  }),
})

/** Cliente GraphQL de la comunidad. Usa el proxy de Vite (mismo origen) y el
 *  JWT guardado en sessionStorage para autenticar cada request. */
export const communityClient = createClient({
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

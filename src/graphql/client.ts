import { cacheExchange, createClient, fetchExchange } from 'urql'
import { getAccessToken } from '../utils/authApi'

/** Cliente GraphQL de la comunidad. Usa el proxy de Vite (mismo origen) y el
 *  JWT guardado en sessionStorage para autenticar cada request. */
export const communityClient = createClient({
  url: '/graphql',
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: (): RequestInit => {
    const token = getAccessToken()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    return { headers }
  },
})

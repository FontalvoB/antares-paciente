const ACCESS_TOKEN_KEY = 'copp_access_token'

export interface LoginResult {
  accessToken: string
  tokenType: string
  expiresIn: number
}

/**
 * Cliente del Auth service (COPP-ADRESD). En desarrollo se consume a través
 * del proxy de Vite (mismo origen → la cookie HttpOnly de refresh funciona
 * sin CORS). El application es el código de la app móvil: "app".
 */
async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let message = 'Error al conectarse con el servidor'
    try {
      const data = await res.json()
      if (data && typeof data.message === 'string') message = data.message
    } catch {
      /* el cuerpo no es JSON */
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

export async function loginUser(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
  const result = await postJson<LoginResult>('/api/auth/login', {
    email,
    password,
    application: 'app',
    rememberMe,
  })
  sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
  return result
}

export async function logoutUser(): Promise<void> {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  try {
    await postJson<{ message: string }>('/api/auth/logout')
  } catch {
    /* el logout es idempotente: sin cookie también responde 200 */
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

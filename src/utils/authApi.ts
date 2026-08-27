import { getAuthBaseUrl } from './apiBaseUrl'

const ACCESS_TOKEN_KEY = 'copp_access_token'

export interface LoginResult {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export interface ContactMethod {
  id: string
  type: 'Email' | 'Phone'
  label: string
}

export interface IdLookupResult {
  patientId: string
  firstName: string
  lastName: string
  documentNumber: string
  contacts: ContactMethod[]
}

export interface SendOtpResult {
  expiresInSeconds: number
  devCode?: string | null
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

export interface CurrentUser {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  permissions: string[]
}

/** Login con contraseña por número de identificación (usuarios ya registrados). */
export async function loginUser(documentNumber: string, password: string, rememberMe: boolean): Promise<LoginResult> {
  const result = await postJson<LoginResult>(`${getAuthBaseUrl()}/api/auth/login`, {
    documentNumber,
    password,
    application: 'app',
    rememberMe,
  })
  sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
  localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
  return result
}

/**
 * Primer inicio de sesión: consulta los correos y teléfonos asociados a un
 * número de identificación para que el usuario elija por dónde recibe el OTP.
 */
export async function lookupId(documentNumber: string): Promise<IdLookupResult> {
  return postJson<IdLookupResult>(`${getAuthBaseUrl()}/api/auth/id-lookup`, {
    documentNumber,
    application: 'app',
  })
}

/** Envía el código OTP al método de contacto elegido. */
export async function sendOtp(documentNumber: string, contactId: string): Promise<SendOtpResult> {
  return postJson<SendOtpResult>(`${getAuthBaseUrl()}/api/auth/send-otp`, {
    documentNumber,
    contactId,
  })
}

/** Verifica el OTP, aprovisiona la cuenta (si es la primera vez) y completa el login. */
export async function verifyOtp(documentNumber: string, otp: string, rememberMe: boolean): Promise<LoginResult> {
  const result = await postJson<LoginResult>(`${getAuthBaseUrl()}/api/auth/verify-otp`, {
    documentNumber,
    otp,
    application: 'app',
    rememberMe,
  })
  sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
  localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
  return result
}

/**
 * Intenta restaurar la sesión del usuario al cargar la app mediante el refresh
 * token (cookie HttpOnly copp_refresh_token).
 */
export async function restoreSession(): Promise<LoginResult | null> {
  try {
    const result = await postJson<LoginResult>(`${getAuthBaseUrl()}/api/auth/refresh`)
    sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
    localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
    return result
  } catch {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    return null
  }
}

/**
 * Obtiene la información del usuario autenticado actualmente si existe token activo.
 */
export async function getMe(): Promise<CurrentUser | null> {
  const token = getAccessToken()
  if (!token) return null
  try {
    const res = await fetch(`${getAuthBaseUrl()}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    })
    if (!res.ok) return null
    return (await res.json()) as CurrentUser
  } catch {
    return null
  }
}

export async function logoutUser(): Promise<void> {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  try {
    await postJson<{ message: string }>(`${getAuthBaseUrl()}/api/auth/logout`)
  } catch {
    /* el logout es idempotente: sin cookie también responde 200 */
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(ACCESS_TOKEN_KEY)
}


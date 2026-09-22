import { getAuthBaseUrl, getApplicationCode } from "./apiBaseUrl";

const ACCESS_TOKEN_KEY = "copp_access_token";

export interface LoginResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface ContactMethod {
  id: string;
  type: "Email" | "Phone";
  label: string;
}

export interface IdLookupResult {
  patientId: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  contacts: ContactMethod[];
}

export interface SendOtpResult {
  expiresInSeconds: number;
  devCode?: string | null;
}

/**
 * Error HTTP del Auth service con status numérico. Permite distinguir una
 * sesión muerta (401) de un fallo de red al decidir si se cierra la sesión.
 */
export class HttpStatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

/**
 * Cliente del Auth service (COPP-ADRESD). En desarrollo se consume a través
 * del proxy de Vite (mismo origen → la cookie HttpOnly de refresh funciona
 * sin CORS). El application es el código de la app móvil: "app".
 */
async function postJson<T>(path: string, body?: unknown): Promise<T> {
  // Timeout defensivo (10 s): en WebView nativo una IP inalcanzable puede
  // dejar el fetch colgado para siempre y con él el splash de arranque.
  const res = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    let message = "Error al conectarse con el servidor";
    try {
      const data = await res.json();
      if (data && typeof data.message === "string") message = data.message;
    } catch {
      /* el cuerpo no es JSON */
    }
    throw new HttpStatusError(message, res.status);
  }

  return res.json() as Promise<T>;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

export function persistAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** Login con contraseña por número de identificación (usuarios ya registrados). */
export async function loginUser(
  documentNumber: string,
  password: string,
  rememberMe: boolean,
): Promise<LoginResult> {
  const result = await postJson<LoginResult>(
    `${getAuthBaseUrl()}/api/auth/login`,
    {
      documentNumber,
      password,
      application: getApplicationCode(),
      rememberMe,
    },
  );
  persistAccessToken(result.accessToken);
  return result;
}

/**
 * Primer inicio de sesión: consulta los correos y teléfonos asociados a un
 * número de identificación para que el usuario elija por dónde recibe el OTP.
 */
export async function lookupId(
  documentNumber: string,
): Promise<IdLookupResult> {
  return postJson<IdLookupResult>(`${getAuthBaseUrl()}/api/auth/id-lookup`, {
    documentNumber,
    application: getApplicationCode(),
  });
}

/** Envía el código OTP al método de contacto elegido. */
export async function sendOtp(
  documentNumber: string,
  contactId: string,
): Promise<SendOtpResult> {
  return postJson<SendOtpResult>(`${getAuthBaseUrl()}/api/auth/send-otp`, {
    documentNumber,
    contactId,
  });
}

/** Verifica el OTP, aprovisiona la cuenta (si es la primera vez) y completa el login. */
export async function verifyOtp(
  documentNumber: string,
  otp: string,
  rememberMe: boolean,
): Promise<LoginResult> {
  const result = await postJson<LoginResult>(
    `${getAuthBaseUrl()}/api/auth/verify-otp`,
    {
      documentNumber,
      otp,
      application: getApplicationCode(),
      rememberMe,
    },
  );
  persistAccessToken(result.accessToken);
  return result;
}

/**
 * Intenta restaurar la sesión del usuario al cargar la app mediante el refresh
 * token (cookie HttpOnly copp_refresh_token).
 *
 * - 401 en el refresh = cookie ausente/inválida → la sesión ya NO es
 *   recuperable: se limpia el token y se notifica (vuelta al login).
 * - Fallo de red / backend caído con token local previo → se conserva la
 *   sesión (modo offline), el watcher de expiración la revalidará después.
 */
export async function restoreSession(): Promise<LoginResult | null> {
  // Token local previo: si el refresh falla por red caída, la sesión se
  // conserva (modo offline) con este token hasta que el watcher la revalide.
  const existingToken = getAccessToken();
  try {
    const result = await postJson<LoginResult>(
      `${getAuthBaseUrl()}/api/auth/refresh`,
    );
    persistAccessToken(result.accessToken);
    return result;
  } catch (err) {
    if (err instanceof HttpStatusError && err.status === 401) {
      clearSessionAndNotify();
      return null;
    }
    if (existingToken) {
      return {
        accessToken: existingToken,
        tokenType: "Bearer",
        expiresIn: 3600,
      };
    }
    clearAccessToken();
    return null;
  }
}

/**
 * Obtiene la información del usuario autenticado actualmente si existe token activo.
 */
export async function getMe(): Promise<CurrentUser | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getAuthBaseUrl()}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CurrentUser;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  clearAccessToken();
  try {
    await postJson<{ message: string }>(`${getAuthBaseUrl()}/api/auth/logout`);
  } catch {
    /* el logout es idempotente: sin cookie también responde 200 */
  }
}

export function getAccessToken(): string | null {
  return (
    sessionStorage.getItem(ACCESS_TOKEN_KEY) ??
    localStorage.getItem(ACCESS_TOKEN_KEY)
  );
}

/**
 * `exp` del JWT en milisegundos (epoch). `null` si el token no es un JWT
 * decodificable (p. ej. el token demo de acceso local).
 */
export function getTokenExpiry(
  token: string | null = getAccessToken(),
): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * ¿El access token actual ya venció? Margen por defecto de 30 s para evitar
 * usarlo justo cuando expira. Token demo o ilegible → `false` (no participa).
 */
export function isAccessTokenExpired(skewMs = 30_000): boolean {
  const expiry = getTokenExpiry();
  return expiry !== null && Date.now() >= expiry - skewMs;
}

type SessionInvalidListener = () => void;
const sessionInvalidListeners = new Set<SessionInvalidListener>();

export function onSessionInvalid(listener: SessionInvalidListener): () => void {
  sessionInvalidListeners.add(listener);
  return () => sessionInvalidListeners.delete(listener);
}

export function clearSessionAndNotify(): void {
  clearAccessToken();
  sessionInvalidListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore subscriber error */
    }
  });
}

export async function ensureFreshAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token && !isAccessTokenExpired()) return token;
  const restored = await restoreSession();
  return restored?.accessToken ?? null;
}

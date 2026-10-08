import { getAuthBaseUrl, getApplicationCode } from "./apiBaseUrl";
import { ApiError } from "./apiClient";

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
      else if (data && typeof data.detail === "string") message = data.detail;
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

/**
 * Define la PRIMERA contraseña de una cuenta OTP (POST /api/auth/set-first-password).
 * Requiere sesión activa (Bearer) y falla si la cuenta ya tiene contraseña.
 */
export async function setFirstPassword(newPassword: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${getAuthBaseUrl()}/api/auth/set-first-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ newPassword }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    let message = `No se pudo establecer la contraseña (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* respuesta sin JSON: se usa el mensaje por defecto */
    }
    throw new ApiError({ status: res.status, message });
  }
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
/** Promesa de restauración en vuelo: coalesce a todos los llamadores
 *  concurrentes del boot (AppContext.checkSession + cliente GraphQL vía
 *  ensureFreshAccessToken). Sin esto, dos refresh simultáneos con la misma
 *  cookie rotan y compiten: el perdedor activa la detección de reuso del
 *  backend (401 "invalid") y la sesión se mata a sí misma. */
let restoreInFlight: Promise<LoginResult | null> | null = null;

export async function restoreSession(): Promise<LoginResult | null> {
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = restoreSessionOnce().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}

async function restoreSessionOnce(): Promise<LoginResult | null> {
  // Token local previo: si el refresh falla por red caída, la sesión se
  // conserva (modo offline) con este token hasta que el watcher la revalide.
  const existingToken = getAccessToken();
  const { status, result } = await sharedRefresh();
  if (status === 401) {
    clearSessionAndNotify();
    return null;
  }
  if (result) return result;
  // Fallo de red (status 0): la sesión se conserva con el token local previo.
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
    await postJson<{ message: string }>(`${getAuthBaseUrl()}/api/auth/logout`, {
      application: getApplicationCode(),
    });
  } catch {
    /* el logout es idempotente: sin cookie también responde 200 */
  }
}

/**
 * Pide al Auth Service un código opaco de un solo uso (vida de segundos) para
 * abrir la web de eliminación de cuenta. La web lo canjea por un token propio:
 * ningún token viaja en la URL. Reintenta una vez tras renovar si el access
 * token venció justo en ese momento.
 */
export async function createAccountDeletionHandoff(): Promise<string> {
  const call = (token: string) =>
    fetch(`${getAuthBaseUrl()}/api/auth/account/deletion-handoff`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: AbortSignal.timeout(10000),
    });

  const token = await ensureFreshAccessToken();
  if (!token) throw new ApiError({ status: 401, message: "Sesión no válida" });

  let res = await call(token);
  if (res.status === 401) {
    const { result } = await sharedRefresh();
    if (result) res = await call(result.accessToken);
  }
  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      message: `No se pudo preparar la eliminación de la cuenta (${res.status})`,
    });
  }
  const body = (await res.json()) as { code: string };
  return body.code;
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

// --- Single-flight de refresh COMPARTIDO por toda la app ---

/**
 * Resultado del refresh compartido: `status` HTTP del backend (0 = fallo de
 * red sin respuesta) y el `LoginResult` si el refresh fue exitoso.
 */
export interface SharedRefreshResult {
  status: number;
  result: LoginResult | null;
}

/**
 * ÚNICO punto de refresh para toda la app (login por cookie HttpOnly).
 *
 * El backend rota el refresh token con reclamación atómica: dos POST
 * concurrentes con la misma cookie compiten y el perdedor recibe 401
 * ("already claimed"), lo que mata la sesión aunque la ganadora la dejó
 * válida. Histórico en producción (TestFlight): sesiones cerradas justo
 * después del login por refreshes simultáneos de caminos independientes.
 * Por eso TODO caller (apiClient.doRefresh, scores-service.attemptRefresh,
 * restoreSession) DEBE pasar por esta promesa única: mientras hay un refresh
 * en vuelo, los demás se coalescen a la misma respuesta.
 */
let sharedRefreshPromise: Promise<SharedRefreshResult> | null = null;

export function sharedRefresh(): Promise<SharedRefreshResult> {
  if (!sharedRefreshPromise) {
    sharedRefreshPromise = (typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(`copp-refresh-${getApplicationCode()}`, performSharedRefresh)
      : performSharedRefresh()).finally(() => {
      sharedRefreshPromise = null;
    });
  }
  return sharedRefreshPromise;
}

async function performSharedRefresh(): Promise<SharedRefreshResult> {
  try {
    // Timeout defensivo (10 s), igual que postJson: en WebView nativo una
    // IP inalcanzable puede dejar el fetch colgado para siempre.
    // `application` selecciona la cookie propia de la app (copp_refresh_token_app)
    // y evita restaurar la sesión de otra aplicación que comparta el host
    // (p. ej. el ERP en localhost durante el desarrollo).
    const res = await fetch(`${getAuthBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ application: getApplicationCode() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { status: res.status, result: null };
    const result = (await res.json()) as LoginResult;
    // Rotación: persistir el access token nuevo para los callers que solo
    // esperaban `true` (antes solo restoreSession lo persistía).
    persistAccessToken(result.accessToken);
    return { status: res.status, result };
  } catch {
    return { status: 0, result: null };
  }
}

/** Recuperación real para una cuenta existente; el código nunca inicia sesión ni crea usuarios. */
export function sendRecoveryCode(documentNumber: string, contactId: string): Promise<SendOtpResult> {
  return postJson(`${getAuthBaseUrl()}/api/auth/recovery-code`, { documentNumber, contactId, application: getApplicationCode() });
}
export async function recoverPassword(documentNumber: string, contactId: string, otp: string, newPassword: string): Promise<void> {
  await postJson(`${getAuthBaseUrl()}/api/auth/recover-password`, { documentNumber, contactId, otp, newPassword, application: getApplicationCode() });
  clearAccessToken();
}

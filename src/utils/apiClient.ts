import { sessionUserId } from "./sessionIdentity";
import { patientReadTimeout, requestLanguage } from "./requestLanguage";
/**
 * Authenticated fetch wrapper for backend API calls.
 *
 * Features:
 * - Bearer token from sessionStorage via getAccessToken()
 * - credentials: 'include' for HttpOnly refresh cookie
 * - Timeout acotado: 15 s normal, 45 s en lecturas traducidas al inglés
 * - Single-flight refresh on 401 (POST /api/auth/refresh)
 * - RFC 7807 / ProblemDetails → ApiError mapping
 * - 204 No Content acceptance
 * - No logging of tokens, cookies, or PHI
 */

import {
  getAccessToken,
  clearSessionAndNotify,
  sharedRefresh,
} from "./authApi";
import { getApiBaseUrl, getAuthBaseUrl } from "./apiBaseUrl";

// --- Base URL resolution (DESIGN §Capacitor native) ---
// Todo el tráfico pasa por el gateway (YARP): los helpers resuelven
// env → Capacitor (10.0.2.2:5080) → ruta relativa (proxy de Vite).

const API_BASE = getApiBaseUrl();
const AUTH_BASE = getAuthBaseUrl();

// --- ApiError (RFC 7807 compatible) ---

export class ApiError extends Error {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
  readonly code?: string;
  readonly correlationId?: string;
  readonly errors?: Record<string, string[]>;
  readonly errorType: "TIMEOUT" | "network" | "server" | "business";

  constructor(opts: {
    message: string;
    status?: number;
    title?: string;
    detail?: string;
    code?: string;
    correlationId?: string;
    errors?: Record<string, string[]>;
    errorType?: ApiError["errorType"];
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status ?? 0;
    this.title = opts.title;
    this.detail = opts.detail;
    this.code = opts.code;
    this.correlationId = opts.correlationId;
    this.errors = opts.errors;
    this.errorType = opts.errorType ?? "server";
  }
}

// --- Single-flight refresh (DESIGN §apiClient) ---

/**
 * Refresh con single-flight COMPARTIDO (authApi.sharedRefresh): además de
 * coalescer los 401 concurrentes de apiFetch, se coalesce con restoreSession
 * (boot/AppContext/GraphQL) y scores-service.attemptRefresh. Tres promesas
 * independientes contra /api/auth/refresh con la misma cookie hacen que el
 * backend rote el token y el perdedor reciba 401 "already claimed" matando
 * la sesión (bug de TestFlight 2026-09-30). NUNCA llamar a /api/auth/refresh
 * por fuera de authApi.sharedRefresh.
 */
function doRefresh(): Promise<boolean> {
  return sharedRefresh().then(({ status, result }) => {
    // 401 (cookie ausente o inválida) = la sesión ya no es recuperable:
    // se limpia el token y se notifica (el listener de AppContext
    // devuelve al login). No se espera al próximo 401.
    if (status === 401) {
      clearSessionAndNotify();
      return false;
    }
    return result !== null;
  });
}

/**
 * Refresh single-flight para chequeos proactivos de expiración (watcher de
 * AppContext). Comparte la misma promesa que el refresh disparado por un 401.
 */
export function refreshAccessToken(): Promise<boolean> {
  return doRefresh();
}

// --- Parser helpers ---

function isProblemDetails(body: unknown): body is {
  status?: number;
  title?: string;
  detail?: string;
  code?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
} {
  return typeof body === "object" && body !== null && "detail" in body;
}

function extractCodeFromDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  // Pattern: "NO_ACTIVE_ENROLLMENT: ..." or "CODE:" prefix
  const match = detail.match(/^([A-Z_]+):/);
  return match?.[1];
}

function parseApiError(
  status: number,
  body: unknown,
  errorType: ApiError["errorType"] = "server",
): ApiError {
  // RFC 7807 / ProblemDetails
  if (isProblemDetails(body)) {
    return new ApiError({
      message: body.detail ?? body.title ?? `HTTP ${status}`,
      status,
      title: body.title,
      detail: body.detail,
      code: body.code ?? extractCodeFromDetail(body.detail),
      correlationId: body.correlationId,
      errors: body.errors,
      errorType,
    });
  }

  // Fallback: { message } or raw body
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as { message: unknown }).message)
      : `HTTP ${status}`;

  const code = typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
    ? body.code : extractCodeFromDetail(message);
  return new ApiError({ message, status, errorType, code });
}

// --- Main fetch wrapper ---

export interface ApiFetchOptions extends Omit<RequestInit, "method" | "body"> {
  method?: string;
  body?: unknown;
  /** Override timeout (15 s normal; 45 s para lecturas de contenido traducido en inglés). */
  timeoutMs?: number;
  /** Bind a deliberate action to its original account, including a 401 retry. */
  expectedUserId?: string | null;
}

/**
 * Resolve a relative API path to a full URL (siempre vía gateway).
 * In dev, Vite proxy handles relative paths (API_BASE is empty).
 * In Capacitor native, the gateway base (10.0.2.2:5080 o VITE_GATEWAY_BASE_URL) applies.
 */
function resolveUrl(path: string): string {
  if (path.startsWith("/api/auth")) {
    return AUTH_BASE ? `${AUTH_BASE}${path}` : path;
  }
  return API_BASE ? `${API_BASE}${path}` : path;
}

/**
 * Authenticated fetch to the backend API.
 *
 * @param path - API path (e.g., '/api/v1/program/me/snapshot')
 * @param options - Fetch options with body auto-serialized to JSON
 * @returns Parsed JSON response (or null for 204)
 * @throws ApiError on any failure
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { timeoutMs: configuredTimeout, body, headers: customHeaders, expectedUserId, ...rest } = options;
  const assertAccount = () => {
    if (expectedUserId !== undefined && sessionUserId(getAccessToken()) !== expectedUserId)
      throw new ApiError({ message: "Session changed", code: "SESSION_CHANGED", status: 401, errorType: "business" });
    if (rest.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
  };
  const method = rest.method ?? (body !== undefined ? "POST" : "GET");
  const url = resolveUrl(path);

  const headers = new Headers(customHeaders);
  if (!headers.has("Accept-Language")) headers.set("Accept-Language", requestLanguage());
  // Distingue una elección de la app del idioma automático del navegador/SO.
  if (!headers.has("X-App-Language")) headers.set("X-App-Language", headers.get("Accept-Language")!);
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const timeoutMs = configuredTimeout ?? patientReadTimeout(path, method, headers.get("X-App-Language") ?? "es");
  const controller = new AbortController();
  let retryTimeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // La señal externa (p. ej. desmontaje del wizard) también debe cancelar:
  // se combina con el timeout en vez de ignorarla (QA-009).
  const signal = rest.signal
    ? AbortSignal.any([controller.signal, rest.signal])
    : controller.signal;

  try {
    assertAccount();
    const res = await fetch(url, {
      ...rest,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal,
    });

    clearTimeout(timeoutId);
    assertAccount();

    // 204 No Content
    if (res.status === 204) {
      return undefined as T;
    }

    // Parse response body
    let parsed: unknown = null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      parsed = await res.json();
    } else {
      const text = await res.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { message: text };
      }
    }

    assertAccount();
    // 401 → attempt single-flight refresh + retry once
    if (res.status === 401) {
      // El refresh usa cookie HttpOnly: sin Bearer, no tiene sentido reintentar.
      if (path.includes("/api/auth/refresh")) {
        throw parseApiError(401, parsed);
      }

      const refreshed = await doRefresh();
      assertAccount();
      if (!refreshed) {
        // Refresh failed — session bridge will handle redirect
        throw parseApiError(401, parsed);
      }

      // Retry original request ONCE with new token
      const retryToken = getAccessToken();
      const retryHeaders = new Headers(customHeaders);
      if (!retryHeaders.has("Accept-Language")) retryHeaders.set("Accept-Language", requestLanguage());
      if (!retryHeaders.has("X-App-Language")) retryHeaders.set("X-App-Language", retryHeaders.get("Accept-Language")!);
      if (retryToken) {
        retryHeaders.set("Authorization", `Bearer ${retryToken}`);
      }
      if (body !== undefined) {
        retryHeaders.set("Content-Type", "application/json");
      }

      const retryController = new AbortController();
      const retryTimeoutMs = configuredTimeout ?? patientReadTimeout(path, method, retryHeaders.get("X-App-Language") ?? "es");
      retryTimeout = setTimeout(() => retryController.abort(), retryTimeoutMs);
      const retrySignal = rest.signal
        ? AbortSignal.any([retryController.signal, rest.signal])
        : retryController.signal;

      const retryRes = await fetch(url, {
        ...rest,
        method,
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "include",
        signal: retrySignal,
      });

      clearTimeout(retryTimeout);
      assertAccount();

      if (retryRes.status === 204) return undefined as T;
      if (!retryRes.ok) {
        let retryParsed: unknown = null;
        const retryContentType = retryRes.headers.get("content-type") ?? "";
        if (retryContentType.includes("application/json")) {
          retryParsed = await retryRes.json();
        }
        throw parseApiError(retryRes.status, retryParsed);
      }

      const retryResult = (await retryRes.json()) as T;
      assertAccount();
      return retryResult;
    }

    // Non-2xx error
    if (!res.ok) {
      throw parseApiError(res.status, parsed);
    }

    return parsed as T;
  } catch (err) {
    clearTimeout(timeoutId);
    clearTimeout(retryTimeout);

    // Already an ApiError from our logic
    if (err instanceof ApiError) throw err;

    // AbortError = timeout
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError({
        message: "Request timed out",
        errorType: "TIMEOUT",
        status: 0,
      });
    }

    // Network failure
    throw new ApiError({
      message: err instanceof Error ? err.message : "Network error",
      errorType: "network",
      status: 0,
    });
  }
}

// --- Convenience methods ---

export function apiGet<T>(
  path: string,
  opts?: Omit<ApiFetchOptions, "method">,
): Promise<T> {
  return apiFetch<T>(path, { ...opts, method: "GET" });
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  opts?: Omit<ApiFetchOptions, "method" | "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...opts, method: "POST", body });
}

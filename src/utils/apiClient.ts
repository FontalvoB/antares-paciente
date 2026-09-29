/**
 * Authenticated fetch wrapper for backend API calls.
 *
 * Features:
 * - Bearer token from sessionStorage via getAccessToken()
 * - credentials: 'include' for HttpOnly refresh cookie
 * - 15s timeout via AbortController
 * - Single-flight refresh on 401 (POST /api/auth/refresh)
 * - RFC 7807 / ProblemDetails → ApiError mapping
 * - 204 No Content acceptance
 * - No logging of tokens, cookies, or PHI
 */

import {
  getAccessToken,
  persistAccessToken,
  clearSessionAndNotify,
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

let refreshPromise: Promise<boolean> | null = null;

/**
 * Perform a single refresh attempt.
 * Returns true if refresh succeeded, false otherwise.
 * All concurrent 401 callers share the same promise.
 */
function doRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(resolveUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
      // No Bearer token — refresh uses HttpOnly cookie only.
      // Timeout propio: si el refresh se cuelga, el 401 que lo disparó espera
      // para siempre y bloquea apiFetch (y con él, syncs y POSTs de métricas).
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (res) => {
        // 401 (cookie ausente o inválida) = la sesión ya no es recuperable:
        // se limpia el token y se notifica (el listener de AppContext
        // devuelve al login). No se espera al próximo 401.
        if (res.status === 401) {
          clearSessionAndNotify();
          return false;
        }
        if (!res.ok) return false;
        // Rotación: el access token nuevo viene en el body. Sin persistirlo,
        // el retry de apiFetch seguiría mandando el token vencido.
        const body = (await res.json().catch(() => null)) as {
          accessToken?: string;
        } | null;
        if (!body?.accessToken) return false;
        persistAccessToken(body.accessToken);
        return true;
      })
      // Fallo de red: la sesión se conserva (modo offline); el watcher de
      // expiración reintentará cuando haya conectividad.
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
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

  return new ApiError({ message, status, errorType });
}

// --- Main fetch wrapper ---

export interface ApiFetchOptions extends Omit<RequestInit, "method" | "body"> {
  method?: string;
  body?: unknown;
  /** Override timeout (default 15s) */
  timeoutMs?: number;
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
  const { timeoutMs = 15_000, body, headers: customHeaders, ...rest } = options;
  const url = resolveUrl(path);

  const headers = new Headers(customHeaders);
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // La señal externa (p. ej. desmontaje del wizard) también debe cancelar:
  // se combina con el timeout en vez de ignorarla (QA-009).
  const signal = rest.signal
    ? AbortSignal.any([controller.signal, rest.signal])
    : controller.signal;

  try {
    const res = await fetch(url, {
      ...rest,
      method: rest.method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal,
    });

    clearTimeout(timeoutId);

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

    // 401 → attempt single-flight refresh + retry once
    if (res.status === 401) {
      // El refresh usa cookie HttpOnly: sin Bearer, no tiene sentido reintentar.
      if (path.includes("/api/auth/refresh")) {
        throw parseApiError(401, parsed);
      }

      const refreshed = await doRefresh();
      if (!refreshed) {
        // Refresh failed — session bridge will handle redirect
        throw parseApiError(401, parsed);
      }

      // Retry original request ONCE with new token
      const retryToken = getAccessToken();
      const retryHeaders = new Headers(customHeaders);
      if (retryToken) {
        retryHeaders.set("Authorization", `Bearer ${retryToken}`);
      }
      if (body !== undefined) {
        retryHeaders.set("Content-Type", "application/json");
      }

      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), timeoutMs);
      const retrySignal = rest.signal
        ? AbortSignal.any([retryController.signal, rest.signal])
        : retryController.signal;

      const retryRes = await fetch(url, {
        ...rest,
        method: rest.method ?? (body !== undefined ? "POST" : "GET"),
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "include",
        signal: retrySignal,
      });

      clearTimeout(retryTimeout);

      if (retryRes.status === 204) return undefined as T;
      if (!retryRes.ok) {
        let retryParsed: unknown = null;
        const retryContentType = retryRes.headers.get("content-type") ?? "";
        if (retryContentType.includes("application/json")) {
          retryParsed = await retryRes.json();
        }
        throw parseApiError(retryRes.status, retryParsed);
      }

      return (await retryRes.json()) as T;
    }

    // Non-2xx error
    if (!res.ok) {
      throw parseApiError(res.status, parsed);
    }

    return parsed as T;
  } catch (err) {
    clearTimeout(timeoutId);

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

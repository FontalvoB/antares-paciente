/**
 * Scores service — GET /api/v1/program/scores
 *
 * Returns the EvolutionView payload plus the two freshness signals the backend
 * communicates via response headers (SPEC R2.5, task 2.3).
 *
 * IMPLEMENTATION NOTE (deviation, recorded in apply report):
 * `apiFetch<T>` in `../utils/apiClient` returns only the parsed JSON body and
 * does NOT expose `Response.headers`. Capturing `X-Score-Stale` /
 * `X-Score-Recalculated` is impossible through `apiFetch`. Per the task
 * constraint "do NOT modify apiClient.ts (adapt within the service or via
 * exported helpers only)", the adaptation lives HERE: a service-local
 * authenticated GET that reuses the SAME building blocks as apiClient
 * (`ApiError` for error semantics, `getAccessToken` / `clearSessionAndNotify`
 * from `../utils/authApi` for the Bearer token and the 401 single-flight
 * refresh). Behavior mirrors apiClient.ts (15s timeout, RFC 7807 → ApiError,
 * one refresh + one retry, no swallowed errors).
 *
 * Gate G3: NO `calculatedAt` field is invented. Freshness is conveyed only by
 * the `stale`/`recalculated` booleans derived from the existing headers.
 */

import type { ScoresResponseDto } from "./types";
import {
  getAccessToken,
  clearSessionAndNotify,
  sharedRefresh,
} from "../../utils/authApi";
import { ApiError } from "../../utils/apiClient";
import { getApiBaseUrl, getAuthBaseUrl } from "../../utils/apiBaseUrl";

const SCORES_PATH = "/api/v1/program/scores";
const AUTH_REFRESH_PATH = "/api/auth/refresh";
const TIMEOUT_MS = 15_000;

const API_BASE = getApiBaseUrl();
const AUTH_BASE = getAuthBaseUrl();

export interface ScoresResult {
  data: ScoresResponseDto;
  stale: boolean;
  recalculated: boolean;
}

function resolveUrl(path: string): string {
  if (path.startsWith("/api/auth")) {
    return AUTH_BASE ? `${AUTH_BASE}${path}` : path;
  }
  return API_BASE ? `${API_BASE}${path}` : path;
}

function parseBoolHeader(value: string | null): boolean {
  return value?.trim().toLowerCase() === "true";
}

/** Refresh delegado al single-flight COMPARTIDO (authApi.sharedRefresh):
 *  un refresh local e independiente competía con doRefresh/restoreSession por
 *  la misma cookie → rotación concurrente → 401 "already claimed" → sesión
 *  eliminada (bug TestFlight 2026-09-30). Ventaja adicional: la versión
 *  compartida SÍ persiste el access token nuevo (esta antes no lo hacía). */
async function attemptRefresh(): Promise<boolean> {
  const { status, result } = await sharedRefresh();
  if (status === 401) {
    clearSessionAndNotify();
    return false;
  }
  return result !== null;
}

function toApiError(status: number, parsed: unknown): ApiError {
  if (typeof parsed === "object" && parsed !== null && "detail" in parsed) {
    const body = parsed as Record<string, unknown>;
    const detail = typeof body.detail === "string" ? body.detail : undefined;
    const codeFromDetail =
      typeof detail === "string" ? detail.match(/^([A-Z_]+):/)?.[1] : undefined;
    return new ApiError({
      message:
        detail ??
        (typeof body.title === "string" ? body.title : `HTTP ${status}`),
      status,
      title: typeof body.title === "string" ? body.title : undefined,
      detail,
      code:
        typeof body.code === "string"
          ? body.code
          : (codeFromDetail ?? undefined),
      correlationId:
        typeof body.correlationId === "string" ? body.correlationId : undefined,
      errors:
        typeof body.errors === "object"
          ? (body.errors as Record<string, string[]>)
          : undefined,
    });
  }
  const message =
    typeof parsed === "object" && parsed !== null && "message" in parsed
      ? String((parsed as { message: unknown }).message)
      : `HTTP ${status}`;
  return new ApiError({ message, status });
}

async function doGet(
  url: string,
  signal: AbortSignal,
): Promise<{ data: ScoresResponseDto; stale: boolean; recalculated: boolean }> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    signal,
  });

  // 401 → attempt single-flight refresh, then retry ONCE.
  if (res.status === 401) {
    if (url.includes(AUTH_REFRESH_PATH)) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* keep null */
      }
      throw toApiError(401, parsed);
    }

    const refreshed = await attemptRefresh();
    if (!refreshed) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* keep null */
      }
      throw toApiError(401, parsed);
    }

    const retryHeaders = new Headers();
    const retryToken = getAccessToken();
    if (retryToken) retryHeaders.set("Authorization", `Bearer ${retryToken}`);

    const retryRes = await fetch(url, {
      method: "GET",
      headers: retryHeaders,
      credentials: "include",
      signal,
    });

    if (!retryRes.ok) {
      let parsed: unknown = null;
      try {
        parsed = await retryRes.json();
      } catch {
        /* keep null */
      }
      throw toApiError(retryRes.status, parsed);
    }

    const raw = (await retryRes.json()) as any;
    const data: ScoresResponseDto = {
      health_score: raw.health_score || raw.healthScore,
      transformation_score: raw.transformation_score || raw.transformationScore,
      healthScore: raw.healthScore || raw.health_score,
      transformationScore: raw.transformationScore || raw.transformation_score,
    };
    return {
      data,
      stale: parseBoolHeader(retryRes.headers.get("X-Score-Stale")),
      recalculated: parseBoolHeader(
        retryRes.headers.get("X-Score-Recalculated"),
      ),
    };
  }

  if (!res.ok) {
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* keep null */
    }
    throw toApiError(res.status, parsed);
  }

  const raw = (await res.json()) as any;
  const data: ScoresResponseDto = {
    health_score: raw.health_score || raw.healthScore,
    transformation_score: raw.transformation_score || raw.transformationScore,
    healthScore: raw.healthScore || raw.health_score,
    transformationScore: raw.transformationScore || raw.transformation_score,
  };
  return {
    data,
    stale: parseBoolHeader(res.headers.get("X-Score-Stale")),
    recalculated: parseBoolHeader(res.headers.get("X-Score-Recalculated")),
  };
}

/**
 * Fetch the program scores for the authenticated patient.
 *
 * @returns The scores DTO plus freshness flags from response headers.
 * @throws ApiError — propagated, never swallowed (R1.4, R7.4).
 */
export async function getScores(): Promise<ScoresResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await doGet(resolveUrl(SCORES_PATH), controller.signal);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError({
        message: "Request timed out",
        errorType: "TIMEOUT",
        status: 0,
      });
    }
    throw new ApiError({
      message: err instanceof Error ? err.message : "Network error",
      errorType: "network",
      status: 0,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Política de presencia para enlaces BLE silenciosos. Algunos dispositivos
 * (el anillo) son callados por diseño entre barridos: el silencio solo NO
 * tumba la sesión. En cada tick se decide:
 * - `ok`: hubo tráfico reciente, nada que hacer (y se resetea el contador).
 * - `ping`: quietud más allá del umbral → pedir una lectura liviana
 *   (batería/info); su respuesta refresca la presencia sola.
 * - `dead`: N pings seguidos sin respuesta → el enlace está realmente caído
 *   y toca desmontar + reconectar.
 */
export const HEARTBEAT_MAX_MISSES = 2;

export type HeartbeatDecision =
  | { action: "ok"; misses: number }
  | { action: "ping"; misses: number }
  | { action: "dead"; misses: number };

export function nextHeartbeatDecision(
  idleMs: number,
  staleThresholdMs: number,
  misses: number,
): HeartbeatDecision {
  if (idleMs <= staleThresholdMs) return { action: "ok", misses: 0 };
  const next = misses + 1;
  if (next >= HEARTBEAT_MAX_MISSES) return { action: "dead", misses: 0 };
  return { action: "ping", misses: next };
}

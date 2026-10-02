import type { DeviceInfo, HealthSample } from "../devices/types";

/**
 * Solo las muestras de contacto FRESCAS actualizan el flag: el volcado de
 * historial también emite `wearing` (con su hora real, vieja) y sin esta
 * guarda una noche sin puesto pisaría el estado en vivo al sincronizar.
 */
const WEARING_FRESH_MS = 300_000;

/**
 * Decide el parche de `info` para una muestra de contacto. Devuelve null si no
 * hay nada que actualizar (no es wearing, es vieja o no cambia el flag).
 * Pura para poder probarse sin montar el contexto.
 */
export function wearingInfoUpdate(
  sample: HealthSample,
  current: DeviceInfo,
): Partial<DeviceInfo> | null {
  if (sample.metric !== "wearing") return null;
  if (Date.now() - sample.ts > WEARING_FRESH_MS) return null;
  const wearing = sample.value === 1;
  if (current.wearing === wearing) return null;
  return { wearing };
}

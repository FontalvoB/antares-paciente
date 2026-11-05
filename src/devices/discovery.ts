import type { DeviceDescriptor } from "./types";
import { isSupportedWearable } from "./support";

/** Compatibles primero; la señal o un vínculo anterior no cambian ese grupo. */
export function compareDeviceCompatibility(a: DeviceDescriptor, b: DeviceDescriptor): number {
  return Number(isSupportedWearable(b)) - Number(isSupportedWearable(a));
}

/**
 * Fusiona un dispositivo recién descubierto con la lista actual, sin duplicar
 * por `deviceId`. Un dispositivo emparejado en el sistema que vuelve a
 * aparecer en el escaneo conserva su marca `paired` y gana el RSSI/uuids del
 * anuncio. Los compatibles van primero; dentro de cada grupo se priorizan
 * los emparejados y después la señal. No se oculta ningún resultado.
 */
export function mergeDiscovered(
  current: DeviceDescriptor[],
  incoming: DeviceDescriptor,
): DeviceDescriptor[] {
  const index = current.findIndex((d) => d.deviceId === incoming.deviceId);
  const merged =
    index === -1
      ? incoming
      : {
          ...current[index],
          ...incoming,
          paired: current[index].paired === true || incoming.paired === true,
        };

  const next =
    index === -1
      ? [...current, merged]
      : current.map((d, i) => (i === index ? merged : d));

  return next.sort((a, b) => {
    const compatibility = compareDeviceCompatibility(a, b);
    if (compatibility !== 0) return compatibility;
    if (a.paired !== b.paired) return a.paired ? -1 : 1;
    return (b.rssi ?? -999) - (a.rssi ?? -999);
  });
}

import type { DeviceDescriptor } from "./types";

/**
 * Fusiona un dispositivo recién descubierto con la lista actual, sin duplicar
 * por `deviceId`. Un dispositivo emparejado en el sistema que vuelve a
 * aparecer en el escaneo conserva su marca `paired` y gana el RSSI/uuids del
 * anuncio. Los emparejados van primero (son los que el usuario ya conoce) y
 * el resto se ordena por señal.
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
    if (a.paired !== b.paired) return a.paired ? -1 : 1;
    return (b.rssi ?? -999) - (a.rssi ?? -999);
  });
}

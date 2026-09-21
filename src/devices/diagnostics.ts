import type { BleService } from '@capacitor-community/bluetooth-le';

// Utilidades del modo diagnóstico: volcado GATT y formato del registro BLE.
// El registro se llena desde el "tap" de notificaciones de ble-client, que
// solo está activo mientras el modo diagnóstico está encendido.

export interface DiagEntry {
  ts: number;
  direction: 'rx' | 'tx';
  /** Servicio/característica abreviados. */
  label: string;
  hex: string;
}

/** Tope de líneas en memoria (el registro es para depurar, no para guardar). */
export const DIAG_LOG_LIMIT = 400;

export function shortUuid(uuid: string): string {
  return uuid.slice(0, 8);
}

/** Volcado legible de servicios y características. */
export function describeServices(services: BleService[]): string {
  return services
    .map((service) => {
      const characteristics = service.characteristics
        .map((characteristic) => {
          const properties = [
            characteristic.properties.read ? 'read' : '',
            characteristic.properties.write ? 'write' : '',
            characteristic.properties.writeWithoutResponse ? 'writeNoResp' : '',
            characteristic.properties.notify ? 'notify' : '',
            characteristic.properties.indicate ? 'indicate' : '',
          ]
            .filter(Boolean)
            .join(',');
          return `    ${characteristic.uuid}  [${properties}]`;
        })
        .join('\n');
      return `${service.uuid}\n${characteristics}`;
    })
    .join('\n');
}

export function formatEntry(entry: DiagEntry): string {
  const time = new Date(entry.ts).toLocaleTimeString('es-US', {
    hour12: false,
  });
  const arrow = entry.direction === 'tx' ? '→' : '←';
  return `${time} ${arrow} ${entry.label}  ${entry.hex}`;
}

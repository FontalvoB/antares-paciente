import { registerPlugin } from "@capacitor/core";

export type BluetoothRadioState = "on" | "off" | "unknown" | "resetting" | "unauthorized" | "unsupported";
interface RadioBridge {
  getBluetoothState(): Promise<{ state: BluetoothRadioState }>;
  getConnectionState(options: { deviceId: string }): Promise<{ connected: boolean }>;
}
let bridge: RadioBridge | undefined;

export async function readIosRadioState(): Promise<BluetoothRadioState> {
  bridge ??= registerPlugin<RadioBridge>("BluetoothLe");
  const { state } = await bridge.getBluetoothState();
  return ["on", "off", "resetting", "unauthorized", "unsupported"].includes(state) ? state : "unknown";
}

/** Estado del periférico de NUESTRO manager, no de conexiones de otras apps. */
export async function readIosConnectionState(deviceId: string): Promise<boolean> {
  bridge ??= registerPlugin<RadioBridge>("BluetoothLe");
  const result = await bridge.getConnectionState({ deviceId });
  if (typeof result.connected !== "boolean") throw new Error("Estado de conexión BLE desconocido");
  return result.connected;
}

import { registerPlugin } from "@capacitor/core";

export type BluetoothRadioState = "on" | "off" | "unknown" | "resetting" | "unauthorized" | "unsupported";
interface RadioBridge { getBluetoothState(): Promise<{ state: BluetoothRadioState }> }
let bridge: RadioBridge | undefined;

export async function readIosRadioState(): Promise<BluetoothRadioState> {
  bridge ??= registerPlugin<RadioBridge>("BluetoothLe");
  const { state } = await bridge.getBluetoothState();
  return ["on", "off", "resetting", "unauthorized", "unsupported"].includes(state) ? state : "unknown";
}

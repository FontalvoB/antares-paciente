/**
 * 1.0 se envía a App Review sin conexión a hardware externo.
 *
 * Apple rechazó la build 63 por Guideline 1.4.1 (hardware médico) y pidió un
 * video del pairing/background BLE (2.1). La función se oculta por build flag
 * para 1.0 y se reactiva en 1.1 cuando exista la documentación del fabricante
 * y el video. En desarrollo local queda activa salvo que se apague a mano.
 */
export const WEARABLE_ENABLED =
  import.meta.env.VITE_WEARABLE_ENABLED !== "false";

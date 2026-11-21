/**
 * Posicionamiento 1.0: programa de apoyo para bajar de peso y hábitos saludables.
 *
 * El anillo/banda es un accesorio de bienestar de consumo, no un dispositivo
 * médico. Se mantiene la conexión BLE solo en primer plano: sin
 * `UIBackgroundModes` no se promete captura en segundo plano y se evita el
 * requisito de video del modo background de App Review 2.1.
 *
 * `VITE_WEARABLE_ENABLED=false` sigue disponible para producir un build sin
 * wearable si Apple vuelve a rechazar por 1.4.1.
 */
export const WEARABLE_ENABLED =
  import.meta.env.VITE_WEARABLE_ENABLED !== "false";

/** La app conserva el comportamiento original de conexión BLE, incluido background. */
export const BLE_BACKGROUND_ENABLED = true;

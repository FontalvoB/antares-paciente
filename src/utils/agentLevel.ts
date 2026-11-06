/**
 * Niveles percibidos del agente de voz para el orbe (adaptación v3.1).
 *
 * La amplitud RMS que devuelve el SDK es baja en telefonía WebRTC: la orbe
 * queda tiesa si se pasa cruda. Se compone con la energía espectral media
 * real (getOutputByteFrequencyData, banda 100–8000 Hz) y una curva de
 * ganancia perceptual (1 - e^-kx) para que el orbe acompañe la cadencia de
 * la voz del agente sin importar la escala bruta del proveedor.
 */

/** Curva de ganancia perceptual: 0..1 → 0..1 con realce de valores bajos. */
export const boostLevel = (raw: unknown, k = 4.5): number => {
  const x = Number.isFinite(raw as number) ? Math.max(0, raw as number) : 0;
  return Math.min(1, 1 - Math.exp(-k * x));
};

/** Media normalizada 0..1 de un espectro de bytes (ignora bordes del array). */
export const spectralMean = (bytes?: Uint8Array | null): number => {
  if (!bytes || bytes.length < 5) return 0;
  let sum = 0;
  for (let i = 2; i < bytes.length - 2; i++) sum += bytes[i];
  return sum / ((bytes.length - 4) * 255);
};

/**
 * Nivel de salida del agente para el orbe: máximo entre el volumen RMS del
 * SDK (escalado por ganancia perceptual) y la energía espectral media real.
 * Tolerante a SDK sin conexión: devuelve 0 en fallos, nunca lanza.
 */
export const readAgentOutputLevel = (
  getOutputVolume?: () => number,
  getOutputByteFrequencyData?: () => Uint8Array,
): number => {
  let rms = 0;
  try {
    rms = getOutputVolume?.() ?? 0;
  } catch {
    rms = 0;
  }
  let spec = 0;
  try {
    spec = spectralMean(getOutputByteFrequencyData?.()) * 0.85;
  } catch {
    spec = 0;
  }
  const rmsNorm = Number.isFinite(rms) ? Math.max(0, rms) : 0;
  const specNorm = Number.isFinite(spec) ? Math.max(0, spec) : 0;
  return boostLevel(Math.max(rmsNorm, specNorm));
};

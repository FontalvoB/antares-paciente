// Morfología sintética de un latido para la traza tipo ECG.
//
// IMPORTANTE: esto NO es una señal clínica. El anillo y la banda no emiten
// onda ECG por Bluetooth; la traza es una visualización del pulso cuya
// FRECUENCIA sale de la FC real medida, con una forma PQRST generada por
// software (decorativa). Nunca debe etiquetarse como diagnóstico.

/**
 * Valor de la onda en una fase del ciclo cardíaco (`phase` 0..1, 0 = inicio
 * del latido). Devuelve un valor normalizado donde el pico R vale ~1.
 */
export function ecgSample(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  return (
    gaussian(p, 0.12, 0.028, 0.12) + // onda P (auricular)
    gaussian(p, 0.19, 0.01, -0.12) + // Q (dip previo al pico)
    gaussian(p, 0.215, 0.01, 1) + // R (pico principal)
    gaussian(p, 0.245, 0.01, -0.28) + // S (dip posterior)
    gaussian(p, 0.36, 0.055, 0.26) // onda T (repolarización)
  );
}

function gaussian(
  phase: number,
  center: number,
  width: number,
  amplitude: number,
): number {
  const distance = (phase - center) / width;
  return amplitude * Math.exp(-0.5 * distance * distance);
}

/**
 * Muestrea un tramo de la onda tomando el valor más extremo de varias
 * sub-muestras: así el pico R no se pierde entre píxeles y la traza queda
 * estable al desplazarse.
 */
export function ecgColumn(
  phase: number,
  phasePerColumn: number,
  subSamples = 4,
): number {
  let extreme = 0;
  for (let index = 0; index < subSamples; index++) {
    const offset = (phasePerColumn * (index + 0.5)) / subSamples;
    const value = ecgSample(phase + offset);
    if (Math.abs(value) > Math.abs(extreme)) extreme = value;
  }
  return extreme;
}

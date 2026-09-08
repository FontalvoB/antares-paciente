/**
 * Formato puro del delta de una métrica de transformación (Evo tab rework).
 *
 * Direccionalidad NORMALIZADA por el backend (`favorable`): el TEXTO siempre
 * es el delta firmado real (nunca se inventa un signo); el `tone` decide el
 * color que la UI aplica:
 *  - favorable === true  → 'favorable'   (verde: la métrica mejoró)
 *  - favorable === false → 'unfavorable' (rojo: la métrica empeoró)
 *  - undefined           → 'neutral'     (delta crudo firmado, SIN color —
 *    payload previo sin el campo aditivo: no se puede inferir mejora).
 *
 * Sin dependencias de UI para poder testearlo sin montar componentes.
 */

export type TransformDeltaTone = 'favorable' | 'unfavorable' | 'neutral'

export interface TransformDeltaView {
  /** Delta firmado real, ej. "+2.1 kg", "-1.4", "0 %". */
  text: string
  tone: TransformDeltaTone
}

export function formatTransformDelta(d: {
  delta: number
  unit: string
  favorable?: boolean | null
}): TransformDeltaView {
  const sign = d.delta > 0 ? '+' : ''
  const text = `${sign}${d.delta} ${d.unit}`.trim()
  const tone: TransformDeltaTone =
    d.favorable === true ? 'favorable' : d.favorable === false ? 'unfavorable' : 'neutral'
  return { text, tone }
}
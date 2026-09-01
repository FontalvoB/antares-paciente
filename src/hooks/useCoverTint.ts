import { useEffect, useState } from 'react'

export interface CoverTint {
  /** RGB del borde inferior promedio (promedio de los últimos píxeles). */
  rgb: [number, number, number]
  /** Pares de la imagen: el ratio (alto del píxel) en el que se muestre. */
  dark: boolean
  /** true cuando el color detectado viene de la imagen real. */
  fromImage: boolean
}

const FALLBACK: [number, number, number] = [26, 10, 60]
const DARK_LUMINANCE = 150

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Lee el color promedio de la franja inferior (15%) de una imagen vía canvas.
 *  La imagen debe ser same-origin o CORS; si el canvas queda "tainted" (o la
 *  imagen no carga), devuelve el fallback morado de la marca. */
function sampleBottomColor(url: string): Promise<{ rgb: [number, number, number]; dark: boolean } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = img.naturalWidth
        const h = img.naturalHeight
        if (!w || !h) return resolve(null)
        const stripH = Math.max(1, Math.round(h * 0.15))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = stripH
        const ctx = canvas.getContext('2d', { willReadFrequently: false })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, h - stripH, w, stripH, 0, 0, w, stripH)
        const data = ctx.getImageData(0, 0, w, stripH).data
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          n++
        }
        if (!n) return resolve(null)
        const rgb: [number, number, number] = [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
        resolve({ rgb, dark: luminance(rgb) < DARK_LUMINANCE })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Tinte de la portada del feed: color del borde inferior (para fundir la
 *  foto con el degradado del hero) + bandera dark para elegir color de texto. */
export function useCoverTint(coverUrl: string | null | undefined): CoverTint {
  const [tint, setTint] = useState<CoverTint>({
    rgb: FALLBACK,
    dark: true,
    fromImage: false,
  })

  useEffect(() => {
    if (!coverUrl) {
      setTint({ rgb: FALLBACK, dark: true, fromImage: false })
      return
    }
    let alive = true
    void sampleBottomColor(coverUrl).then((res) => {
      if (!alive) return
      setTint(
        res
          ? { rgb: res.rgb, dark: res.dark, fromImage: true }
          : { rgb: FALLBACK, dark: true, fromImage: false },
      )
    })
    return () => {
      alive = false
    }
  }, [coverUrl])

  return tint
}

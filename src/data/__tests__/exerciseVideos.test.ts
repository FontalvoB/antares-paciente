import { describe, expect, it } from 'vitest'
import { exerciseVideo } from '../exerciseVideos'

describe('catálogo de demostraciones', () => {
  it('resuelve nombres con acentos, mayúsculas y espacios', () => {
    expect(exerciseVideo('  PLANCHA ISOMÉTRICA  ')?.author).toBe('Smart Fit Chile')
    expect(exerciseVideo('Marcha en el lugar')?.embedUrl).toContain('418873416')
  })
  it('no sustituye una variante ni un ejercicio desconocido por otro video', () => {
    expect(exerciseVideo('Plancha lateral')).toBeNull()
    expect(exerciseVideo('Estocadas caminando')).toBeNull()
    expect(exerciseVideo('Ejercicio nuevo del equipo')).toBeNull()
  })
})

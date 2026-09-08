import type { ProgramTaskId } from '../types'
import podcast from '../assets/missions/podcast.jpg'
import vitals from '../assets/missions/vitals.jpg'
import nut from '../assets/missions/nut.jpg'
import ejercicio from '../assets/missions/ejercicio.jpg'
// La KEY es el código de tarea de la API (nutraceutico); el asset en disco se
// conserva con su nombre original (nutribiotico.jpg) — no renombrar archivo.
import nutraceutico from '../assets/missions/nutribiotico.jpg'
import emocional from '../assets/missions/emocional.jpg'

/**
 * Fotografía de portada de cada misión del protocolo diario.
 * Origen: Openverse, licencias CC0 / dominio público (sin atribución exigida).
 */
export const MISSION_PHOTOS: Record<ProgramTaskId, string> = {
  podcast,
  vitals,
  nut,
  ejercicio,
  nutraceutico,
  emocional,
}

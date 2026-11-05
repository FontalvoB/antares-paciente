/** Catálogo editorial: coincidencias explícitas, sin sustituir variantes clínicas.
 * Fuentes comprobadas 04/11/2026. El proveedor conserva reproducción y derechos.
 * Ampliar con videos de la variante exacta; nunca buscar automáticamente por músculo.
 */
export interface ExerciseVideo {
  embedUrl: string
  sourceUrl: string
  author: string
}
const marching: ExerciseVideo = {
  embedUrl: 'https://player.vimeo.com/video/418873416?dnt=1',
  sourceUrl: 'https://www.lancsteachinghospitals.nhs.uk/trauma-exercises',
  author: 'Lancashire Teaching Hospitals · NHS',
}
const sitToStand: ExerciseVideo = {
  embedUrl: 'https://www.youtube-nocookie.com/embed/0FkRr45YeEQ',
  sourceUrl: 'https://www.youtube.com/watch?v=0FkRr45YeEQ',
  author: 'NHS Ayrshire & Arran',
}
const plank: ExerciseVideo = {
  embedUrl: 'https://www.youtube-nocookie.com/embed/cCMob-mi19U',
  sourceUrl: 'https://www.youtube.com/watch?v=cCMob-mi19U',
  author: 'Smart Fit Chile',
}
const lunge: ExerciseVideo = {
  embedUrl: 'https://www.youtube-nocookie.com/embed/3U9IbwjkOfk',
  sourceUrl: 'https://www.youtube.com/watch?v=3U9IbwjkOfk',
  author: 'Smart Fit Chile',
}
const catalog: Record<string, ExerciseVideo> = {
  'marcha en el lugar': marching,
  'marcha en el sitio': marching,
  'sentarse y levantarse': sitToStand,
  'sentarse y levantarse de la silla': sitToStand,
  'plancha': plank,
  'plancha abdominal': plank,
  'plancha isometrica': plank,
  'estocada': lunge,
  'estocadas': lunge,
}
export function exerciseVideo(name: string): ExerciseVideo | null {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return catalog[key] ?? null
}

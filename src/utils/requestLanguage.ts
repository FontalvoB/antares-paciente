export type RequestLanguage = 'es' | 'en'

let unavailableStorageLanguage: RequestLanguage = 'es'

/** Idioma de presentación vigente al iniciar cada petición, también después de cambiarlo. */
export function requestLanguage(): RequestLanguage {
  try {
    const selected = localStorage.getItem('antares_lang') === 'en' ? 'en' : 'es'
    unavailableStorageLanguage = selected
    return selected
  } catch { return unavailableStorageLanguage }
}

/** Mantiene el idioma de sesión aunque el WebView bloquee el almacenamiento. */
export function persistRequestLanguage(language: RequestLanguage): void {
  unavailableStorageLanguage = language
  try { localStorage.setItem('antares_lang', language) } catch { /* preferencia de esta sesión */ }
}

/** Misma preferencia ES/EN que la proyección del servidor, incluidos q=0 y comodines. */
function contentLanguage(preference: string): RequestLanguage {
  const candidates = preference.split(',').flatMap(value => {
    const parsed = value.trim().match(/^([!#$%&'*+.^_`|~\w-]+)(?:\s*;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i)
    return parsed ? [{ language: parsed[1].split('-')[0].toLowerCase(), quality: parsed[2] === undefined ? 1 : Number(parsed[2]) }] : []
  }).sort((a, b) => b.quality - a.quality)
  for (const candidate of candidates) {
    if (candidate.quality <= 0) continue
    if (candidate.language === 'en' || candidate.language === 'es') return candidate.language
    if (candidate.language === '*') {
      // Un rango específico, incluso q=0, prevalece sobre el comodín.
      for (const fallback of ['es', 'en'] as const)
        if (!candidates.some(value => value.language === fallback)) return fallback
    }
  }
  return 'es'
}

/** Solo estas lecturas proyectan contenido traducido en el servidor (30 s de traducción). */
export function patientReadTimeout(path: string, method: string, language: string): number {
  const explicitLanguage = new URLSearchParams(path.split('?')[1] ?? '').getAll('language').join(',').trim()
  const effectiveLanguage = explicitLanguage ? (explicitLanguage.toLowerCase() === 'en' ? 'en' : 'es') : contentLanguage(language)
  if (method.toUpperCase() !== 'GET' || effectiveLanguage !== 'en') return 15_000
  const route = path.split('?')[0]
  const translated = route === '/api/v1/program/me/snapshot'
    || /^\/api\/v1\/program\/(?:me\/)?notifications$/.test(route)
    || route === '/api/v1/me/nutrition-plan'
    || route === '/api/v1/me/measurements'
    || route === '/api/v1/specialties'
    || route === '/api/v1/professionals-catalog'
    || /^\/api\/v1\/foodai\/analyses\/[^/]+$/.test(route)
    || /^\/api\/v1\/health-tests\/me\/(?:assignments|batteries|results|history|tests\/[^/]+)$/.test(route)
  return translated ? 45_000 : 15_000
}

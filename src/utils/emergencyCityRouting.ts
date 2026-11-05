import directoryUrl from '../data/emergency-city-directory.json?url'
import { borderDistanceMeters, countryFromCoordinates, emergencyNumberForCountry, insideRing } from './emergencyNumbers'
import type { EmergencyCountry } from './emergencyNumbers'
import type { SosCoordinates } from '../services/sos/sos-service'

export type EmergencyService = 'ambulance' | 'police' | 'fire'
type Point = [number, number]
type Polygon = Point[][]
interface Contact {
  service: EmergencyService
  phone: string
  verifiedAt: number
  expiresAt: number
}
interface City {
  id: string
  country: EmergencyCountry
  name: string
  polygons: Polygon[]
  reviewedAt: number
  expiresAt: number
  contacts: Contact[]
}
export interface EmergencyCityDirectory { cities: City[] }
export interface EmergencyDestination {
  phone: string | null
  displayNumber: string
  source: 'local' | 'national' | 'unconfirmed'
  validUntil?: number
}

const SERVICES: EmergencyService[] = ['ambulance', 'police', 'fire']
const MAX_REVIEW_PERIOD_MS = 90 * 86400000
const MAX_POSITION_AGE_MS = 60000
const CITY_BORDER_BUFFER_METERS = 250

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function timestamp(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN
  const time = Date.parse(value)
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z')
  return Number.isFinite(time) && new Date(time).toISOString() === canonical ? time : NaN
}
function https(value: unknown): boolean {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:' } catch { return false }
}
function validReview(start: number, end: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= MAX_REVIEW_PERIOD_MS
}
function validRing(value: unknown): value is Point[] {
  if (!Array.isArray(value) || value.length < 4 || !value.every(p => Array.isArray(p) && p.length === 2 &&
    Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) return false
  const first = value[0], last = value[value.length - 1]
  return first[0] === last[0] && first[1] === last[1] && Math.max(...value.map(p => p[0])) - Math.min(...value.map(p => p[0])) < 180
}
function polygons(value: unknown): Polygon[] | null {
  if (!object(value)) return null
  const list = value.type === 'Polygon' ? [value.coordinates] : value.type === 'MultiPolygon' ? value.coordinates : null
  if (!Array.isArray(list) || !list.length || !list.every(p => Array.isArray(p) && p.length > 0 && p.every(validRing))) return null
  return list as Polygon[]
}
function validPhone(phone: unknown, country: EmergencyCountry, service: EmergencyService): phone is string {
  if (typeof phone !== 'string' || phone === emergencyNumberForCountry(country)) return false
  if (country === 'US') return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone)
  return /^\+57\d{10}$/.test(phone) || phone === ({ ambulance: '125', police: '112', fire: '119' })[service]
}

/** Solo contactos explícitamente revisados para recibir emergencias; nunca teléfonos administrativos. */
function parseDirectory(value: unknown): EmergencyCityDirectory | null {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.cities)) return null
  const cities: City[] = []
  for (const city of value.cities) {
    if (!object(city) || !text(city.id) || !text(city.name) || !['CO', 'US'].includes(String(city.country)) || !object(city.boundary)) continue
    const country = city.country as EmergencyCountry, boundary = city.boundary
    const geometry = polygons(boundary.geometry), reviewedAt = timestamp(boundary.reviewedAt), expiresAt = timestamp(boundary.expiresAt)
    if (!geometry || !https(boundary.sourceUrl) || !validReview(reviewedAt, expiresAt)) continue
    const contacts: Contact[] = []
    for (const contact of Array.isArray(city.contacts) ? city.contacts : []) {
      if (!object(contact) || !SERVICES.includes(contact.service as EmergencyService) || contact.status !== 'verified' ||
        contact.purpose !== 'emergency-dispatch' || contact.verificationMethod !== 'official-publication' || !text(contact.agency) || !https(contact.sourceUrl)) continue
      const service = contact.service as EmergencyService, verifiedAt = timestamp(contact.verifiedAt), contactExpiry = timestamp(contact.expiresAt)
      if (validPhone(contact.phone, country, service) && validReview(verifiedAt, contactExpiry)) contacts.push({ service, phone: contact.phone, verifiedAt, expiresAt: contactExpiry })
    }
    cities.push({ id: city.id, country, name: city.name, polygons: geometry, reviewedAt, expiresAt, contacts })
  }
  return { cities }
}

/** Archivo incluido en el build y servido por Capacitor: no geocodificación ni envío de GPS a terceros. */
export async function loadEmergencyCityDirectory(signal: AbortSignal): Promise<EmergencyCityDirectory | null> {
  const controller = new AbortController(), abort = () => controller.abort()
  const timeout = window.setTimeout(abort, 5000)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  try {
    const response = await fetch(directoryUrl, { signal: controller.signal, cache: 'no-store' })
    return response.ok ? parseDirectory(await response.json()) : null
  } catch { return null }
  finally { window.clearTimeout(timeout); signal.removeEventListener('abort', abort) }
}

function contains(city: City, coordinates: SosCoordinates): boolean {
  const { latitude, longitude, accuracyMeters } = coordinates
  const inside = city.polygons.some(p => insideRing(longitude, latitude, p[0]) && !p.slice(1).some(hole => insideRing(longitude, latitude, hole)))
  if (!inside) return false
  const margin = Math.max(CITY_BORDER_BUFFER_METERS, accuracyMeters!)
  return !city.polygons.some(p => p.some(ring => ring.some((point, index) => index > 0 && borderDistanceMeters(coordinates, [ring[index - 1], point]) <= margin)))
}

export function resolveEmergencyCityRouting(country: EmergencyCountry | null, coordinates: SosCoordinates | null,
  directory: EmergencyCityDirectory | null, now = Date.now()): { city: City | null; services: Record<EmergencyService, EmergencyDestination> } {
  const national = country ? emergencyNumberForCountry(country) : null
  const fallback: EmergencyDestination = { phone: national, displayNumber: national ?? '', source: national ? 'national' : 'unconfirmed' }
  const services = Object.fromEntries(SERVICES.map(service => [service, { ...fallback }])) as Record<EmergencyService, EmergencyDestination>
  const capturedAt = timestamp(coordinates?.locationCapturedAt)
  if (!country || !coordinates || !directory || !Number.isFinite(now) || !Number.isFinite(capturedAt) || capturedAt > now || now - capturedAt >= MAX_POSITION_AGE_MS ||
    !Number.isFinite(coordinates.accuracyMeters) || coordinates.accuracyMeters! < 0 || countryFromCoordinates(coordinates) !== country) return { city: null, services }
  const matches = directory.cities.filter(city => city.country === country && city.reviewedAt <= now && now < city.expiresAt && contains(city, coordinates))
  // Dos jurisdicciones que se solapan no permiten elegir de forma segura.
  if (matches.length !== 1) return { city: null, services }
  const city = matches[0]
  for (const service of SERVICES) {
    const candidates = city.contacts.filter(contact => contact.service === service && contact.verifiedAt <= now && now < contact.expiresAt)
    if (candidates.length !== 1) continue
    const contact = candidates[0]
    const localDigits = contact.phone.startsWith('+') ? contact.phone.slice(country === 'US' ? 2 : 3) : contact.phone
    services[service] = { phone: contact.phone, displayNumber: localDigits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3'),
      source: 'local', validUntil: Math.min(contact.expiresAt, city.expiresAt, capturedAt + MAX_POSITION_AGE_MS) }
  }
  return { city, services }
}

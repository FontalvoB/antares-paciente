import { getApiBaseUrl } from './apiBaseUrl'

/**
 * Cliente del módulo Food AI (backend .NET → food-ai-service).
 * Endpoint real: POST /api/v1/foodai/analyze (multipart, AllowAnonymous).
 * El backend es la ÚNICA fuente de verdad nutricional — este cliente solo
 * envía la imagen y tipa la respuesta, nunca calcula nutrición.
 */

export interface NutritionValues {
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
}

export interface PortionInfo {
  portionSize: string
  estimatedGrams: number
  minGrams: number
  maxGrams: number
  confidence: number
  method: string
}

export type NutritionStatus = 'available' | 'unavailable' | 'portion_unavailable'

export interface DetectedFood {
  name: string
  confidence: number
  boundingBox: { x: number; y: number; width: number; height: number }
  segmentation: { mask: string; areaPixels: number } | null
  portion: PortionInfo | null
  nutrition: NutritionValues | null
  nutritionRange: { min: NutritionValues; max: NutritionValues } | null
  nutritionStatus: NutritionStatus
  source: string | null
  sourceVersion: string | null
  sourceId: string | null
}

export interface FoodAnalysisResult {
  analysisId: string
  status: string
  modelVersion: string
  segModelVersion: string
  classifierVersion: string
  inferenceTimeMs: number
  foods: DetectedFood[]
  summary: NutritionValues | null
  summaryRange: { min: NutritionValues; max: NutritionValues } | null
}

export class FoodAiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'FoodAiError'
    this.status = status
  }
}

/** Timeout del análisis: soporta el peor caso (DINO fallback 10-17 s). */
const ANALYSIS_TIMEOUT_MS = 60_000

/** Emoji decorativo por alimento (identidad del diseño, no funcional). */
export const FOOD_EMOJI: Record<string, string> = {
  pizza: '🍕',
  hamburger: '🍔',
  french_fries: '🍟',
  hot_dog: '🌭',
  sandwich: '🥪',
  fried_chicken: '🍗',
  chicken_nuggets: '🍗',
  banana: '🍌',
  apple: '🍎',
  orange: '🍊',
  salmon: '🍣',
  steak: '🥩',
  lasagna: '🍝',
  mac_and_cheese: '🧀',
  nachos: '🧀',
  taco: '🌮',
  quesadilla: '🫓',
  rice: '🍚',
  pasta: '🍝',
  eggs: '🍳',
  bacon: '🥓',
  pancakes: '🥞',
  waffles: '🧇',
  toast: '🍞',
  bagel: '🥯',
  donut: '🍩',
  cake: '🍰',
  cookie: '🍪',
  brownie: '🍫',
  ice_cream: '🍦',
  oatmeal: '🥣',
  salad: '🥗',
}

/** Nombre legible del canonical (el backend devuelve canonical en snake_case). */
export function displayName(name: string): string {
  return name.replace(/_/g, ' ')
}

/**
 * Envía la imagen al backend y devuelve el análisis tipado.
 * Lanza FoodAiError con mensaje orientado al usuario ante cualquier fallo.
 */
export async function analyzeFoodImage(image: Blob, fileName: string): Promise<FoodAnalysisResult> {
  const form = new FormData()
  form.append('image', image, fileName)
  form.append('analysis_id', crypto.randomUUID())

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS)

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/foodai/analyze`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new FoodAiError(await messageForStatus(res.status), res.status)
    }

    const data = (await res.json()) as FoodAnalysisResult
    if (!data || !Array.isArray(data.foods)) {
      throw new FoodAiError('El servicio devolvió una respuesta inesperada.', 502)
    }
    return data
  } catch (err) {
    if (err instanceof FoodAiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FoodAiError('El análisis tardó más de lo esperado. Intenta de nuevo.', null)
    }
    throw new FoodAiError('No se pudo conectar con el servicio de análisis. Verifica tu conexión.', null)
  } finally {
    clearTimeout(timer)
  }
}

async function messageForStatus(status: number): Promise<string> {
  switch (status) {
    case 400:
      return 'La imagen no es válida. Intenta con otra fotografía.'
    case 401:
    case 403:
      return 'No tienes permiso para usar el analizador.'
    case 404:
      return 'El servicio de análisis no está disponible en este momento.'
    case 408:
      return 'El análisis tardó demasiado. Intenta de nuevo.'
    case 413:
      return 'La imagen es demasiado grande. Intenta con una más liviana.'
    case 429:
      return 'Demasiados análisis en poco tiempo. Espera unos segundos y reintenta.'
    case 500:
    case 502:
    case 503:
      return 'El servicio de análisis está ocupado. Intenta de nuevo en unos segundos.'
    default:
      return 'Ocurrió un error al analizar la imagen.'
  }
}
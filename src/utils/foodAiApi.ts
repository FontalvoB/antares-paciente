import { getApiBaseUrl } from "./apiBaseUrl";
import { apiFetch } from "./apiClient";

/**
 * Cliente del módulo Food AI (backend .NET → food-ai-service).
 * Endpoint real: POST /api/v1/foodai/analyze (multipart, AllowAnonymous).
 * El backend es la ÚNICA fuente de verdad nutricional — este cliente solo
 * envía la imagen y tipa la respuesta, nunca calcula nutrición.
 */

export interface NutritionValues {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface PortionInfo {
  portionSize: string;
  estimatedGrams: number;
  minGrams: number;
  maxGrams: number;
  confidence: number;
  method: string;
}

export type NutritionStatus =
  "available" | "unavailable" | "portion_unavailable";

export interface DetectedFood {
  name: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  segmentation: { mask: string; areaPixels: number } | null;
  portion: PortionInfo | null;
  nutrition: NutritionValues | null;
  nutritionRange: { min: NutritionValues; max: NutritionValues } | null;
  nutritionStatus: NutritionStatus;
  source: string | null;
  sourceVersion: string | null;
  sourceId: string | null;
}

export interface FoodAnalysisResult {
  analysisId: string;
  status: string;
  modelVersion: string;
  segModelVersion: string;
  classifierVersion: string;
  inferenceTimeMs: number;
  foods: DetectedFood[];
  summary: NutritionValues | null;
  summaryRange: { min: NutritionValues; max: NutritionValues } | null;
  /** Totales listos para registrar como ingesta. Null sin nutrición disponible. */
  intake: MealIntake | null;
}

/** Contrato de ingesta del backend (POST /api/v1/foodai/analyze → intake). */
export interface MealIntake {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

/** Item de un análisis persistido (GET /api/v1/foodai/analyses/{id}). */
export interface FoodAnalysisItem {
  name: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  portion: PortionInfo | null;
  nutrition: NutritionValues | null;
  nutritionStatus: NutritionStatus;
  source: string | null;
}

/** Detalle de un análisis persistido (para Ver/Editar comidas registradas). */
export interface FoodAnalysisDetail {
  analysisId: string;
  status: string;
  imageKey: string | null;
  foods: FoodAnalysisItem[];
  summary: NutritionValues | null;
}

/**
 * Recupera un análisis persistido ([Authorize] + ownership server-side).
 * Sirve la foto original (imageKey) y los alimentos con porción/nutrición.
 */
export async function getFoodAnalysis(
  analysisId: string,
): Promise<FoodAnalysisDetail> {
  return apiFetch<FoodAnalysisDetail>(`/api/v1/foodai/analyses/${analysisId}`);
}

/**
 * URL firmada temporal para mostrar la foto original en <img>.
 * El storage acepta Bearer o firma; en <img> no hay Bearer → se firma.
 */
export async function getSignedImageUrl(imageKey: string): Promise<string> {
  const res = await apiFetch<{ url: string }>(
    `/api/v1/storage/sign?key=${encodeURIComponent(imageKey)}`,
  );
  const base = getApiBaseUrl();
  // El backend firma con su propio host (localhost en dev): en web dev el
  // proxy de Vite la resuelve; en nativo se usa la URL absoluta tal cual.
  if (!base) {
    try {
      const u = new URL(res.url);
      return `${u.pathname}${u.search}`;
    } catch {
      return res.url;
    }
  }
  try {
    const u = new URL(res.url);
    return `${base}${u.pathname}${u.search}`;
  } catch {
    return res.url;
  }
}

export class FoodAiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "FoodAiError";
    this.status = status;
  }
}

/** Timeout del análisis: soporta el peor caso (DINO fallback 10-17 s). */
const ANALYSIS_TIMEOUT_MS = 60_000;

/** Emoji decorativo por alimento (identidad del diseño, no funcional). */
export const FOOD_EMOJI: Record<string, string> = {
  pizza: "🍕",
  hamburger: "🍔",
  french_fries: "🍟",
  hot_dog: "🌭",
  sandwich: "🥪",
  fried_chicken: "🍗",
  chicken_nuggets: "🍗",
  banana: "🍌",
  apple: "🍎",
  orange: "🍊",
  salmon: "🍣",
  steak: "🥩",
  lasagna: "🍝",
  mac_and_cheese: "🧀",
  nachos: "🧀",
  taco: "🌮",
  quesadilla: "🫓",
  rice: "🍚",
  pasta: "🍝",
  eggs: "🍳",
  bacon: "🥓",
  pancakes: "🥞",
  waffles: "🧇",
  toast: "🍞",
  bagel: "🥯",
  donut: "🍩",
  cake: "🍰",
  cookie: "🍪",
  brownie: "🍫",
  ice_cream: "🍦",
  oatmeal: "🥣",
  salad: "🥗",
};

/** Nombre legible del canonical (el backend devuelve canonical en snake_case). */
export function displayName(name: string): string {
  const es = FOOD_DISPLAY_ES[name.trim().toLowerCase()];
  if (es) return es;
  return name.replace(/_/g, " ");
}

/**
 * Nombre visible en español para canónicos USDA (datos, no chrome de UI —
 * mismo patrón que FOOD_EMOJI). Clave = canonical en minúsculas con guiones.
 */
const FOOD_DISPLAY_ES: Record<string, string> = {
  chicken: "pollo",
  grilled_chicken: "pollo a la plancha",
  fried_chicken: "pollo frito",
  chicken_nuggets: "nuggets de pollo",
  pork: "cerdo",
  beef: "carne de res",
  steak: "bistec",
  fish: "pescado",
  salmon: "salmón",
  tuna: "atún",
  shrimp: "camarones",
  rice: "arroz",
  beans: "frijoles",
  beans_yellow_mature_seeds_raw: "frijoles amarillos",
  lentil: "lentejas",
  chickpea: "garbanzos",
  peanuts: "maní",
  peanut: "maní",
  potato: "papa",
  potatoes: "papas",
  egg: "huevo",
  eggs: "huevos",
  cheese: "queso",
  milk: "leche",
  yogurt: "yogur",
  bread: "pan",
  pasta: "pasta",
  noodles: "fideos",
  salad: "ensalada",
  soup: "sopa",
  pizza: "pizza",
  hamburger: "hamburguesa",
  hot_dog: "perro caliente",
  taco: "taco",
  arepa: "arepa",
  empanada: "empanada",
  chocolate: "chocolate",
  candy: "dulce",
  cookie: "galleta",
  cake: "torta",
  ice_cream: "helado",
  avocado: "aguacate",
  mango: "mango",
  corn: "maíz",
  bacon: "tocineta",
  sausage: "chorizo",
  ham: "jamón",
  oatmeal: "avena",
  pancakes: "panqueques",
  juice: "jugo",
  coffee: "café",
  apple: "manzana",
  banana: "banano",
  orange: "naranja",
};

/**
 * Envía la imagen al backend y devuelve el análisis tipado.
 * Lanza FoodAiError con mensaje orientado al usuario ante cualquier fallo.
 */
export async function analyzeFoodImage(
  image: Blob,
  fileName: string,
): Promise<FoodAnalysisResult> {
  const form = new FormData();
  form.append("image", image, fileName);
  // crypto.randomUUID exige contexto seguro; en web http por IP LAN no
  // existe → fallback determinista para no romper el análisis.
  const analysisId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `food-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  form.append("analysis_id", analysisId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/foodai/analyze`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new FoodAiError(await messageForStatus(res.status), res.status);
    }

    const data = (await res.json()) as FoodAnalysisResult;
    if (!data || !Array.isArray(data.foods)) {
      throw new FoodAiError(
        "El servicio devolvió una respuesta inesperada.",
        502,
      );
    }
    return data;
  } catch (err) {
    if (err instanceof FoodAiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new FoodAiError(
        "El análisis tardó más de lo esperado. Intenta de nuevo.",
        null,
      );
    }
    throw new FoodAiError(
      "No se pudo conectar con el servicio de análisis. Verifica tu conexión.",
      null,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function messageForStatus(status: number): Promise<string> {
  switch (status) {
    case 400:
      return "La imagen no es válida. Intenta con otra fotografía.";
    case 401:
    case 403:
      return "No tienes permiso para usar el analizador.";
    case 404:
      return "El servicio de análisis no está disponible en este momento.";
    case 408:
      return "El análisis tardó demasiado. Intenta de nuevo.";
    case 413:
      return "La imagen es demasiado grande. Intenta con una más liviana.";
    case 429:
      return "Demasiados análisis en poco tiempo. Espera unos segundos y reintenta.";
    case 500:
    case 502:
    case 503:
      return "El servicio de análisis está ocupado. Intenta de nuevo en unos segundos.";
    default:
      return "Ocurrió un error al analizar la imagen.";
  }
}

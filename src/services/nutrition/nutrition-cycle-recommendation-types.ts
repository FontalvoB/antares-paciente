/** DTO público 3.10 / D0014, verificado contra backend 5cc5369. */
export interface NutritionCycleRecommendationDto {
  /** Ciclo revisado: se presenta como «Cierre del ciclo n», nunca como ciclo activo del plan. */
  cycleNumber: number;
  /** Período del ciclo revisado; no determina si la publicación es current. */
  startDate: string;
  endDate: string;
  /** Fecha de publicación que usa el backend para seleccionar y ordenar las recomendaciones. */
  publishedAt: string;
  /** Solo nombre del profesional; el rol visible se traduce en la app (R7-14). */
  professionalName: string;
  patientMessage: string;
  attachments: { url: string; caption: string }[];
}

/** Respuesta pública decidida en D0014. El backend selecciona y ordena los ciclos. */
export interface NutritionRecommendationsResponseDto {
  /** Publicación más reciente por published_at, aunque el ciclo revisado haya terminado; null si no hay publicaciones. */
  current: NutritionCycleRecommendationDto | null;
  /** Publicaciones anteriores, descendente por published_at; no por cycleNumber ni vigencia. */
  previous: NutritionCycleRecommendationDto[];
}

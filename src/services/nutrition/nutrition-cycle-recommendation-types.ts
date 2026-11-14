/** DTO por ciclo congelado en ARQUITECTURA.md §7.2; integración 3.10 pendiente. */
export interface NutritionCycleRecommendationDto {
  cycleNumber: number;
  startDate: string;
  endDate: string;
  publishedAt: string;
  professionalName: string;
  patientMessage: string;
  attachments: { url: string; caption: string }[];
}

/** Respuesta pública decidida en D0014. El backend selecciona y ordena los ciclos. */
export interface NutritionRecommendationsResponseDto {
  current: NutritionCycleRecommendationDto | null;
  previous: NutritionCycleRecommendationDto[];
}

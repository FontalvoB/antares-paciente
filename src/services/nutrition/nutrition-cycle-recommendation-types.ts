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

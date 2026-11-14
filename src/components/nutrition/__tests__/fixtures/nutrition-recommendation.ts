import type { NutritionCycleRecommendationDto } from '../../../../services/nutrition/nutrition-cycle-recommendation-types';

/** Solo pruebas: DTO público congelado, nunca importado por la app en ejecución. */
export const nutritionRecommendationFixture: NutritionCycleRecommendationDto = {
  cycleNumber: 2,
  startDate: '2026-11-07',
  endDate: '2026-12-06',
  publishedAt: '2026-12-07T14:30:00Z',
  professionalName: 'D. Ruiz · Nutrición',
  patientMessage: 'Ana, mantén una fuente de proteína en tu desayuno.\n\nTe adjunto una guía de platos para acompañar el plan de tu equipo.',
  attachments: [{
    url: 'https://media.example.invalid/cycle-2/plate.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&X-Amz-Signature=fixture',
    caption: 'Guía de platos para el próximo ciclo',
  }],
};

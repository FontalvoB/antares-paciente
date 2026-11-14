import type { NutritionCycleRecommendationDto, NutritionRecommendationsResponseDto } from '../../../../services/nutrition/nutrition-cycle-recommendation-types';

/** Solo pruebas: DTO público congelado, nunca importado por la app en ejecución. */
export const nutritionRecommendationFixture: NutritionCycleRecommendationDto = {
  cycleNumber: 2,
  startDate: '2026-11-07',
  endDate: '2026-12-06',
  publishedAt: '2026-12-07T14:30:00Z',
  professionalName: 'Daniela Ruiz · Nutricionista',
  patientMessage: 'Ana, mantén una fuente de proteína en tu desayuno.\n\nTe adjunto una guía de platos para acompañar el plan de tu equipo.',
  attachments: [{
    url: 'https://media.example.invalid/cycle-2/plate.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&X-Amz-Signature=fixture',
    caption: 'Guía de platos para el próximo ciclo',
  }, {
    url: 'https://media.example.invalid/cycle-2/protein.jpg?X-Amz-Expires=300&X-Amz-Signature=fixture',
    caption: 'Porciones de proteína',
  }, {
    url: 'https://media.example.invalid/cycle-2/shopping.jpg?X-Amz-Expires=300&X-Amz-Signature=fixture',
    caption: 'Lista de compras',
  }],
};

/** Mismo DTO público; publicación anterior sobre su propio ciclo revisado. */
export const previousNutritionRecommendationFixture: NutritionCycleRecommendationDto = {
  ...nutritionRecommendationFixture,
  cycleNumber: 1,
  startDate: '2026-10-08',
  endDate: '2026-11-06',
  publishedAt: '2026-11-07T14:30:00Z',
  patientMessage: 'Ana, continúa con las pausas de hidratación acordadas con tu equipo.',
  attachments: [{
    url: nutritionRecommendationFixture.attachments[0].url.replace('cycle-2', 'cycle-1'),
    caption: 'Guía de hidratación del ciclo anterior',
  }],
};

export const nutritionRecommendationHistoryFixture: readonly NutritionCycleRecommendationDto[] = [
  nutritionRecommendationFixture,
  previousNutritionRecommendationFixture,
];

/** D0014 final: cierre del ciclo 2 publicado al comenzar el siguiente; no es el plan vigente. */
export const nutritionRecommendationsResponseFixture: NutritionRecommendationsResponseDto = {
  current: nutritionRecommendationFixture,
  previous: [previousNutritionRecommendationFixture],
};

/** Publicaciones tardías: el ciclo 1 es la publicación más reciente; previous no ordena por número. */
export const nutritionRecommendationsPublicationOrderFixture: NutritionRecommendationsResponseDto = {
  current: { ...previousNutritionRecommendationFixture, publishedAt: '2027-01-08T14:30:00Z' },
  previous: [
    { ...nutritionRecommendationFixture, publishedAt: '2027-01-07T14:30:00Z' },
    { ...nutritionRecommendationFixture, cycleNumber: 3, startDate: '2026-12-07', endDate: '2027-01-05', publishedAt: '2027-01-06T14:30:00Z' },
  ],
};

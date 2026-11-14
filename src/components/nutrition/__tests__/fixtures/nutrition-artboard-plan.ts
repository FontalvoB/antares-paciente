import type { MyNutritionPlanDto } from '../../../../services/nutrition/my-nutrition-plan-service';
import type { ProgramSnapshotDto } from '../../../../services/program/types';

/** Datos ilustrativos de los artboards; solo pruebas y revisión visual aislada. */
export const nutritionArtboardPlan: MyNutritionPlanDto = {
  id: 'fixture-plan', revision: 1, name: 'Plan de mi ciclo', currentDay: 4,
  durationDays: 30, startDate: '2026-12-07', endDate: '2027-01-05',
  meals: [
    { mealType: 'Desayuno', description: 'Avena con fruta y huevo' },
    { mealType: 'Almuerzo', description: 'Pollo, arroz y ensalada' },
    { mealType: 'Cena', description: 'Crema de verduras y atún' },
  ],
};

export const nutritionArtboardSnapshot = {
  enrollmentId: '11111111-1111-4111-8111-111111111111', todayLocalDate: '2026-12-10',
  template: { currentWeekNumber: 1, totalWeeks: 12 },
  todayTasks: [{ taskCode: 'nut', title: 'Nutrición', short: '', points: 10, status: 'Pending', content: { nutritionPlanName: 'Plan de mi ciclo' } }],
  xp: { balance: 0 }, streak: { current: 0 }, calendar: [],
} as unknown as ProgramSnapshotDto;

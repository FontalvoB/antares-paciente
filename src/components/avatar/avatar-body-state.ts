import type { MetricsHistoryDto } from '../../services/program/types';
import type { MorphWeights } from './avatar-validation';

export interface AvatarBodyState {
  bodyVolume: number; bodyLean: number; abdomen: number; waist: number;
  chest: number; arms: number; thighs: number; faceVolume: number; muscleDefinition: number;
}
export interface WeightRecord { date: string; value: number }
// Sensibilidad artística versionada, NO equivalencia entre masa y volumen anatómico.
export const VISUAL_RELATIVE_RANGE = 0.20;
export const AVATAR_HISTORY_DAYS = 365;

export class AvatarHistoryDataError extends Error {
  readonly code: 'INVALID_HISTORY_RESPONSE' | 'UNSUPPORTED_WEIGHT_UNIT' | 'INVALID_WEIGHT_RECORDS';
  readonly unit?: string;
  constructor(code: AvatarHistoryDataError['code'], unit?: string) {
    super(code);
    this.name = 'AvatarHistoryDataError';
    this.code = code;
    this.unit = unit;
  }
}

/** Consume solo la serie real en kg; no sustituye ausencias por datos de perfil/demo. */
export function weightRecords(history: MetricsHistoryDto | undefined): WeightRecord[] {
  if (!history || !Array.isArray(history.metrics)
    || history.metrics.some(m => !m || typeof m.code !== 'string' || !Array.isArray(m.points))) {
    throw new AvatarHistoryDataError('INVALID_HISTORY_RESPONSE');
  }
  const series = history.metrics.find(m => m.code.trim().toLowerCase() === 'weight');
  if (!series || series.points.length === 0) return [];
  if (typeof series.unit !== 'string' || series.unit.trim().toLowerCase() !== 'kg') {
    throw new AvatarHistoryDataError('UNSUPPORTED_WEIGHT_UNIT', typeof series.unit === 'string' ? series.unit : undefined);
  }
  const dates = new Map<string, WeightRecord>();
  for (const point of series.points) {
    if (!point || typeof point.date !== 'string') continue;
    const date = new Date(`${point.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || !Number.isFinite(date.getTime())
      || date.toISOString().slice(0, 10) !== point.date
      || !Number.isFinite(point.value) || point.value <= 0) continue;
    dates.set(point.date, { ...point });
  }
  if (dates.size === 0) throw new AvatarHistoryDataError('INVALID_WEIGHT_RECORDS');
  return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function bodyState(referenceKg: number, selectedKg: number): AvatarBodyState {
  const relative = Number.isFinite(referenceKg) && referenceKg > 0
    && Number.isFinite(selectedKg) && selectedKg > 0 ? (selectedKg - referenceKg) / referenceKg : 0;
  const visual = Math.max(-1, Math.min(1, relative / VISUAL_RELATIVE_RANGE));
  return {
    bodyVolume: Math.max(0, visual), bodyLean: Math.max(0, -visual),
    abdomen: 0, waist: 0, chest: 0, arms: 0, thighs: 0, faceVolume: 0, muscleDefinition: 0,
  };
}

export function bodyMorphs(state: AvatarBodyState): MorphWeights {
  return {
    BodyVolume: state.bodyVolume, BodyLean: state.bodyLean, Abdomen: state.abdomen,
    Waist: state.waist, Chest: state.chest, Arms: state.arms, Thighs: state.thighs,
    FaceVolume: state.faceVolume, MuscleDefinition: state.muscleDefinition,
  };
}

/** Suaviza UN eje firmado: ni siquiera al cruzar cero combina volumen y reducción. */
export function approachBody(current: number, target: number, delta: number): number {
  if (Math.abs(current - target) < 0.0001) return target;
  return current + (target - current) * (1 - Math.exp(-8 * Math.max(0, Math.min(delta, 0.1))));
}

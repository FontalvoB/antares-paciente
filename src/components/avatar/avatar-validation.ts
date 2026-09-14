export const AVATAR_URL = `${import.meta.env.BASE_URL}models/avatar/bodies/male-body-base-v8.glb`;
export type MorphWeights = Record<string, number>;
export interface AvatarMetrics {
  loadMs: number; firstFrameMs: number; bytes: number; triangles: number;
  materials: number; bones: number; textures: number; height: number;
  fps: number; calls: number; geometries: number; gpuTextures: number;
  heapMB?: number; idleTime: number; loops: number;
  visibleMs?: number; initialMorphWeights?: MorphWeights;
  equipment?: Record<string, { id: string; status: 'loading' | 'ready' | 'error'; bytes: number; loadMs?: number }>;
  rootPosition: number[]; headQuaternion: number[]; morphWeights: MorphWeights;
}
export interface MorphInfo { name: string; min: number; max: number }

// Límites del esquema del asset; no representan kilogramos.
export function changeMorph(current: MorphWeights, name: string, value: number): MorphWeights {
  const next = { ...current, [name]: Math.max(0, Math.min(1, value)) };
  if (name === 'BodyVolume' && value > 0) { next.BodyLean = 0; next.MuscleDefinition = 0; }
  if (name === 'BodyLean' && value > 0) next.BodyVolume = 0;
  if (name === 'MuscleDefinition' && value > 0) next.BodyVolume = 0;
  for (const key of Object.keys(next)) {
    if (!['BodyVolume', 'BodyLean', 'MuscleDefinition'].includes(key)) {
      next[key] = Math.min(next[key], 1 - 0.75 * (next.BodyVolume ?? 0));
    }
  }
  return next;
}

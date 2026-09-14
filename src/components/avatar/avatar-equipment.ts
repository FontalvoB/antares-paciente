export type AvatarGender = 'male' | 'female';
export const bodyCatalog = {
  male: { id: 'male-body-base', path: 'bodies/male-body-base-v9.glb' },
  female: { id: 'female-body-base', path: 'bodies/female-body-base-v2.glb' },
} as const;
export type EquipmentSlot = 'shirt' | 'pants' | 'shoes' | 'hair' | 'glasses' | 'watch' | 'bracelet';
export interface AvatarEquipmentState {
  clothing: { shirt: string | null; pants: string | null; shoes: string | null };
  hair: string | null;
  accessories: { glasses: string | null; watch: string | null; bracelet: string | null };
}
export const emptyEquipment: AvatarEquipmentState = {
  clothing: { shirt: null, pants: null, shoes: null }, hair: null,
  accessories: { glasses: null, watch: null, bracelet: null },
};
export interface EquipmentItem { id: string; slot: EquipmentSlot; label: string; path: string; color?: string }
export const equipmentCatalog: EquipmentItem[] = [
  { id: 'shirt-basic-01', slot: 'shirt', label: 'Camiseta petróleo', path: 'clothing/tops/male-shirt-basic-01-v3.glb' },
  { id: 'shirt-basic-01-navy', slot: 'shirt', label: 'Camiseta azul marino', path: 'clothing/tops/male-shirt-basic-01-v3.glb', color: '#142855' },
  { id: 'hair-02', slot: 'hair', label: 'Peinado lateral', path: 'hair/male-hair-02-v3.glb' },
  { id: 'hair-03', slot: 'hair', label: 'Rizado', path: 'hair/male-hair-03-v3.glb' },
  { id: 'glasses-01', slot: 'glasses', label: 'Gafas negras', path: 'accessories/glasses/unisex-glasses-02.glb' },
  { id: 'watch-01', slot: 'watch', label: 'Reloj deportivo', path: 'accessories/watches/unisex-watch-02.glb' },
  { id: 'bracelet-01', slot: 'bracelet', label: 'Pulsera sencilla', path: 'accessories/bracelets/unisex-bracelet-02.glb' },
];
const femalePaths: Record<string, string> = {
  'shirt-basic-01': 'clothing/tops/female-shirt-basic-01-v2.glb',
  'shirt-basic-01-navy': 'clothing/tops/female-shirt-basic-01-v2.glb',
  'hair-02': 'hair/female-hair-02-v1.glb',
  'glasses-01': 'accessories/glasses/female-glasses-02-v1.glb',
  'watch-01': 'accessories/watches/female-watch-02-v1.glb',
  'bracelet-01': 'accessories/bracelets/female-bracelet-02-v1.glb',
};
const femaleCatalog: EquipmentItem[] = [
  ...equipmentCatalog.filter(item => femalePaths[item.id])
    .map(item => ({ ...item, path: femalePaths[item.id] })),
  { id: 'female-hair-long-01', slot: 'hair', label: 'Largo liso', path: 'hair/female-hair-long-01.glb' },
  { id: 'female-hair-long-02', slot: 'hair', label: 'Largo ondulado', path: 'hair/female-hair-long-02.glb' },
  { id: 'female-hair-long-03', slot: 'hair', label: 'Recogido', path: 'hair/female-hair-long-03.glb' },
];
export function equippedItems(state: AvatarEquipmentState, gender: AvatarGender = 'male') {
  const ids = [...Object.values(state.clothing), state.hair, ...Object.values(state.accessories)];
  return compatibleEquipment(gender).filter(item => ids.includes(item.id));
}

export function compatibleEquipment(gender: AvatarGender) {
  return gender === 'male' ? equipmentCatalog : femaleCatalog;
}
export function equipmentForGender(state: AvatarEquipmentState, gender: AvatarGender): AvatarEquipmentState {
  const allowed = new Set(compatibleEquipment(gender).map(item => item.id));
  const keep = (id: string | null, slot: EquipmentSlot) => id && allowed.has(id)
    && compatibleEquipment(gender).some(item => item.id === id && item.slot === slot) ? id : null;
  return { clothing: { shirt: keep(state.clothing.shirt, 'shirt'), pants: keep(state.clothing.pants, 'pants'), shoes: keep(state.clothing.shoes, 'shoes') },
    hair: keep(state.hair, 'hair'), accessories: { glasses: keep(state.accessories.glasses, 'glasses'), watch: keep(state.accessories.watch, 'watch'), bracelet: keep(state.accessories.bracelet, 'bracelet') } };
}

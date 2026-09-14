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
  { id: 'hair-02', slot: 'hair', label: 'Hair 02 · Peinado lateral', path: 'hair/male-hair-02-v3.glb' },
  { id: 'hair-03', slot: 'hair', label: 'Hair 03 · Rizado', path: 'hair/male-hair-03-v3.glb' },
  { id: 'glasses-01', slot: 'glasses', label: 'Gafas negras', path: 'accessories/glasses/unisex-glasses-02.glb' },
  { id: 'watch-01', slot: 'watch', label: 'Reloj deportivo', path: 'accessories/watches/unisex-watch-02.glb' },
  { id: 'bracelet-01', slot: 'bracelet', label: 'Pulsera sencilla', path: 'accessories/bracelets/unisex-bracelet-02.glb' },
];
export function equippedItems(state: AvatarEquipmentState) {
  const ids = [...Object.values(state.clothing), state.hair, ...Object.values(state.accessories)];
  return equipmentCatalog.filter(item => ids.includes(item.id));
}

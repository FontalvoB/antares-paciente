import { expect, it } from 'vitest';
import { parseAvatarConfiguration } from '../../services/avatar-configuration-service';
import { changeAvatarGender } from '../../components/avatar/avatar-state';
import { compatibleEquipment } from '../../components/avatar/avatar-equipment';

const legacy = { version: 1, gender: 'female', hair: 'hair-02',
  clothing: { shirt: 'shirt-basic-01', pants: null, shoes: null },
  accessories: { glasses: null, watch: null, bracelet: null } };
it('normaliza piel antigua sin cambiar selecciones guardadas explícitamente vacías', () => {
  expect(parseAvatarConfiguration(legacy)).toEqual({ ...legacy, skin: 'skin-03' });
});
it('restaura todos los slots y conserva piel al retirar prendas incompatibles', () => {
  const selected = parseAvatarConfiguration({ ...legacy, skin: 'skin-04', hair: 'female-hair-long-01',
    clothing: { shirt: 'shirt-basic-01', pants: 'pants-female-02', shoes: 'shoes-female-01' },
    accessories: { glasses: 'glasses-01', watch: 'watch-01', bracelet: 'bracelet-01' } });
  expect(parseAvatarConfiguration(JSON.parse(JSON.stringify(selected)))).toEqual(selected);
  expect(changeAvatarGender(selected, 'male')).toEqual({ ...selected, gender: 'male', hair: null,
    clothing: { shirt: 'shirt-basic-01', pants: null, shoes: null } });
});
it('rechaza tono, slot y género incompatibles', () => {
  expect(() => parseAvatarConfiguration({ ...legacy, skin: 'skin-99' })).toThrow();
  expect(() => parseAvatarConfiguration({ ...legacy, clothing: { ...legacy.clothing, pants: 'pants-male-01' } })).toThrow();
  expect(() => parseAvatarConfiguration({ ...legacy, clothing: { ...legacy.clothing, shirt: 'pants-female-01' } })).toThrow();
});
it('el catálogo mantiene identidades estables para evitar recargar prendas en cada frame de métricas', () => {
  for (const gender of ['male', 'female'] as const) {
    const items = compatibleEquipment(gender);
    expect(compatibleEquipment(gender)).toBe(items);
    expect(items.filter(item => item.slot === 'pants')).toHaveLength(3);
    expect(items.every(item => item.category && item.gender === gender && item.path)).toBe(true);
  }
});

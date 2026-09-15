export const skinCatalog = [
  { id: 'skin-01', label: 'Claro', swatch: '#e8bd9f', factor: [1.55, 1.65, 1.75] },
  { id: 'skin-02', label: 'Claro medio', swatch: '#cfa27e', factor: [1.25, 1.3, 1.35] },
  { id: 'skin-03', label: 'Medio', swatch: '#ac7955', factor: [1, 1, 1] },
  { id: 'skin-04', label: 'Medio oscuro', swatch: '#805638', factor: [0.62, 0.59, 0.56] },
  { id: 'skin-05', label: 'Oscuro', swatch: '#513727', factor: [0.32, 0.30, 0.29] },
] as const;
export type SkinId = typeof skinCatalog[number]['id'];
export const isSkinId = (value: unknown): value is SkinId => skinCatalog.some(tone => tone.id === value);


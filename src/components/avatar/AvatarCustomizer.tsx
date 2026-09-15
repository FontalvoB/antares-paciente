import { body, shirt, cut, watch } from 'ionicons/icons';
import { skinCatalog } from './avatar-skin-catalog';
import { useState } from 'react';
import { IonButton, IonIcon, IonCard, IonCardContent, IonLabel, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from '@ionic/react';
import { useT } from '../../i18n/I18nContext';
import { compatibleEquipment } from './avatar-equipment';
import type { EquipmentSlot } from './avatar-equipment';
import { changeAvatarGender } from './avatar-state';
import type { AvatarConfiguration } from './avatar-state';

/** Editor de preferencias: el cuerpo continúa controlado por el historial clínico. */
export function AvatarCustomizer({ value, onChange, disabled = false }: {
  value: AvatarConfiguration; onChange: (value: AvatarConfiguration) => void; disabled?: boolean;
}) {
  const t = useT();
  const [section, setSection] = useState('body');
  const catalog = compatibleEquipment(value.gender);
  const icons: Record<string, string> = { body, clothing: shirt, hair: cut, accessories: watch };
  const select = (slot: EquipmentSlot, label: string, empty: string) => {
    const selected = slot === 'hair' ? value.hair : slot === 'shirt' || slot === 'pants' || slot === 'shoes'
      ? value.clothing[slot] : value.accessories[slot];
    return <IonSelect key={slot} label={t(label)} labelPlacement="stacked" interface="popover" disabled={disabled}
      value={selected ?? ''} onIonChange={e => {
        const id = e.detail.value || null;
        if (id && !catalog.some(item => item.slot === slot && item.id === id)) return;
        onChange(slot === 'hair' ? { ...value, hair: id } : slot === 'shirt' || slot === 'pants' || slot === 'shoes'
          ? { ...value, clothing: { ...value.clothing, [slot]: id } }
          : { ...value, accessories: { ...value.accessories, [slot]: id } });
      }}>
      <IonSelectOption value="">{t(empty)}</IonSelectOption>
      {catalog.filter(item => item.slot === slot).map(item => <IonSelectOption key={item.id} value={item.id}>{t(item.label)}</IonSelectOption>)}
    </IonSelect>;
  };
  return <IonCard className="avatar-customizer"><IonCardContent>
    <h2>{t('Personaliza tu avatar')}</h2>
    <IonSegment value={section} scrollable onIonChange={e => setSection(String(e.detail.value))} aria-label={t('Personalización del avatar')}>
      {[['body', 'Cuerpo'], ['clothing', 'Ropa'], ['hair', 'Cabello'], ['accessories', 'Accesorios']].map(([id, label]) =>
        <IonSegmentButton key={id} value={id}><span className="avatar-category-icon" aria-hidden="true"><IonIcon icon={icons[id]} /></span><IonLabel>{t(label)}</IonLabel></IonSegmentButton>)}
    </IonSegment>
    {section === 'body' && <>
      <IonSelect label={t('Género del avatar')} labelPlacement="stacked" interface="popover" value={value.gender} disabled={disabled}
        onIonChange={e => { if (e.detail.value === 'male' || e.detail.value === 'female') onChange(changeAvatarGender(value, e.detail.value)); }}>
        <IonSelectOption value="male">{t('Masculino')}</IonSelectOption><IonSelectOption value="female">{t('Femenino')}</IonSelectOption>
      </IonSelect>
      <div className="avatar-skin-options" role="group" aria-label={t('Tono de piel')}>
        <h3>{t('Tono de piel')}</h3>
        <div className="avatar-skin-swatches">{skinCatalog.map(tone => <IonButton key={tone.id} fill="clear" disabled={disabled}
          aria-label={t(tone.label)} aria-pressed={value.skin === tone.id} onClick={() => onChange({ ...value, skin: tone.id })}>
          <span className="avatar-skin-swatch" style={{ backgroundColor: tone.swatch }} aria-hidden="true">{value.skin === tone.id ? '✓' : ''}</span>
        </IonButton>)}</div>
      </div>
      <p>{t('La evolución corporal se obtiene de tu historial de peso. Aquí eliges la apariencia de tu avatar.')}</p>
    </>}
    {section === 'clothing' && <>{select('shirt', 'Camiseta', 'Sin camiseta')}{select('pants', 'Pantalón', 'Sin pantalón')}{select('shoes', 'Zapatos', 'Sin zapatos')}</>}
    {section === 'hair' && select('hair', 'Cabello', 'Sin cabello')}
    {section === 'accessories' && <>{select('glasses', 'Gafas', 'Sin accesorio')}{select('watch', 'Reloj', 'Sin accesorio')}{select('bracelet', 'Pulsera', 'Sin accesorio')}</>}
  </IonCardContent></IonCard>;
}

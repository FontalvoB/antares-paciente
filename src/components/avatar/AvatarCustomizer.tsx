import { useState } from 'react';
import { IonCard, IonCardContent, IonLabel, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from '@ionic/react';
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
        <IonSegmentButton key={id} value={id}><IonLabel>{t(label)}</IonLabel></IonSegmentButton>)}
    </IonSegment>
    {section === 'body' && <>
      <IonSelect label={t('Género del avatar')} labelPlacement="stacked" interface="popover" value={value.gender} disabled={disabled}
        onIonChange={e => { if (e.detail.value === 'male' || e.detail.value === 'female') onChange(changeAvatarGender(value, e.detail.value)); }}>
        <IonSelectOption value="male">{t('Masculino')}</IonSelectOption><IonSelectOption value="female">{t('Femenino')}</IonSelectOption>
      </IonSelect>
      <p>{t('La evolución corporal se obtiene de tu historial de peso. Aquí eliges la apariencia de tu avatar.')}</p>
    </>}
    {section === 'clothing' && select('shirt', 'Camiseta', 'Sin camiseta')}
    {section === 'hair' && select('hair', 'Cabello', 'Sin cabello')}
    {section === 'accessories' && <>{select('glasses', 'Gafas', 'Sin accesorio')}{select('watch', 'Reloj', 'Sin accesorio')}{select('bracelet', 'Pulsera', 'Sin accesorio')}</>}
  </IonCardContent></IonCard>;
}

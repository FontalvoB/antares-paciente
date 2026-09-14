import { useEffect, useRef, useState } from 'react';
import { IonButton, IonButtons, IonContent, IonDatetime, IonFooter, IonHeader, IonInput, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useT } from '../../i18n/I18nContext';
import { toLocalISODate } from '../../utils/dates';
import { ApiError } from '../../utils/apiClient';
import { recordWeight } from '../../services/program/metrics-history-service';
import { getAccessToken, onSessionInvalid } from '../../utils/authApi';
import { weightFormError } from './weight-record-validation';

export function WeightRecordModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(toLocalISODate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const inFlight = useRef(false);
  const saved = useRef(false);
  const sessionInvalid = useRef(false);
  useEffect(() => onSessionInvalid(() => { sessionInvalid.current = true; }), []);
  const validation = weightFormError(weight, date);
  const save = async () => {
    if (inFlight.current) return;
    if (validation) { setError(t(validation)); return; }
    if (!getAccessToken() || sessionInvalid.current) {
      setError(t('La sesión ha cambiado. Cierra el formulario y vuelve a intentarlo.')); return;
    }
    inFlight.current = true; setSaving(true); setError(null);
    try {
      await recordWeight(Number(weight.trim().replace(',', '.')), date);
      saved.current = true;
      setOpen(false);
    } catch (cause) {
      const detail = cause instanceof ApiError
        ? [cause.message, ...Object.values(cause.errors ?? {}).flat()].filter(Boolean).join(' · ')
        : cause instanceof Error ? cause.message : t('No se pudo guardar el peso.');
      setError(detail);
    } finally { inFlight.current = false; setSaving(false); }
  };
  return <IonModal className="avatar-weight-modal" aria-labelledby="avatar-weight-title" isOpen={open} canDismiss={!saving} onDidDismiss={() => {
    if (saved.current && getAccessToken() && !sessionInvalid.current) onSaved();
    onClose();
  }}>
    <IonHeader><IonToolbar>
      <IonTitle id="avatar-weight-title">{t('Registrar peso')}</IonTitle>
      <IonButtons slot="end"><IonButton disabled={saving} onClick={() => setOpen(false)}>{t('Cancelar')}</IonButton></IonButtons>
    </IonToolbar></IonHeader>
    <IonContent className="ion-padding">
      <form onSubmit={e => { e.preventDefault(); void save(); }}>
        {(error || (weight !== '' && validation)) && <p role="alert">{error ?? t(validation!)}</p>}
        <IonInput label={t('Peso (kg)')} labelPlacement="stacked" inputmode="decimal" type="text"
          value={weight} required disabled={saving} onIonInput={e => setWeight(String(e.detail.value ?? ''))}
          helperText={t('Entre 1 y 500 kg. Hasta dos decimales.')} />
        <p>{t('Fecha del registro')}</p>
        <IonDatetime aria-label={t('Fecha del registro')} presentation="date" value={date}
          min="0001-01-02" max={toLocalISODate()} disabled={saving}
          onIonChange={e => setDate(typeof e.detail.value === 'string' ? e.detail.value.slice(0, 10) : '')} />
      </form>
    </IonContent>
    <IonFooter><IonToolbar>
      <IonButton expand="block" fill="solid" color="primary" onClick={() => void save()} disabled={saving || validation !== null}>
        {saving && <IonSpinner slot="start" />}{saving ? t('Guardando…') : t('Guardar')}
      </IonButton>
    </IonToolbar></IonFooter>
  </IonModal>;
}

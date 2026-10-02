import { Component, lazy, Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { IonButton, IonCard, IonCardContent, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
import { PageHeader } from '../components/PageHeader';
import { Screen, Scroll } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { useT } from '../i18n/I18nContext';
import type { AvatarMetrics, MorphInfo } from '../components/avatar/avatar-validation';
import { bodyMorphs, bodyState } from '../components/avatar/avatar-body-state';
import { useAvatarProgress } from '../hooks/useAvatarProgress';
import { formatDateForDisplay } from '../utils/dates';
import { WeightRecordModal } from '../components/avatar/WeightRecordModal';
import { AvatarCustomizer } from '../components/avatar/AvatarCustomizer';
import type { AvatarState } from '../components/avatar/avatar-state';
import { useAvatarConfiguration } from '../hooks/useAvatarConfiguration';

const Viewer = lazy(() => import('../components/avatar/AvatarViewer').then(m => ({ default: m.AvatarViewer })));

class ViewerBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div data-avatar-load-state="ERROR" data-avatar-error="asset">{this.props.fallback}</div> : this.props.children; }
}

export function AvatarPage() {
  const t = useT(), { navigate, showToast } = useApp();
  const [recordOpen, setRecordOpen] = useState(false);
  const progress = useAvatarProgress();
  const [enteredAt] = useState(() => performance.now());
  const customization = useAvatarConfiguration();
  const configuration = customization.value;
  const gender = configuration?.gender;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const reference = progress.records[0];
  const latest = progress.records.at(-1);
  const selected = progress.records.find(r => r.date === selectedDate) ?? latest;
  const state = progress.resolved ? bodyState(reference?.value ?? 0, selected?.value ?? 0) : null;
  const avatar: AvatarState | null = state && configuration ? { ...configuration, body: state } : null;
  const weights = state ? bodyMorphs(state) : null;
  const [morphs, setMorphs] = useState<MorphInfo[]>([]);
  const [metrics, setMetrics] = useState<AvatarMetrics | null>(null);
  const [playing, setPlaying] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const dataError = ['error', 'unavailable', 'session-required'].includes(progress.status);
  const dataPhase = dataError ? 'ERROR' : progress.status === 'loading' ? 'LOADING_USER_DATA'
    : progress.status === 'empty' ? 'NO_DATA' : 'USER_DATA_READY';
  return <Screen>
    <PageHeader title={t('Avatar · Mi evolución')} sub={t('Representación visual de tu progreso registrado')}
      trailing={<IonButton fill="clear" onClick={() => navigate('prof')}>{t('Volver')}</IonButton>} />
    <Scroll>
      <div data-avatar-body-state={JSON.stringify(state)} data-avatar-data-state={dataPhase}
        data-avatar-history-ms={progress.historyMs}
        style={{ position: 'sticky', top: 0, zIndex: 2, padding: '0 16px 8px', background: 'var(--g0)' }}>
        {!weights && !dataError && <div role="status"><IonSpinner /> {t('Consultando tu historial de peso…')}</div>}
        {dataError && <p role="alert">{t('El avatar espera datos válidos. Revisa el estado del historial.')}</p>}
        {customization.status === 'loading' && <div role="status"><IonSpinner /> {t('Cargando tu personalización…')}</div>}
        {customization.status === 'error' && <div role="alert"><p>{t('No se pudo cargar tu personalización.')}</p>
          <IonButton onClick={customization.retry}>{t('Reintentar personalización')}</IonButton></div>}
        {weights && avatar && <div hidden={dataError} data-avatar-load-state={metrics ? 'AVATAR_READY' : 'AVATAR_LOADING'}>
        <ViewerBoundary key={`${progress.owner}:${gender}:${attempt}`} fallback={<div role="alert">
          <p>{t('No se pudo mostrar el avatar. Comprueba la conexión y WebGL.')}</p>
          <IonButton onClick={() => { setMetrics(null); setMorphs([]); setAttempt(a => a + 1); }}>{t('Reintentar')}</IonButton>
        </div>}>
          <Suspense fallback={<div role="status"><IonSpinner /> {t('Cargando avatar…')}</div>}>
            <Viewer gender={gender} weights={weights} equipment={avatar} playing={playing && !dataError} enteredAt={enteredAt} onReady={setMorphs} onMetrics={setMetrics} />
          </Suspense>
        </ViewerBoundary>
        </div>}
      </div>
      <div style={{ padding: '0 16px' }}>
        <p style={{ fontSize: 12 }}>{t('Arrastra para girar; pellizca para acercar.')}</p>
        <IonButton disabled={!morphs.length || dataError || !weights} fill="outline" onClick={() => setPlaying(p => !p)}>
          {playing ? t('Pausar movimiento') : t('Reanudar movimiento')}
        </IonButton>
      </div>
      {configuration && <AvatarCustomizer value={configuration} onChange={next => {
        if (next.gender !== gender) { setMetrics(null); setMorphs([]); }
        customization.change(next);
      }} />}
      {configuration && <div style={{ padding: '0 16px' }} data-avatar-configuration={JSON.stringify(configuration)}>
        <IonButton disabled={!customization.dirty || customization.saving} onClick={() => void customization.save()}>
          {customization.saving ? t('Guardando…') : customization.saveError ? t('Reintentar guardado') : t('Guardar avatar')}
        </IonButton>
        <p role={customization.saveError ? 'alert' : 'status'}>{customization.saveError
          ? t('No se pudo guardar. Tu selección se conserva; vuelve a intentarlo.')
          : customization.dirty ? t('Tienes cambios sin guardar.') : t('Personalización sincronizada.')}</p>
      </div>}
      <div style={{ padding: '0 16px' }}>
        {Object.values(metrics?.equipment ?? {}).some(item => item.status === 'loading') && <p role="status"><IonSpinner /> {t('Cargando elementos del avatar…')}</p>}
        {Object.values(metrics?.equipment ?? {}).some(item => item.status === 'error') && <p role="alert">{t('No se pudo cargar un elemento. Quítalo y vuelve a seleccionarlo para reintentar.')}</p>}
      </div>
      <IonCard><IonCardContent>
        <p>{t('Vista relativa a tu primer registro válido de los últimos 365 días. No es una simulación médica ni reproduce tu anatomía.')}</p>
        {progress.status === 'loading' && <div role="status"><IonSpinner /> {t('Consultando tu historial de peso…')}</div>}
        {progress.status === 'session-required' && <p role="status">{t('Inicia sesión con una cuenta real para consultar tu progreso. El acceso demo no contiene mediciones reales.')}</p>}
        {progress.status === 'empty' && <>
          <p role="status">{t('No hay registros de peso suficientes para mostrar tu evolución.')}</p>
          <IonButton onClick={() => navigate('hc')}>{t('Completar historia clínica')}</IonButton>
        </>}
        {progress.status === 'unavailable' && <p role="status">{t('El historial no está disponible: se requiere perfil de paciente e inscripción activa en el programa.')}</p>}
        {progress.status === 'error' && <div role="alert">
          <p>{t('Error al cargar historial.')}</p>
          {progress.error?.code === 'UNSUPPORTED_WEIGHT_UNIT' && <p>{t('La API devolvió registros con una unidad de peso no compatible: {unit}.', { unit: progress.error.unit ?? '—' })}</p>}
          {progress.error?.code === 'INVALID_HISTORY_RESPONSE' && <p>{t('La respuesta del historial no tiene el formato esperado.')}</p>}
          {progress.error?.code === 'INVALID_WEIGHT_RECORDS' && <p>{t('La API devolvió registros, pero sus fechas o valores de peso no son válidos.')}</p>}
          {progress.error?.status !== undefined && <p>HTTP {progress.error.status || '—'}{progress.error.message ? ` · ${progress.error.message}` : ''}</p>}
          {progress.error?.code && <p>{t('Código de error')}: {progress.error.code}</p>}
          {progress.error?.correlationId && <p>{t('Identificador de diagnóstico')}: {progress.error.correlationId}</p>}
        </div>}
        {progress.status !== 'session-required' && <IonButton fill="outline" disabled={progress.status === 'loading'}
          onClick={() => setRecordOpen(true)}>{t('Actualizar historial')}</IonButton>}
        {progress.status === 'error' && <IonButton fill="clear" onClick={() => progress.refresh()}>{t('Reintentar')}</IonButton>}
      </IonCardContent></IonCard>
      {progress.status === 'ready' && reference && selected && latest && <>
      <IonCard>
        <IonCardContent>
          <h2>{t('Evolución del peso registrado')}</h2>
          <p>{t('Registros válidos')}: {progress.records.length}</p>
          <p>{t('Referencia del período')}: {formatDateForDisplay(reference.date)} · {reference.value} kg</p>
          <p>{t('Último registro disponible')}: {formatDateForDisplay(latest.date)} · {latest.value} kg</p>
          <IonButton fill="outline" onClick={() => setSelectedDate(reference.date)}>{t('Ver inicial del período')}</IonButton>
          <IonButton fill="outline" onClick={() => setSelectedDate(null)}>{t('Ver último registro')}</IonButton>
          <IonSelect label={t('Registro mostrado')} labelPlacement="stacked" interface="popover"
            value={selected.date} onIonChange={e => setSelectedDate(String(e.detail.value))}>
            {progress.records.map(r => <IonSelectOption key={r.date} value={r.date}>
              {formatDateForDisplay(r.date)} · {r.value} kg
            </IonSelectOption>)}
          </IonSelect>
          <p aria-live="polite">{t('Cambio respecto a la referencia')}: {(selected.value - reference.value).toFixed(2)} kg
            {' · '}{((selected.value / reference.value - 1) * 100).toFixed(2)} %</p>
          {progress.records.length === 1 && <p>{t('Solo hay un registro: se muestra la referencia neutral hasta disponer de otra medición.')}</p>}
          <p>{t('La transición entre registros es visual; no crea mediciones intermedias. El peso no determina cambios regionales ni musculatura.')}</p>
        </IonCardContent>
      </IonCard>
      </>}
      {metrics && <div hidden data-avatar-metrics={JSON.stringify(metrics)} />}
    </Scroll>
    {recordOpen && <WeightRecordModal onClose={() => setRecordOpen(false)} onSaved={() => {
      setSelectedDate(null); progress.refresh(); showToast(t('Peso guardado correctamente.'), 'ok');
    }} />}
  </Screen>;
}

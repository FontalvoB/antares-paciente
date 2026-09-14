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
import { emptyEquipment, equipmentCatalog } from '../components/avatar/avatar-equipment';
import type { AvatarEquipmentState } from '../components/avatar/avatar-equipment';

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
  const [equipment, setEquipment] = useState<AvatarEquipmentState>(emptyEquipment);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const reference = progress.records[0];
  const latest = progress.records.at(-1);
  const selected = progress.records.find(r => r.date === selectedDate) ?? latest;
  const state = progress.resolved ? bodyState(reference?.value ?? 0, selected?.value ?? 0) : null;
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
        {weights && <div hidden={dataError} data-avatar-load-state={metrics ? 'AVATAR_READY' : 'AVATAR_LOADING'}>
        <ViewerBoundary key={`${progress.owner}:${attempt}`} fallback={<div role="alert">
          <p>{t('No se pudo mostrar el avatar. Comprueba la conexión y WebGL.')}</p>
          <IonButton onClick={() => { setMetrics(null); setMorphs([]); setAttempt(a => a + 1); }}>{t('Reintentar')}</IonButton>
        </div>}>
          <Suspense fallback={<div role="status"><IonSpinner /> {t('Cargando avatar…')}</div>}>
            <Viewer weights={weights} equipment={equipment} playing={playing && !dataError} enteredAt={enteredAt} onReady={setMorphs} onMetrics={setMetrics} />
          </Suspense>
        </ViewerBoundary>
        </div>}
      </div>
      <div style={{ padding: '0 16px' }}>
        <p style={{ fontSize: 12 }}>{t('Arrastra para girar; pellizca para acercar.')}</p>
        <IonButton disabled={!morphs.length || dataError || !weights} fill="outline" onClick={() => setPlaying(p => !p)}>
          {playing ? t('Pausar Idle') : t('Reproducir Idle')}
        </IonButton>
      </div>
      <IonCard><IonCardContent>
        <h2>{t('Prueba de ropa')}</h2>
        <IonSelect label={t('Camiseta')} labelPlacement="stacked" interface="popover" value={equipment.clothing.shirt ?? ''}
          onIonChange={e => setEquipment(current => ({ ...current, clothing: { ...current.clothing, shirt: e.detail.value || null } }))}>
          <IonSelectOption value="">{t('Sin camiseta')}</IonSelectOption>
          {equipmentCatalog.filter(item => item.slot === 'shirt').map(item => <IonSelectOption key={item.id} value={item.id}>{t(item.label)}</IonSelectOption>)}
        </IonSelect>
        <IonSelect label={t('Cabello')} labelPlacement="stacked" interface="popover" value={equipment.hair ?? ''}
          onIonChange={e => setEquipment(current => ({ ...current, hair: e.detail.value || null }))}>
          <IonSelectOption value="">{t('Sin cabello')}</IonSelectOption>
          {equipmentCatalog.filter(item => item.slot === 'hair').map(item => <IonSelectOption key={item.id} value={item.id}>{t(item.label)}</IonSelectOption>)}
        </IonSelect>
        {(['glasses', 'watch', 'bracelet'] as const).map(slot => <IonSelect key={slot}
          label={t({ glasses: 'Gafas', watch: 'Reloj', bracelet: 'Pulsera' }[slot])} labelPlacement="stacked" interface="popover"
          value={equipment.accessories[slot] ?? ''}
          onIonChange={e => setEquipment(current => ({ ...current, accessories: { ...current.accessories, [slot]: e.detail.value || null } }))}>
          <IonSelectOption value="">{t('Sin accesorio')}</IonSelectOption>
          {equipmentCatalog.filter(item => item.slot === slot).map(item => <IonSelectOption key={item.id} value={item.id}>{t(item.label)}</IonSelectOption>)}
        </IonSelect>)}
        {Object.values(metrics?.equipment ?? {}).some(item => item.status === 'loading') && <p role="status"><IonSpinner /> {t('Cargando elementos del avatar…')}</p>}
        {Object.values(metrics?.equipment ?? {}).some(item => item.status === 'error') && <p role="alert">{t('No se pudo cargar un elemento. Quítalo y vuelve a seleccionarlo para reintentar.')}</p>}
      </IonCardContent></IonCard>
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
          <p>BodyVolume: {state?.bodyVolume.toFixed(2)} · BodyLean: {state?.bodyLean.toFixed(2)}</p>
        </IonCardContent>
      </IonCard>
      </>}
      <IonCard>
        <IonCardContent>
          <h2>{t('Rendimiento · Sesión actual')}</h2>
          {metrics ? <div data-avatar-metrics={JSON.stringify(metrics)} style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div>{t('Carga del historial')}: {progress.historyMs?.toFixed(0) ?? '—'} ms</div>
            <div>{t('Entrada a pantalla / avatar visible')}: {metrics.visibleMs?.toFixed(0) ?? '—'} ms</div>
            <div>{t('Carga GLB / primer frame')}: {metrics.loadMs.toFixed(0)} / {metrics.firstFrameMs.toFixed(0)} ms</div>
            <div>FPS: {metrics.fps.toFixed(1)} · Draw calls: {metrics.calls}</div>
            <div>{t('Tamaño / triángulos')}: {(metrics.bytes / 1e6).toFixed(2)} MB / {metrics.triangles}</div>
            <div>{t('Huesos / materiales / texturas')}: {metrics.bones} / {metrics.materials} / {metrics.textures}</div>
            <div>{t('Altura')}: {metrics.height.toFixed(2)} m</div>
            <div>{t('Geometrías / texturas GPU')}: {metrics.geometries} / {metrics.gpuTextures}</div>
            <div>{t('Heap JS de la página')}: {metrics.heapMB?.toFixed(1) ?? '—'} MB</div>
            <div>{t('Bucles Idle completados')}: {metrics.loops}</div>
          </div> : <p>{t('Esperando el primer frame…')}</p>}
          <p>{t('Medición local aproximada. El heap incluye toda la página; no mide memoria GPU ni garantiza rendimiento móvil.')}</p>
        </IonCardContent>
      </IonCard>
    </Scroll>
    {recordOpen && <WeightRecordModal onClose={() => setRecordOpen(false)} onSaved={() => {
      setSelectedDate(null); progress.refresh(); showToast(t('Peso guardado correctamente.'), 'ok');
    }} />}
  </Screen>;
}

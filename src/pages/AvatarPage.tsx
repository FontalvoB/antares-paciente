import { Component, lazy, Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { IonButton, IonCard, IonCardContent, IonLabel, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
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
  const t = useT(), { navigate, showToast, authLoading } = useApp();
  const [recordOpen, setRecordOpen] = useState(false);
  const [view, setView] = useState('appearance');
  const [viewpoint, setViewpoint] = useState<'front' | 'side'>('front');
  const [viewRevision, setViewRevision] = useState(0);
  const [enteredAt] = useState(() => performance.now());
  const customization = useAvatarConfiguration(!authLoading);
  const progress = useAvatarProgress(!authLoading && customization.status === 'ready');
  const configuration = customization.value;
  const gender = configuration?.gender;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const reference = progress.records[0];
  const latest = progress.records.at(-1);
  const selected = (view === 'evolution' ? progress.records.find(r => r.date === selectedDate) : undefined) ?? latest;
  const state = progress.resolved ? bodyState(reference?.value ?? 0, selected?.value ?? 0) : null;
  const avatar: AvatarState | null = state && configuration ? { ...configuration, body: state } : null;
  const weights = state ? bodyMorphs(state) : null;
  const [morphs, setMorphs] = useState<MorphInfo[]>([]);
  const [metrics, setMetrics] = useState<AvatarMetrics | null>(null);
  const [playing, setPlaying] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const dataError = !authLoading && (customization.status === 'error' || customization.status === 'session-required'
    || ['error', 'unavailable', 'session-required'].includes(progress.status));
  const dataPhase = dataError ? 'ERROR' : authLoading || customization.status === 'loading' || progress.status === 'loading' ? 'LOADING_USER_DATA'
    : progress.status === 'empty' ? 'NO_DATA' : 'USER_DATA_READY';
  return <Screen className="avatar-experience">
    <PageHeader title={view === 'appearance' ? t('Mi Avatar') : t('Mi evolución')}
      sub={view === 'appearance' ? t('Tu estilo, tu evolución.') : t('Representación visual de tu progreso registrado')}
      trailing={<IonButton fill="clear" onClick={() => navigate('prof')}>{t('Volver')}</IonButton>} />
    <IonSegment className="avatar-view-tabs" value={view} aria-label={t('Vista del avatar')}
      onIonChange={e => { if (e.detail.value === 'appearance' || e.detail.value === 'evolution') setView(e.detail.value); }}>
      <IonSegmentButton value="appearance"><IonLabel>{t('Mi Avatar')}</IonLabel></IonSegmentButton>
      <IonSegmentButton value="evolution"><IonLabel>{t('Mi evolución')}</IonLabel></IonSegmentButton>
    </IonSegment>
    <Scroll className="avatar-scroll">
      <div className="avatar-layout">
      <div className="avatar-preview">
      <div data-avatar-body-state={JSON.stringify(state)} data-avatar-data-state={dataPhase}
        data-avatar-history-ms={progress.historyMs}
        aria-busy={!dataError && (!weights || !metrics)}>
        {!weights && !dataError && <div className="avatar-status" role="status"><IonSpinner aria-hidden="true" />
          {customization.status === 'loading' || authLoading ? t('Cargando tu personalización…') : t('Consultando tu historial de peso…')}</div>}
        {customization.status === 'error' && <div role="alert"><p>{t('No se pudo cargar tu personalización.')}</p>
          <IonButton onClick={customization.retry}>{t('Reintentar personalización')}</IonButton></div>}
        {weights && avatar && <div hidden={dataError} data-avatar-load-state={metrics ? 'AVATAR_READY' : 'AVATAR_LOADING'}>
        <ViewerBoundary key={`${progress.owner}:${gender}:${attempt}`} fallback={<div role="alert">
          <p>{t('No se pudo mostrar tu avatar. Comprueba la conexión e inténtalo de nuevo.')}</p>
          <IonButton onClick={() => { setMetrics(null); setMorphs([]); setAttempt(a => a + 1); }}>{t('Reintentar')}</IonButton>
        </div>}>
          <Suspense fallback={<div role="status"><IonSpinner /> {t('Cargando avatar…')}</div>}>
            <Viewer gender={gender} weights={weights} equipment={avatar} viewpoint={viewpoint} viewRevision={viewRevision} playing={playing && !dataError} enteredAt={enteredAt} onReady={setMorphs} onMetrics={setMetrics} />
          </Suspense>
        </ViewerBoundary>
        </div>}
      </div>
      <div className="avatar-viewer-tools">
        <p style={{ fontSize: 12 }}>{t('Arrastra para girar; pellizca para acercar.')}</p>
        <div className="avatar-viewer-actions">
        <IonButton fill="clear" disabled={!morphs.length || dataError} onClick={() => { setViewpoint('front'); setViewRevision(r => r + 1); }}>{t('Ver de frente')}</IonButton>
        <IonButton fill="clear" disabled={!morphs.length || dataError} onClick={() => { setViewpoint('side'); setViewRevision(r => r + 1); }}>{t('Ver de perfil')}</IonButton>
        <IonButton disabled={!morphs.length || dataError || !weights} fill="outline" onClick={() => setPlaying(p => !p)}>
          {playing ? t('Pausar movimiento') : t('Reanudar movimiento')}
        </IonButton>
        </div>
      </div>
      <div>
        {Object.values(metrics?.equipment ?? {}).some(item => item.status === 'loading') && <p role="status"><IonSpinner /> {t('Cargando elementos del avatar…')}</p>}
        {Object.values(metrics?.equipment ?? {}).some(item => item.status === 'error') && <p role="alert">{t('No se pudo cargar un elemento. Quítalo y vuelve a seleccionarlo para reintentar.')}</p>}
      </div>
      </div>
      <div className="avatar-panel">
      <section hidden={view !== 'appearance'} aria-label={t('Personalización del avatar')}>
      {configuration && <AvatarCustomizer value={configuration} disabled={customization.saving || dataError} onChange={next => {
        if (next.gender !== gender) { setMetrics(null); setMorphs([]); }
        customization.change(next);
      }} />}
      {configuration && <div className="avatar-save" data-avatar-configuration={JSON.stringify(configuration)}>
        <IonButton expand="block" disabled={!customization.dirty || customization.saving || dataError} onClick={() => void customization.save()}>
          {customization.saving ? t('Guardando…') : customization.saveError ? t('Reintentar guardado') : t('Guardar avatar')}
        </IonButton>
        <p role={customization.saveError ? 'alert' : 'status'}>{customization.saveError
          ? t('No se pudo guardar. Tu selección se conserva; vuelve a intentarlo.')
          : customization.dirty ? t('Tienes cambios sin guardar.') : t('Personalización sincronizada.')}</p>
      </div>}
      </section>
      <IonCard><IonCardContent>
        <h2>{t('Tu cuerpo y tu progreso')}</h2>
        <p>{t('El estado corporal se calcula a partir de tu historial clínico. La personalización no cambia tus mediciones.')}</p>
        {view === 'appearance' && latest && progress.resolved && <p>{t('Último registro disponible')}: {formatDateForDisplay(latest.date)} · {latest.value} kg</p>}
        {weights && progress.status === 'loading' && !dataError && <div role="status"><IonSpinner /> {t('Consultando tu historial de peso…')}</div>}
        {!authLoading && progress.status === 'session-required' && <p role="status">{t('Inicia sesión con una cuenta real para consultar tu progreso. El acceso demo no contiene mediciones reales.')}</p>}
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
        </div>}
        {view === 'evolution' && progress.status !== 'session-required' && <>
          <IonButton fill="outline" disabled={progress.status === 'loading'} onClick={() => {
            setSelectedDate(null); progress.refresh();
          }}>{t('Actualizar historial')}</IonButton>
          <IonButton fill="outline" disabled={progress.status === 'loading'}
            onClick={() => setRecordOpen(true)}>{t('Registrar peso')}</IonButton>
        </>}
        {progress.status === 'error' && <IonButton fill="clear" onClick={() => progress.refresh()}>{t('Reintentar')}</IonButton>}
        {view === 'appearance' && <IonButton fill="clear" onClick={() => setView('evolution')}>{t('Ver mi evolución')}</IonButton>}
      </IonCardContent></IonCard>
      {view === 'evolution' && progress.status === 'ready' && reference && selected && latest && <>
      <IonCard>
        <IonCardContent>
          <h2>{t('Evolución del peso registrado')}</h2>
          <p>{t('Vista relativa a tu primer registro válido de los últimos 365 días. No es una simulación médica ni reproduce tu anatomía.')}</p>
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
      </div>
      </div>
      {metrics && <div hidden data-avatar-metrics={JSON.stringify(metrics)} />}
    </Scroll>
    {recordOpen && <WeightRecordModal onClose={() => setRecordOpen(false)} onSaved={() => {
      setSelectedDate(null); progress.refresh(); showToast(t('Peso guardado correctamente.'), 'ok');
    }} />}
  </Screen>;
}

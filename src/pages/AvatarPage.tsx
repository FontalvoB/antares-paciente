import { Component, lazy, Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { IonButton, IonCard, IonCardContent, IonRange, IonSpinner } from '@ionic/react';
import { PageHeader } from '../components/PageHeader';
import { Screen, Scroll } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { useT } from '../i18n/I18nContext';
import { changeMorph } from '../components/avatar/avatar-validation';
import type { AvatarMetrics, MorphInfo, MorphWeights } from '../components/avatar/avatar-validation';

const Viewer = lazy(() => import('../components/avatar/AvatarViewer').then(m => ({ default: m.AvatarViewer })));

class ViewerBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function AvatarPage() {
  const t = useT(), { navigate } = useApp();
  const [weights, setWeights] = useState<MorphWeights>({});
  const [morphs, setMorphs] = useState<MorphInfo[]>([]);
  const [metrics, setMetrics] = useState<AvatarMetrics | null>(null);
  const [playing, setPlaying] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const presets: [string, MorphWeights][] = [
    ['A · Base', {}], ['B · Mayor volumen', { BodyVolume: 1 }],
    ['C · Intermedio', { BodyVolume: 0.5 }], ['D · Menor volumen', { BodyLean: 1 }],
  ];
  return <Screen>
    <PageHeader title={t('Avatar · Validación')} sub={t('Prueba temporal del cuerpo masculino')}
      trailing={<IonButton fill="clear" onClick={() => navigate('prof')}>{t('Volver')}</IonButton>} />
    <Scroll>
      {/* Visor 3D específico del dominio; permanece visible al recorrer los sliders Ionic. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, padding: '0 16px 8px', background: 'var(--g0)' }}>
        <ViewerBoundary key={attempt} fallback={<div role="alert">
          <p>{t('No se pudo mostrar el avatar. Comprueba la conexión y WebGL.')}</p>
          <IonButton onClick={() => { setMetrics(null); setMorphs([]); setAttempt(a => a + 1); }}>{t('Reintentar')}</IonButton>
        </div>}>
          <Suspense fallback={<div role="status"><IonSpinner /> {t('Cargando avatar…')}</div>}>
            <Viewer weights={weights} playing={playing} onReady={setMorphs} onMetrics={setMetrics} />
          </Suspense>
        </ViewerBoundary>
      </div>
      <div style={{ padding: '0 16px' }}>
        <p style={{ fontSize: 12 }}>{t('Arrastra para girar; pellizca para acercar.')}</p>
        <IonButton disabled={!morphs.length} fill="outline" onClick={() => setPlaying(p => !p)}>
          {playing ? t('Pausar Idle') : t('Reproducir Idle')}
        </IonButton>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {presets.map(([label, values]) => <IonButton key={label} fill="outline" disabled={!morphs.length}
            onClick={() => setWeights(values)} style={{ minHeight: 44, fontSize: 11 }}>{t(label)}</IonButton>)}
        </div>
      </div>
      <IonCard>
        <IonCardContent>
          <h2>{t('Morph Targets · Prueba')}</h2>
          <p>{t('Rango 0–1. Volumen y reducción son alternativos. Los ajustes regionales se limitan al combinarse con volumen. Definición muscular desactiva volumen.')}</p>
          {morphs.map(({ name, min, max }) => <IonRange key={name} label={`${name} · ${(weights[name] ?? 0).toFixed(2)}`}
            labelPlacement="stacked" min={min} max={max} step={0.01} value={weights[name] ?? 0}
            aria-label={name} data-morph={name}
            onIonInput={e => { if (typeof e.detail.value === 'number') setWeights(w => changeMorph(w, name, Number(e.detail.value))); }} />)}
        </IonCardContent>
      </IonCard>
      <IonCard>
        <IonCardContent>
          <h2>{t('Rendimiento · Sesión actual')}</h2>
          {metrics ? <div data-avatar-metrics={JSON.stringify(metrics)} style={{ fontSize: 12, lineHeight: 1.8 }}>
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
  </Screen>;
}

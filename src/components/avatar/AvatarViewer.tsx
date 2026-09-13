import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AnimationMixer, Box3, LoopRepeat, Mesh, SkinnedMesh, Texture, Vector3 } from 'three';
import type { Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { IonSpinner } from '@ionic/react';
import { useT } from '../../i18n/I18nContext';
import { AVATAR_URL } from './avatar-validation';
import { approachBody } from './avatar-body-state';
import type { AvatarMetrics, MorphInfo, MorphWeights } from './avatar-validation';
import { AvatarEquipment } from './AvatarEquipment';
import { disposeAvatarAsset } from './avatar-resources';
import { equippedItems } from './avatar-equipment';
import type { AvatarEquipmentState } from './avatar-equipment';

export interface AvatarAsset {
  gltf: GLTF; meshes: SkinnedMesh[]; morphs: MorphInfo[];
  metrics: AvatarMetrics; started: number;
  equipment: Record<string, { id: string; status: 'loading' | 'ready' | 'error'; bytes: number; loadMs?: number }>;
}
interface Props {
  weights: MorphWeights; playing: boolean;
  enteredAt: number;
  equipment: AvatarEquipmentState;
  onReady: (morphs: MorphInfo[]) => void;
  onMetrics: (metrics: AvatarMetrics) => void;
}


function inspect(gltf: GLTF, bytes: number, started: number): AvatarAsset {
  const meshes: SkinnedMesh[] = [], materials = new Set<Material>(), textures = new Set<Texture>();
  const bones = new Set<string>();
  let triangles = 0;
  gltf.scene.traverse(object => {
    if (object instanceof SkinnedMesh) {
      meshes.push(object); object.skeleton.bones.forEach(b => bones.add(b.name));
    }
    if (object instanceof Mesh) {
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
    }
  });
  materials.forEach(m => Object.values(m).forEach(v => { if (v instanceof Texture) textures.add(v); }));
  const body = meshes.find(m => m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length);
  if (!body || body.userData.morph_range !== '0..1') throw new Error('Missing morph schema');
  if (!gltf.animations.some(a => a.name === 'Idle') || bones.size !== 51) throw new Error('Missing Idle or skeleton');
  const morphs = Object.keys(body.morphTargetDictionary!).map(name => ({ name, min: 0, max: 1 }));
  const height = new Box3().setFromObject(gltf.scene).getSize(new Vector3()).y;
  return { gltf, meshes, morphs, started, equipment: {}, metrics: {
    bytes, triangles, materials: materials.size, textures: textures.size, bones: bones.size, height,
    loadMs: performance.now() - started, firstFrameMs: 0, fps: 0, calls: 0,
    geometries: 0, gpuTextures: 0, idleTime: 0, loops: 0,
    rootPosition: [], headQuaternion: [], morphWeights: {},
  } };
}

function AvatarScene({ asset, weights, playing, onMetrics, onReady, enteredAt, equipment }: Props & { asset: AvatarAsset }) {
  const mixer = useRef<AnimationMixer | null>(null);
  const loops = useRef(0);
  const initialWeights = useRef(weights);
  const visualBody = useRef((weights.BodyVolume ?? 0) - (weights.BodyLean ?? 0));
  const reducedMotion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reducedMotion.current = media.matches; };
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const sample = useRef({ start: performance.now(), frames: 0, first: true });
  useEffect(() => { sample.current.start = performance.now(); sample.current.frames = 0; }, [playing]);
  useLayoutEffect(() => {
    // La escena nunca dibuja la versión neutral antes de aplicar el estado inicial.
    asset.meshes.forEach(mesh => {
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
        mesh.morphTargetInfluences![index] = initialWeights.current[name] ?? 0;
      }
    });
    const instance = new AnimationMixer(asset.gltf.scene);
    const clip = asset.gltf.animations.find(a => a.name === 'Idle')!.clone();
    // El exportador empieza en 1/30 s; normalizar el clip a cero en memoria.
    const offset = Math.min(...clip.tracks.map(track => track.times[0]));
    clip.tracks.forEach(track => track.shift(-offset)); clip.resetDuration();
    instance.clipAction(clip).setLoop(LoopRepeat, Infinity).play();
    instance.update(0);
    const looped = () => { loops.current++; };
    instance.addEventListener('loop', looped); mixer.current = instance;
    return () => {
      instance.removeEventListener('loop', looped);
      instance.stopAllAction(); instance.uncacheRoot(asset.gltf.scene); mixer.current = null;
    };
    // Los cambios posteriores de pesos se interpolan en useFrame, sin reiniciar Idle.
  }, [asset]);
  useFrame(({ gl, scene, camera }, delta) => {
    if (!mixer.current) return;
    const target = (weights.BodyVolume ?? 0) - (weights.BodyLean ?? 0);
    visualBody.current = reducedMotion.current ? target : approachBody(visualBody.current, target, delta);
    asset.meshes.forEach(mesh => {
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
        mesh.morphTargetInfluences![index] = name === 'BodyVolume' ? Math.max(0, visualBody.current)
          : name === 'BodyLean' ? Math.max(0, -visualBody.current) : weights[name] ?? 0;
      }
    });
    if (playing) mixer.current?.update(Math.min(delta, 0.1));
    gl.render(scene, camera);
    const now = performance.now(), s = sample.current;
    const first = s.first;
    if (first) {
      asset.metrics.firstFrameMs = now - asset.started;
      asset.metrics.visibleMs = now - enteredAt;
      asset.metrics.initialMorphWeights = Object.fromEntries(Object.entries(asset.meshes[0].morphTargetDictionary ?? {})
        .map(([name, index]) => [name, asset.meshes[0].morphTargetInfluences![index]]));
      s.first = false; s.start = now; onReady(asset.morphs);
    }
    s.frames++;
    if (first || now - s.start >= 1000) {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const materials = new Set<Material>();
      let triangles = 0;
      for (const mesh of asset.meshes) {
        triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
      }
      onMetrics({ ...asset.metrics, fps: first ? 0 : s.frames * 1000 / (now - s.start), calls: gl.info.render.calls,
        triangles, materials: materials.size,
        bytes: asset.metrics.bytes + Object.values(asset.equipment).reduce((sum, item) => sum + item.bytes, 0),
        equipment: { ...asset.equipment },
        geometries: gl.info.memory.geometries, gpuTextures: gl.info.memory.textures,
        heapMB: memory ? memory.usedJSHeapSize / 1048576 : undefined,
        idleTime: mixer.current?.time ?? 0, loops: loops.current,
        rootPosition: asset.gltf.scene.getObjectByName('Hips')!.position.toArray(),
        headQuaternion: asset.gltf.scene.getObjectByName('Head')!.quaternion.toArray(),
        morphWeights: Object.fromEntries(Object.entries(asset.meshes[0].morphTargetDictionary ?? {})
          .map(([name, index]) => [name, asset.meshes[0].morphTargetInfluences![index]])),
      });
      s.start = now; s.frames = 0;
    }
  }, 1);
  return <>
    <hemisphereLight args={['white', 'gray', 1.6]} />
    <directionalLight position={[-2, 3, -4]} intensity={2.4} />
    <directionalLight position={[2, 2, 1]} intensity={1.2} />
    <primitive object={asset.gltf.scene} dispose={null} />
    {equippedItems(equipment).map(item => <AvatarEquipment key={item.slot} item={item} asset={asset} />)}
    <OrbitControls target={[0, 0.88, 0]} enablePan={false} minDistance={2.1} maxDistance={4.5}
      minPolarAngle={0.5} maxPolarAngle={2.2} />
  </>;
}

export function AvatarViewer(props: Props) {
  const t = useT();
  const [asset, setAsset] = useState<AvatarAsset | null>(null);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let inView = true;
    const sync = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); });
    if (host.current) observer.observe(host.current);
    document.addEventListener('visibilitychange', sync);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false, owned: GLTF | undefined;
    const started = performance.now();
    void (async () => {
      try {
        const response = await fetch(AVATAR_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`GLB ${response.status}`);
        const bytes = await response.arrayBuffer();
        const gltf = await new GLTFLoader().parseAsync(bytes, '');
        if (disposed) { disposeAvatarAsset(gltf); return; }
        owned = gltf;
        const inspected = inspect(gltf, bytes.byteLength, started);
        setAsset(inspected);
      } catch (e) {
        if (!disposed) { console.error('Avatar load:', e); setError(true); }
      }
    })();
    return () => { disposed = true; controller.abort(); if (owned) disposeAvatarAsset(owned); };
  }, []);
  if (error) throw new Error('Avatar loading failed');
  return <div ref={host} style={{ height: 'clamp(180px, 40vh, 360px)', background: 'var(--g1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
    {!asset ? <div role="status" style={{ padding: 24 }}><IonSpinner /> {t('Cargando avatar…')}</div> :
      <Canvas camera={{ position: [0, 0.95, -3.1], fov: 38, near: 0.05, far: 20 }}
        dpr={[1, 1.5]} frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setError(true), { once: true }); }}
        fallback={<p role="alert">{t('WebGL no está disponible en este dispositivo.')}</p>}>
        <AvatarScene {...props} asset={asset} playing={props.playing && visible} />
      </Canvas>}
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AnimationMixer, Box3, LoopRepeat, Mesh, SkinnedMesh, Texture, Vector3 } from 'three';
import type { Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { IonSpinner } from '@ionic/react';
import { useT } from '../../i18n/I18nContext';
import { AVATAR_URL } from './avatar-validation';
import type { AvatarMetrics, MorphInfo, MorphWeights } from './avatar-validation';

interface Asset {
  gltf: GLTF; meshes: SkinnedMesh[]; morphs: MorphInfo[];
  metrics: AvatarMetrics; started: number;
}
interface Props {
  weights: MorphWeights; playing: boolean;
  onReady: (morphs: MorphInfo[]) => void;
  onMetrics: (metrics: AvatarMetrics) => void;
}

function disposeAsset(gltf: GLTF) {
  const materials = new Set<Material>(), textures = new Set<Texture>();
  gltf.scene.traverse(object => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
    }
    if (object instanceof SkinnedMesh) object.skeleton.dispose();
  });
  materials.forEach(m => {
    Object.values(m).forEach(v => { if (v instanceof Texture) textures.add(v); });
    m.dispose();
  });
  textures.forEach(texture => {
    texture.dispose();
    const bitmap = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap) bitmap.close();
  });
}

function inspect(gltf: GLTF, bytes: number, started: number): Asset {
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
  return { gltf, meshes, morphs, started, metrics: {
    bytes, triangles, materials: materials.size, textures: textures.size, bones: bones.size, height,
    loadMs: performance.now() - started, firstFrameMs: 0, fps: 0, calls: 0,
    geometries: 0, gpuTextures: 0, idleTime: 0, loops: 0,
    rootPosition: [], headQuaternion: [], morphWeights: {},
  } };
}

function AvatarScene({ asset, weights, playing, onMetrics }: Props & { asset: Asset }) {
  const mixer = useRef<AnimationMixer | null>(null);
  const loops = useRef(0);
  const sample = useRef({ start: performance.now(), frames: 0, first: true });
  useEffect(() => { sample.current.start = performance.now(); sample.current.frames = 0; }, [playing]);
  useEffect(() => {
    const instance = new AnimationMixer(asset.gltf.scene);
    const clip = asset.gltf.animations.find(a => a.name === 'Idle')!.clone();
    // El exportador empieza en 1/30 s; normalizar el clip a cero en memoria.
    const offset = Math.min(...clip.tracks.map(track => track.times[0]));
    clip.tracks.forEach(track => track.shift(-offset)); clip.resetDuration();
    instance.clipAction(clip).setLoop(LoopRepeat, Infinity).play();
    const looped = () => { loops.current++; };
    instance.addEventListener('loop', looped); mixer.current = instance;
    return () => {
      instance.removeEventListener('loop', looped);
      instance.stopAllAction(); instance.uncacheRoot(asset.gltf.scene); mixer.current = null;
    };
  }, [asset]);
  useEffect(() => {
    asset.meshes.forEach(mesh => {
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
        mesh.morphTargetInfluences![index] = weights[name] ?? 0;
      }
    });
  }, [asset, weights]);
  useFrame(({ gl, scene, camera }, delta) => {
    if (playing) mixer.current?.update(Math.min(delta, 0.1));
    gl.render(scene, camera);
    const now = performance.now(), s = sample.current;
    if (s.first) { asset.metrics.firstFrameMs = now - asset.started; s.first = false; s.start = now; }
    s.frames++;
    if (now - s.start >= 1000) {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      onMetrics({ ...asset.metrics, fps: s.frames * 1000 / (now - s.start), calls: gl.info.render.calls,
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
    <OrbitControls target={[0, 0.88, 0]} enablePan={false} minDistance={2.1} maxDistance={4.5}
      minPolarAngle={0.5} maxPolarAngle={2.2} />
  </>;
}

export function AvatarViewer(props: Props) {
  const t = useT();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const host = useRef<HTMLDivElement>(null);
  const { onReady } = props;
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
        if (disposed) { disposeAsset(gltf); return; }
        owned = gltf;
        const inspected = inspect(gltf, bytes.byteLength, started);
        setAsset(inspected); onReady(inspected.morphs);
      } catch (e) {
        if (!disposed) { console.error('Avatar load:', e); setError(true); }
      }
    })();
    return () => { disposed = true; controller.abort(); if (owned) disposeAsset(owned); };
  }, [onReady]);
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

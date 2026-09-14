import { useEffect } from 'react';
import { Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { EquipmentItem } from './avatar-equipment';
import type { AvatarAsset } from './AvatarViewer';
import { disposeAvatarAsset } from './avatar-resources';

/** Cada módulo se enlaza a los huesos vivos del cuerpo; no crea otro mixer. */
export function AvatarEquipment({ item, asset }: { item: EquipmentItem; asset: AvatarAsset }) {
  useEffect(() => {
    const started = performance.now();
    const controller = new AbortController();
    let disposed = false, owned: GLTF | undefined;
    const meshes: SkinnedMesh[] = [];
    asset.equipment[item.slot] = { id: item.id, status: 'loading', bytes: 0 };
    void (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}models/avatar/${item.path}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Equipment ${response.status}`);
        const bytes = await response.arrayBuffer();
        const gltf = await new GLTFLoader().parseAsync(bytes, '');
        if (disposed) { disposeAvatarAsset(gltf); return; }
        owned = gltf; gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse(o => { if (o instanceof SkinnedMesh) meshes.push(o); });
        if (!meshes.length) throw new Error('Equipment missing canonical skin');
        const canonical = asset.meshes[0].skeleton.bones;
        const group = new Group(); group.name = `Equipment_${item.slot}`;
        // Validar el módulo completo antes de transferir ninguna malla.
        for (const mesh of meshes) for (const bone of mesh.skeleton.bones) {
          if (!canonical.some(candidate => candidate.name === bone.name)) throw new Error(`Unknown bone ${bone.name}`);
        }
        for (const mesh of meshes) {
          const bones = mesh.skeleton.bones.map(b => {
            const match = canonical.find(candidate => candidate.name === b.name);
            if (!match) throw new Error(`Unknown bone ${b.name}`);
            return match;
          });
          const sourceSkeleton = mesh.skeleton;
          const bound = new Skeleton(bones, sourceSkeleton.boneInverses.map(m => m.clone()));
          group.attach(mesh); mesh.bind(bound, mesh.bindMatrix); sourceSkeleton.dispose();
          mesh.frustumCulled = false;
          for (const [name, index] of Object.entries(mesh.morphTargetDictionary ?? {})) {
            const source = asset.meshes[0], sourceIndex = source.morphTargetDictionary?.[name];
            mesh.morphTargetInfluences![index] = sourceIndex === undefined ? 0 : source.morphTargetInfluences![sourceIndex];
          }
          if (item.color) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            if (m instanceof MeshStandardMaterial) m.color.set(item.color);
          }
        }
        gltf.scene = group;
        asset.gltf.scene.add(group); asset.meshes.push(...meshes);
        asset.equipment[item.slot] = { id: item.id, status: 'ready', bytes: bytes.byteLength, loadMs: performance.now() - started };
      } catch (error) {
        if (!disposed) {
          console.error('Avatar equipment:', error);
          asset.equipment[item.slot] = { id: item.id, status: 'error', bytes: 0 };
        }
      }
    })();
    return () => {
      disposed = true; controller.abort();
      if (owned) { asset.gltf.scene.remove(owned.scene); disposeAvatarAsset(owned); }
      asset.meshes = asset.meshes.filter(mesh => !meshes.includes(mesh));
      delete asset.equipment[item.slot];
    };
  }, [asset, item]);
  return null;
}

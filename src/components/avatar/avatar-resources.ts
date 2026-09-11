import { Mesh, SkinnedMesh, Texture } from 'three';
import type { Material } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

export function disposeAvatarAsset(gltf: GLTF) {
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


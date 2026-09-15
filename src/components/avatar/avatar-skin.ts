import { MeshStandardMaterial, Vector3 } from 'three';
import type { SkinnedMesh } from 'three';

import { skinCatalog } from './avatar-skin-catalog';
import type { SkinId } from './avatar-skin-catalog';

/** Solo materiales del GLB corporal, antes de añadir prendas. Reutiliza todos los mapas PBR. */
export function prepareSkin(meshes: SkinnedMesh[]) {
  const tint = { value: new Vector3(1, 1, 1) };
  const materials = new Set(meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
  for (const material of materials) {
    if (!(material instanceof MeshStandardMaterial)) continue;
    material.onBeforeCompile = shader => {
      shader.uniforms.avatarSkinTint = tint;
      shader.fragmentShader = 'uniform vec3 avatarSkinTint;\n' + shader.fragmentShader;
      // El atlas incluye zonas no cutáneas: conservar neutros, negros y blancos.
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec3 skinSample = diffuseColor.rgb;
        float skinWarmth = (skinSample.r - skinSample.b) / max(skinSample.r, 0.001);
        float skinMask = smoothstep(0.16, 0.38, skinWarmth)
          * smoothstep(0.025, 0.09, skinSample.r)
          * (1.0 - smoothstep(0.80, 0.98, min(skinSample.r, min(skinSample.g, skinSample.b))));
        diffuseColor.rgb *= mix(vec3(1.0), avatarSkinTint, skinMask);
      `);
    };
    material.customProgramCacheKey = () => 'avatar-skin-v1';
    material.needsUpdate = true;
  }
  return (id: SkinId) => {
    const tone = skinCatalog.find(item => item.id === id) ?? skinCatalog[2];
    tint.value.set(tone.factor[0], tone.factor[1], tone.factor[2]);
  };
}

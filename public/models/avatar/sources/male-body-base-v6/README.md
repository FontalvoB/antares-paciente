# Male body v6 — espejo aprobado + Idle

Base: pose derecha y mano aprobadas en hand-image-static-review/hand-reference-review.blend, sobre malla/rig originales v3. Idle recuperado del editable v5. No se modificaron versiones anteriores ni código de app.

Espejo estático: hombro, brazo, antebrazo, muñeca, mano, dedos y pulgar izquierdos reflejados desde el derecho aprobado. Diferencia en el derecho: 0. Error máximo de matrices espejo: 2.384e-7. Sin nuevas correcciones de mano/pulgar.

Idle: 8 segundos, 30 FPS, 241 muestras con extremo duplicado. Conserva curvas de respiración/torso de v5 y reduce amplitudes de brazos/manos alrededor de la pose aprobada. Frame 1 coincide exactamente con la referencia derecha. Oscilación lateral pico a pico de muñecas: izquierda 5.78 mm, derecha 5.50 mm. Antebrazos a menos de 3.4 grados de vertical; codos al menos 4.1 cm detrás de los hombros durante todo el ciclo. Pies fijos, sin root motion, seam evaluada 0. No se agregó una nueva transferencia de peso a las piernas: se conservó el comportamiento del Idle recuperado.

Datos estáticos GLB preservados byte a byte desde v5: malla, skin/51 huesos, materiales, texturas, morphs. Solo se sustituyó Idle; RigCheck conservado. 23,924 triángulos, 1 material, 3 texturas y 9 morphs originales. Reimportación: 20 muestras, error máximo 0.00243 mm.

LIMITACIÓN CONSERVADA: la pose aprobada presenta contacto/intersección mano-muslo. La revisión regional BVH detecta contacto en 123/241 frames base, 241/241 intermedio, 241/241 volumen máximo y 0/241 menor volumen. Los morphs funcionan, pero no se certifica ausencia de clipping. No se modificó la mano aprobada para eliminarlo. Se conserva también el pequeño artefacto de silueta del codo previamente aprobado. No debe presentarse esta versión como corrección de skinning.

Archivos: bodies/male-body-base-v6.glb (4,654,836 bytes); sources/male-body-base-v6/male-body-base-v6.blend; animations/idle-v6.glb. No se cambió el alias idle.glb ni el asset configurado en el visor de la app.

Revisión visual: static-front.png, static-profile.png, static-three-quarter.png, idle-frame61.png, idle-frame181-volume.png. Métricas y validaciones: symmetry.json, posture-cycle.json, audit-*.json, export-audit.json, roundtrip.json. RigCheck usa quaternion en Blender, Idle Euler XYZ; el GLB reproduce ambas normalmente.

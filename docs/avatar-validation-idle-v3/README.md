# Idle v3 — animación más viva sobre el cuerpo existente

2026-09-10. Alcance exclusivo: nueva Action Idle, exportación versionada y cambio de URL del asset en el visor existente. No se generó otro modelo ni se instalaron dependencias.

## Entrega

- `public/models/avatar/bodies/male-body-base-v3.glb` (4.059.596 bytes).
- `public/models/avatar/sources/male-body-base-v3/male-body-base-v3.blend` (Action Idle editable y RigCheck técnico).
- `public/models/avatar/animations/idle-v3.glb` y `idle.glb`: nuevo clip separado (216.284 bytes).
- `animations/idle-v2.glb`: copia exacta del clip anterior. El cuerpo GLB v2 y su .blend permanecen intactos; hashes comprobados.
- [Vídeo del canvas real](idle-preview.webm), [captura móvil](mobile-base.png), [baseline](baseline.json).

## Movimiento

8 segundos, 30 FPS, frames 1–241 con último frame duplicado para cerrar el ciclo. Dos respiraciones lentas por ciclo: expansión animada local del pecho (hasta 1,2 % lateral, 2,5 % profundidad) y flexión leve de torso. El skeleton de reposo y las escalas de bind no cambian.

Balanceo lateral del torso con sensación de transferencia de peso sobre pies fijos, micro movimiento de hombros, variaciones lentas y desfasadas de brazos/codos, muñecas y dedos. Las manos tienen una flexión leve de reposo más apertura/cierre pequeño y distinto por dedo y lado. Cuello y cabeza añaden giro e inclinación suaves. No se añadió sistema de ojos. Piernas y Hips mantienen sus transformaciones: la transferencia se expresa mediante el torso, sin pasos, cambios del rig ni root motion.

Comparación de recorrido lateral de extremos de huesos en Blender: mano izquierda 5,6 → 45,1 mm, derecha 10,6 → 49,5 mm; Chest 0,9 → 10,3 mm. Son recorridos durante el ciclo, no desplazamientos por frame. La articulación de dedos tiene claves propias y ya no depende exclusivamente del movimiento heredado de los brazos.

## Preservación y validación

- Malla, índices, POSITION, NORMAL, TEXCOORD_0, TANGENT, JOINTS_0 y WEIGHTS_0 iguales entre GLB v2 y v3. El exportador recalculó algunas tangentes con diferencias de redondeo ~1e-4; se restituyeron los bytes originales porque posiciones, normales y UV no cambiaron.
- Nueve targets POSITION/NORMAL, matrices de bind, nombres/jerarquía/transformaciones de bones, materiales y bytes de imágenes idénticos. Misma altura 1,70 m, 23.924 triángulos, 51 huesos, un material y tres imágenes.
- Se revisaron 241 frames × cuatro cuerpos (base, mayor volumen, intermedio y menor volumen): 964 comprobaciones, sin intersecciones detectadas.
- Unión: diferencia de posiciones de vértices primer/último frame = 0. Tangentes de las curvas coincidentes en los extremos; sin salto ni acumulación. Diferencia máxima de velocidades discretas adyacentes a la unión: 0,0446 mm/frame, correspondiente a la curvatura del movimiento.
- Deriva de vértices de los pies = 0; altura mínima numérica −0,0000000297 m. Root fijo en Blender y runtime.
- GLB reimportado comparado en 20 muestras (cuatro cuerpos × cinco tiempos): error máximo 0,001899 mm respecto al .blend.
- Prueba real en Chrome: Idle automático y loop, pausa/reproducción, Head animado/Hips fijo, cuatro estados visibles, nueve sliders con cambio renderizado, salida/reentrada y recuperación tras fallo de descarga.
- `npm run build` pasó. No hubo cambios funcionales de UI, motor, arquitectura, backend ni admin.

Los detalles numéricos de Blender se guardan en `public/models/avatar/sources/male-body-base-v3/validation-blender.json`, `roundtrip.json` y `motion-comparison.json`. La auditoría extensa superó el timeout del Bridge; se comprobó su finalización antes de continuar, sin repetirla.

## Comparación de coste

| Métrica | v2 | v3 |
|---|---:|---:|
| Duración | 5 s | 8 s |
| Frecuencia de animación | 30 FPS | 30 FPS |
| GLB cuerpo | 3.921.396 bytes | 4.059.596 bytes (+3,52 %) |
| Claves escalares editables Blender | 1.875 | 3.999 |
| Muestras sumadas de samplers glTF | 1.945 | 10.583 |
| Canales glTF | 153 | 153 |
| FPS estable Chrome | ~60 | ~60 |
| Draw calls | 1 | 1 |
| Carga/análisis GLB local | 115 ms | 145 ms |
| Primer frame desde inicio de carga | 460 ms | 546 ms |

Los samplers glTF contienen más muestras por el bake a 30 FPS de las nuevas rotaciones de brazos/manos/dedos y la mayor duración. El aumento del GLB completo es 138.200 bytes. No se hizo compresión agresiva.

Chrome 152.0.7977.83 en Windows, localhost Vite, emulación 390×844 DPR1,5. Las muestras estables v3 estuvieron entre 59,994 y 60,016 FPS; escritorio 59,994 FPS. El primer segundo de arranque registró 48,8 FPS. Heap JS de toda la página en muestras estables: 95,2–99,0 MiB. No se midió memoria GPU en bytes; no son mediciones de un teléfono físico ni una comparación estadística controlada.

## Cambios de código de esta tarea

- `src/components/avatar/avatar-validation.ts`: URL de v2 a v3.
- `src/components/avatar/AvatarViewer.tsx`: comentario de normalización temporal actualizado; comportamiento intacto.
- `scripts/avatar-smoke.mjs`: espera compatible con loop de ocho segundos, carpeta de evidencias configurable, grabación opcional del canvas y prueba de fallo de descarga independiente de la versión.

Reproducir la prueba: establecer `AVATAR_TEST_OUTPUT=avatar-validation-idle-v3`, `AVATAR_RECORD=1` y `AVATAR_TEST_URL` con el servidor local; ejecutar `node scripts/avatar-smoke.mjs`. Los resultados anteriores en docs/avatar-validation se conservan.

## Siguiente tarea recomendada

Revisión perceptual del nuevo Idle en Android/iOS físicos: comodidad visual, movimientos de dedos en pantalla pequeña, loop, carga y rendimiento térmico. No se requiere añadir funcionalidades ni rehacer el avatar para esa validación.

# Avatar modular — Fases 6 a 10

Resultado validado el 11 de septiembre de 2026. Implementación secuencial sobre el v7 que cargaba la aplicación. Este informe es histórico. El catálogo activo está documentado en [Pulido v9](avatar-polish-v9.md); v8 y módulos v2 se conservan como referencia de recuperación y comparación.

## Fase 6 — Primera camiseta

Una camiseta de manga corta independiente, construida en Blender mediante Higgsfield Bridge. Transferencia baricéntrica de los pesos y los nueve Shape Keys del cuerpo; holgura y costuras modeladas. No se generó otro personaje ni se consumieron generaciones de pago.

La primera exportación fue `clothing/tops/male-shirt-basic-01.glb`; se conserva junto a su Blender. Se verificaron frontal, perfil, 3/4, cuerpo base, volumen máximo, intermedio y BodyLean, en cinco momentos de Idle. Se corrigieron penetraciones en axilas mediante la inversa del skinning. Después de la fase 10, la aplicación utiliza su revisión `male-shirt-basic-01-v2.glb`.

## Fase 7 — Sistema de ropa

`avatar-equipment.ts` define un catálogo pequeño y el estado:

```ts
{
  clothing: { shirt: null, pants: null, shoes: null },
  hair: null,
  accessories: { glasses: null, watch: null, bracelet: null }
}
```

Los slots pants/shoes quedan vacíos. `AvatarEquipment` carga módulos GLB y enlaza sus mallas a los huesos vivos del cuerpo, comprobando sus nombres. Los archivos contienen la tabla canónica de skin; en ejecución se descartan los rigs importados y se reutilizan los huesos del avatar. No hay otro AnimationMixer ni skeleton animado independiente.

El mismo frame aplica BodyState a cuerpo y módulos. Se inicializan los morphs de una pieza antes de mostrarla. Equipar, quitar y cambiar camiseta conserva canvas, estado corporal e Idle. Hay dos colores de la misma camiseta, sin duplicar geometría. El estado se mantiene mientras la página está montada y durante las consultas/cambios corporales; no persiste al recargar ni en backend.

Los controles Ionic temporales están en `AvatarPage`, tarjeta **Prueba de ropa**, debajo del visor y de Pausar Idle. No se construyó el editor final.

## Fase 8 — Cabello

En esta fase se crearon tres estilos: corto, peinado lateral y rizado. El corto fue retirado posteriormente y ya no está disponible. Geometría y color de vértices, sin nuevas imágenes de textura. Anclaje a Head y morphs para el ajuste. Se validaron cambios de estilo con camiseta e Idle. La fase 10 conserva los estilos y añade revisiones v2 para corregir pequeños contactos de BodyVolume/BodyLean; las primeras exportaciones se revisaron en la limpieza posterior.

## Fase 9 — Accesorios

- Gafas: montura oscura y lentes transparentes, Head.
- Reloj deportivo: correa, caja, esfera e indicadores, LeftForeArm.
- Pulsera sencilla: correa y cierre, RightForeArm.

La inspección de cerca detectó gafas demasiado altas y las pruebas de morphs detectaron correas atravesando muñecas. Se corrigieron antes de exportar. Cada slot se equipa/quita independientemente y convive con ropa/cabello. La combinación completa reproduce Idle; los archivos de accesorios se reutilizan sin cambios con v8.

## Fase 10 — Realismo corporal

El BodyVolume anterior concentraba el desplazamiento medio en abdomen (~49 mm), frente a ~11 mm en pecho y ~15 mm en muslos. La revisión distribuye más volumen por tórax, espalda, caderas, brazos y muslos, suaviza el relieve muscular y añade variaciones pequeñas en cuello/mandíbula. Se conserva el material existente; no se retocaron sus texturas.

Solo se modificó **BodyVolume** en una copia del cuerpo. Basis, topología, UV, pesos, skeleton, materiales y los otros ocho morphs siguen intactos: BodyLean, Abdomen, Waist, Chest, Arms, Thighs, FaceVolume y MuscleDefinition. No se cambió la fórmula de progreso. Esa fórmula aplica un eje firmado volumen/reducción y mantiene MuscleDefinition en cero; no mezcla arbitrariamente máximos de morphs regionales con volumen máximo.

Se revisó la progresión 0/.33/.66/1 y las vistas frontal/perfil/3/4. La camiseta se readaptó, incluyendo interpolaciones .25/.5/.75, porque ajustar solamente extremos dejaba clipping intermedio. Los cabellos se readaptaron con cambios pequeños de ajuste.

La exportación v8 reemplaza únicamente las posiciones/normales de BodyVolume, mapeadas desde Blender con error de correspondencia **0 m**. El GLB original usa morphs sparse: se añadieron dos vistas densas, manteniendo los demás datos binarios originales. Esto añade ~352 KB. Los datos de Idle, RigCheck, skinning, skeleton, materiales, imágenes y demás morphs son literalmente idénticos a v7. Los nombres internos heredados del GLB se conservan; la versión se identifica por ruta y `asset.extras.bodyVersion`.

La variación es artística y progresiva. No representa diagnósticos ni una equivalencia exacta entre peso, grasa, músculo o distribución anatómica.

## Assets finales

Rutas relativas a `public/models/avatar/`. MB decimales; un solo cabello se equipa a la vez.

| Archivo | Bytes | Triángulos | Materiales | Texturas de imagen |
|---|---:|---:|---:|---:|
| `bodies/male-body-base-v8.glb` | 5.312.372 | 23.924 | 1 | 3 |
| `clothing/tops/male-shirt-basic-01-v2.glb` | 1.631.704 | 10.770 | 2 | 0 |
| Estilo corto retirado en pulido v9 (export eliminado) | 179.020 | 949 | 1 | 0 |
| `hair/male-hair-02-v2.glb` | 606.056 | 3.796 | 1 | 0 |
| `hair/male-hair-03-v2.glb` | 606.052 | 3.796 | 1 | 0 |
| `accessories/glasses/unisex-glasses-01.glb` | 169.100 | 960 | 2 | 0 |
| `accessories/watches/unisex-watch-01.glb` | 287.836 | 1.582 | 4 | 0 |
| `accessories/bracelets/unisex-bracelet-01.glb` | 211.720 | 1.262 | 2 | 0 |

Todo el catálogo final suma 9.003.860 bytes. Cuerpo + camiseta + Hair03 + tres accesorios: **8.218.784 bytes, 42.294 triángulos, 12 materiales**. Las matrices inverse bind coinciden exactamente con el cuerpo en todos los módulos (51 huesos, diferencia máxima 0).

Fuentes editables:

- `sources/male-body-base-v8/male-body-base-v8.blend`: escena actual con cuerpo y módulos; Idle activa, 30 FPS.
- `sources/modular-v1/male-shirt-basic-01-v2.blend`.
- `sources/modular-v1/male-hair-01-v2.blend`, `male-hair-02-v2.blend`, `male-hair-03-v2.blend`.
- `sources/modular-v1/unisex-glasses-01.blend`, `unisex-watch-01.blend`, `unisex-bracelet-01.blend`.
- En la misma carpeta: checkpoint previo, primeras versiones, scripts de construcción/ajuste/exportación y `SCENE-PASSPORT.md`.

Los Blender son escenas editables con contexto y revisiones ocultas; para exportar módulos, seleccionar solo pieza y rig. Los GLB anteriores no se sobrescribieron. SHA-256 v7 conservado: `0831e32148297cf8f8e934a1249e230e40d6169279252dcee1ef64e9011d894d`.

## Validación y rendimiento

- `scripts/avatar-modular-assets-check.mjs`: integridad binaria, schema de nueve morphs, 51 huesos, bind matrices y clips; pasa. Idle **12 s**, RigCheck **2 s**; diferencia entre extremos del loop **0**. RigCheck sigue técnico. No se añadió animación ni desplazamiento acumulado.
- `blender-final.json`: Basis, polígonos, pesos, otros morphs y materiales sin cambios; Idle activa, 30 FPS.
- Camiseta v8: **30 muestras**, penetración residual máxima **0,60 mm**; ningún vértice >2 mm.
- Cabellos finales: **75 muestras**, residual máximo **1,77 mm**; ningún vértice >2 mm.
- Accesorios con v8: **75 muestras**, separación mínima **1,22 mm**; ningún vértice >2 mm.
- Navegador: página/visor/Ionic/Three.js/GLB reales, sesión aislada y HTTP controlado. Sin escrituras en BD. Equipar, cambiar tres cabellos, cambiar camiseta, quitar, conservar canvas, cambiar registros por siete estados y dos loops completos. También vacío, error API, error GLB y reintentos. Pasa.
- En Edge headless de escritorio, viewport 430×1000, conjunto completo: **60,03–60,05 FPS**, **13 draw calls**, **12 geometrías**, heap JS observado **128–133 MiB**. Las 28 texturas contabilizadas por el renderer incluyen datos de bones/morphs; no equivalen a 28 imágenes ni a memoria GPU en bytes.
- Carga/parseo del cuerpo **175 ms**, primer frame **604 ms** desde inicio de carga. Módulos observados: camiseta 40 ms, Hair03 15 ms, gafas 23 ms, reloj 306 ms, pulsera 11 ms. Son muestras locales, no una medición de red móvil ni una suma de carga simultánea fría. El historial del test introduce 2,5 s deliberados; tiempo de entrada a primer frame observado 4,25 s.
- TypeScript + build Vite: pasan. 15 tests de progreso pasan. Lint sin errores ni avisos nuevos en avatar; hay avisos existentes en otros módulos. i18n: cero traducciones faltantes. Vite avisa del bundle de Three.js >500 KB; la dependencia existente también emite deprecación de THREE.Clock.

Evidencias: `docs/avatar-modular-validation/` contiene auditorías JSON, renders, capturas, logs y resultados por fase. El resultado final del navegador está en `final/after.json` y `final/combined-body-5.png`.

## Archivos de código de esta misión

Creados:
- `src/components/avatar/avatar-equipment.ts`.
- `src/components/avatar/AvatarEquipment.tsx`.
- `src/components/avatar/avatar-resources.ts` (liberación de recursos compartida).
- `scripts/avatar-modular-assets-check.mjs`.

Modificados:
- `src/pages/AvatarPage.tsx`: estado y selectores temporales.
- `src/components/avatar/AvatarViewer.tsx`: módulos y métricas.
- `src/components/avatar/avatar-validation.ts`: referencia v8 y tipos de métricas.
- `src/i18n/es.json`, `src/i18n/en.json`: etiquetas.
- `scripts/avatar-loading-check.mjs`: escenarios modulares y progresión.
- `LEARNINGS.md` de la raíz: notas del pipeline.

Se añadieron los assets, fuentes y evidencias indicados. El repositorio ya tenía cambios de fases anteriores; el diff global no representa únicamente esta misión. No se instalaron dependencias ni se modificaron backend, admin o lógica de progreso durante esta misión.

## Límites y siguiente paso

Es una base funcional de demostración, con cabello estilizado y tela de ajuste procedural. Hay pequeños contactos residuales medidos; no se afirma colisión perfecta. La auditoría de vértices/poses no es una prueba exhaustiva de intersección de superficies durante todo el tiempo ni de todas las combinaciones arbitrarias de los nueve morphs. No incluye simulación física de ropa ni prendas superpuestas.

No se midió en un teléfono físico. Siguiente tarea recomendada: validación visual y de rendimiento en Android/iOS reales, incluyendo sesiones prolongadas, y pulido artístico localizado de tela/cabello antes de ampliar el catálogo o construir el editor final.

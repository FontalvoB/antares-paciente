# Avatar — ronda de pulido v9

Catálogo activo desde el 14/09/2026. Sustituye las referencias de ejecución del informe histórico `avatar-modular-phases-6-10.md`. No se añadieron categorías, personajes, animaciones, dependencias ni cambios de backend, API o progreso.

## Assets activos

Rutas relativas a `public/models/avatar/`. Tamaños en bytes; se equipa un cabello a la vez.

| Asset | Triángulos antes → después | Bytes antes → después | Materiales finales |
|---|---:|---:|---:|
| `bodies/male-body-base-v9.glb` | 23.924 → 14.354 | 5.312.372 → 2.940.240 | 1 |
| `clothing/tops/male-shirt-basic-01-v3.glb` | 10.770 → 3.933 | 1.631.704 → 641.904 | 1 |
| `hair/male-hair-02-v3.glb` | 3.796 → 1.898 | 606.056 → 180.132 | 1 |
| `hair/male-hair-03-v3.glb` | 3.796 → 1.898 | 606.052 → 178.372 | 1 |
| `accessories/glasses/unisex-glasses-02.glb` | 960 → 527 | 169.100 → 69.344 | 2 |
| `accessories/watches/unisex-watch-02.glb` | 1.582 → 791 | 287.836 → 106.332 | 2 |
| `accessories/bracelets/unisex-bracelet-02.glb` | 1.262 → 503 | 211.720 → 64.732 | 1 |

Fuente editable autónoma: `public/models/avatar/sources/polish-v9/avatar-polished-v9.blend`. Contiene los siete módulos, rig compartido, las dos Actions, texturas empaquetadas y cámaras frontal/perfil/3/4. Hair02 queda oculto para no superponer ambos estilos. Se recuperó mediante importación de los GLB entregados, sin depender de objetos de una sesión anterior de Blender. Los scripts de construcción y recuperación están en la misma carpeta.

## Cambios visuales

El cuerpo conserva la silueta y los nueve nombres de morphs. La reducción usa transferencia baricéntrica de las deformaciones y preserva UV, materiales y pesos. Error de correspondencia con la superficie original: máximo 0,669 mm, media 0,130 mm. BodyVolume suaviza el relieve muscular regional y distribuye más volumen de torso; sigue siendo una representación artística, sin equivalencia médica.

La camiseta tiene cuello redondo reconstruido con banda fina, dobladillos de mangas e inferior, contraste sutil en los bordes mediante color de vértices y una superficie suavizada con holgura. No requiere simulación ni texturas nuevas. El detalle de costura es discreto y pierde visibilidad a la escala pequeña del visor móvil. Se rehicieron ajustes de volumen que inicialmente producían picos en las axilas; esos resultados intermedios fueron descartados.

Se conservan el peinado lateral y el rizado, con aproximadamente 28 mm adicionales de cobertura posterior y transición gradual. El corto desaparece del catálogo, traducciones y exports. Los accesorios conservan forma y anclaje; el reloj y la pulsera combinan superficies mediante color de vértices para reducir materiales. El cierre de la pulsera comparte ahora material y pierde algo de contraste metálico.

## Compatibilidad y pruebas

- Los siete GLB contienen los nueve targets: BodyVolume, BodyLean, Abdomen, Waist, Chest, Arms, Thighs, FaceVolume y MuscleDefinition.
- 51 huesos canónicos; matrices inverse bind idénticas entre cuerpo y módulos y respecto de v8.
- Idle de 12 segundos y RigCheck de 2 segundos: muestras de animación idénticas a v8; extremos del loop idénticos. No se generó otra animación. El pequeño balanceo local original permanece, sin desplazamiento acumulado.
- Camiseta: 65 muestras de ajuste, incluyendo BodyVolume 0/.25/.5/.75/1 y los demás morphs en varias fases. Residuo máximo medido 1,10 mm, ningún vértice penetra más de 2 mm. Cabellos/accesorios: 325 muestras, residuo máximo 1,79 mm, ninguno sobre 2 mm. Son muestras discretas, no una garantía matemática para todas las combinaciones simultáneas de nueve sliders.
- Reimportación de los GLB, renders de volumen y revisión visual frontal/3/4. Fuente editable reabierta y verificada por `validate-source.py`; resultados en `source-validation.json`.
- Prueba de página, visor, Ionic y GLB reales en Edge headless, viewport móvil y escritorio, con HTTP controlado: equipar/quitar/cambiar módulos, siete estados corporales, Idle, errores y reintentos. No hubo escrituras en BD. Evidencia en `avatar-polish-validation/browser/after.json` y capturas.
- TypeScript, build Vite y 15 tests de progreso pasan. Oxlint sin errores; persisten avisos ajenos al avatar. Se corrigieron dos comas faltantes preexistentes justo antes del bloque de traducciones del avatar: impedían arrancar Vite.

## Rendimiento observado

Conjunto cuerpo + camiseta + rizado + tres accesorios:

| Medida | Antes | Después |
|---|---:|---:|
| Triángulos | 42.294 | 22.006 (−48,0 %) |
| GLB total | 8.218.784 B | 4.000.924 B (−51,3 %) |
| Materiales | 12 | 8 |
| Draw calls | 13 | 9 |
| FPS | ~60 | 59,97–60,07 |
| Heap JS observado | 128–133 MiB | 99–112 MiB |

Cuerpo: carga/parseo 103,5 ms; primer frame 411,5 ms desde inicio de carga. Módulos: camiseta 13,2 ms, rizado 8,8 ms, gafas 17,9 ms, reloj 7,5 ms, pulsera 7,6 ms. El tiempo de entrada incluye 2,5 s deliberados de espera HTTP del test. Son muestras locales de escritorio, no mediciones en un teléfono ni una suma de carga fría simultánea. Tres imágenes corporales; el renderer contabiliza 20 texturas incluyendo buffers de morphs/huesos. No se dispone de memoria GPU exacta en bytes.

## Limpieza y conservación

Auditoría textual de código, configuración, rutas, catálogo, documentos, scripts y pruebas; inventario con SHA-256. Se abrieron 41 Blender/backups para inspeccionar rutas externas y propiedades de assets. No contienen dependencias externas GLB. Los resultados previos y el registro de borrado están en `avatar-polish-validation/`.

Eliminados tras comprobar referencias y hashes:

- `bodies/male-body-base-v5.glb`: export sin referencias; su fuente histórica permanece.
- `hair/male-hair-01.glb` y `hair/male-hair-01-v2.glb`: peinado corto retirado. La medición histórica se marca como retirada, sin ruta activa.
- `hair/male-hair-02.glb` y `hair/male-hair-03.glb`: primeras exportaciones sin referencias; fuentes y baseline v2 conservados.
- `sources/male-body-base-v4/male-body-base-v4.blend1`: idéntico por SHA-256 al checkpoint conservado en `side-pose-correction/before-male-body-base-v4.blend`.

Total de assets antiguos eliminado: 9.801.866 bytes. También se descartó el respaldo automático `sources/polish-v9/avatar-polished-v9.blend1` creado durante esta tarea con FPS de importación incorrectos (3.781.516 bytes); la fuente validada lo sustituye. No se borraron el resto de cuerpos, camisetas ni accesorios antiguos: aún sirven de baseline/reproducción, tienen referencias documentales o conservan fuentes históricas no redundantes. Mantenerlos satisface la regla de no borrar archivos referenciados o necesarios para recuperación; no forman parte del catálogo activo ni se descargan al mostrar el avatar.

## Archivos y límites

Cambios de aplicación limitados a `avatar-validation.ts`, `avatar-equipment.ts` y los dos JSON de idiomas. Tests actualizados: `avatar-loading-check.mjs`, `avatar-modular-assets-check.mjs`; nuevos scripts de transferencia exacta de clips y auditoría de referencias. Documentación histórica marcada como sustituida; GLB, fuente editable, scripts y evidencia nuevos en las rutas anteriores. El registro exacto de borrado contiene rutas, tamaños y hashes.

Problemas resueltos: pérdida de la escena de trabajo tras exportar (recuperada desde GLB), formas auxiliares de huesos confundidas inicialmente con mallas, importación a 24 FPS (recuperación corregida a 30 FPS desde el inicio), picos de ajuste en camiseta y comas JSON. Los renders intermedios con fallos son evidencia de proceso, no assets finales; revisar únicamente `delivered-*`, `body-final-*` y `browser/` para la entrega.

Límites pendientes: pueden persistir contactos submilimétricos/locales de tela; no se garantiza toda mezcla extrema de morphs. Las costuras son sutiles a tamaño móvil. Falta una medición en dispositivo físico; no se alteró la arquitectura para resolver el aviso existente de bundle grande de Three.js.

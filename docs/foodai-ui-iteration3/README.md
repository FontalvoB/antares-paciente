# Food AI — iteración 3

Continuación de `54840f0` en `feature/foodai-llm-vision`. Cambios de presentación; se conservan permisos, streams, servicios, contratos, campos y submit. Sin push.

## Diseño y movimiento

- Cámara inmersiva en cosmos: visor centrado, obturador de 60 px con gradiente de marca y acciones secundarias agrupadas. La privacidad queda junto a la decisión de captura.
- Foto nítida sobre su propio fondo desenfocado: conserva el encuadre completo sin bandas negras; scrim limitado al caption.
- Análisis con barrido de 2 s, marco que respira y tres pasos ilustrativos cada 1,2 s. No representan progreso real del servidor.
- Una spring compartida (`260 / 26`), salida con fade y escala, presión de captura a `.92`, flash de 120 ms, contador de kcal de 600 ms y stagger de 60 ms por alimento.
- Formulario reutilizado en registro y revisión: kcal de ancho completo, macros en 2×2, iconos Ionic, etiquetas completas de 12 px, referencia del plan en chip y guardar con gradiente. Placeholder `0`: ninguna aserción exigía `—`.
- Cabecera persistente con flecha y safe areas en todos los estados, incluido análisis y apertura de cámara. El registro manual usa `IonContent`, por lo que puede desplazarse con el teclado.
- Preferencia de movimiento reducido: transiciones de opacidad, valores finales inmediatos y ausencia de barrido, flash, pulsos y desplazamientos. Las animaciones propias usan transform/opacity/filter; el foco cambia de superficie y contorno mediante una capa de opacidad.

## Verificación

- `npm run lint`: cero errores; advertencias preexistentes, ninguna nueva.
- `npm test`: **142 archivos, 1.064 tests correctos**. Se amplía la comprobación de flecha y stepper durante análisis. Los mocks de Motion evitan las cancelaciones WAAPI no soportadas por happy-dom; las animaciones reales se comprueban en Chrome.
- `npm run build`: correcto.
- `npm run i18n:check`: cero claves faltantes. Cuatro claves nuevas presentes en ambos idiomas; claves huérfanas preexistentes.
- Componentes y modales Ionic reales en Chrome, datos de muestra y cámara web alimentada por un canvas. Matriz 320/390 × ES/EN: cámara, preview, análisis, revisión, edición, manual y foco. También detalle, apertura de cámara, escritorio 1440×1000 y movimiento reducido.
- Safe areas emuladas mediante CDP: **47 px arriba y 34 px abajo**. Flecha visible desde ≥47 px, también con scroll. Los 32 estados medidos tienen `scrollWidth <= clientWidth`; resultados en [checks.json](checks.json).
- Contrastes de texto: blanco/cosmos 16,36:1; blanco/extremo más claro del gradiente 4,91:1; etiquetas y texto secundario ≥4,5:1.

La evidencia usa fixtures de presentación. No sustituye la comprobación de cámara nativa, teclado y notch en un dispositivo iOS físico.

## Evidencia

| Estado | ES · 320 | EN · 320 | ES · 390 | EN · 390 |
| --- | --- | --- | --- | --- |
| Cámara | [ver](camera-es-320.png) | [ver](camera-en-320.png) | [ver](camera-es-390.png) | [ver](camera-en-390.png) |
| Analizando | [ver](analyzing-es-320.png) | [ver](analyzing-en-320.png) | [ver](analyzing-es-390.png) | [ver](analyzing-en-390.png) |
| Registro manual | [ver](manual-es-320.png) | [ver](manual-en-320.png) | [ver](manual-es-390.png) | [ver](manual-en-390.png) |

[Vídeo del flujo](motion-es-390.webm) · [Preview](preview-es-390.png) · [Revisión](review-es-390.png) · [Edición con cabecera visible](edit-es-320.png) · [Foco](manual-focus-es-390.png) · [Abriendo cámara](busy-es-390.png) · [Detalle](detail-es-390.png) · [Escritorio](desktop-manual-es-390.png) · [Movimiento reducido](reduced-motion-en-320.png).

## Archivos de implementación

`CameraCapture.tsx`, `FoodPhotoStage.tsx`, `MealFoodFlow.tsx`, `FoodResultCard.tsx`, `foodMotion.ts`, `MealIntakeForm.tsx`, `NutritionPage.tsx`, `global.css`, `variables.css`, `es.json`, `en.json` y los tests de `CameraCapture`/`MealFoodFlow`.

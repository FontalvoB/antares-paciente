# Food AI — iteración 2 de UI

Rediseño visual del flujo por comida sobre `feature/foodai-llm-vision`, sin cambios de servicios, contratos, guardado ni umbrales de confianza.

## Decisiones visuales

- Resumen sobre `--grad-brand-v`, kcal a 36 px en Space Grotesk e iconos: una sola ancla visual para interpretar la comida.
- Cuatro macros con divisores y columnas proporcionales: el nombre «Carbohidratos» se lee completo en móvil.
- Tarjetas blancas con borde, sombra desplazada y radio 18: mantienen contraste sobre el modal blanco.
- Porción y confianza en chips Ionic; macros en dos columnas: cada grupo se puede explorar sin competir con las calorías.
- Banner de estimación de ancho completo y fuentes traducidas: se conserva la advertencia funcional y desaparece el token técnico del contenido visible.
- Foto con radio 24 y sombra; separaciones de 24 px antes de los títulos: el flujo gana ritmo sin modificar captura ni análisis.
- Entrada del resumen y stagger de 40 ms por alimento; movimiento reducido con alternativa estática. No se anima el contenedor de revisión completo.

## Verificación

- `npm run lint`: correcto, sin errores ni advertencias en los archivos modificados; advertencias preexistentes en otros módulos.
- `npm test`: 142 archivos, 1.064 tests correctos. Incluye regresión de fuente traducida y ausencia de `llm_estimate` en el contenido visible.
- `npm run build`: correcto.
- `npm run i18n:check`: correcto, cero claves faltantes; el escáner informa claves huérfanas preexistentes. Ambas claves nuevas están en es/en.
- Chrome con componentes reales y respuestas interceptadas de muestra: revisión ES a 390×844, escritorio a 1440×1000 y EN a 320×740, movimiento reducido, tres confianzas, nombre largo y nutrición ausente. Sin errores JavaScript ni desbordamiento horizontal. Esta revisión visual no es una nueva verificación de producción ni de dispositivo iOS.

## Capturas

- [Revisión móvil](mobile-top.png)
- [Tarjetas de alimentos](mobile-cards.png)
- [Escritorio](desktop.png)
- [Inglés en pantalla pequeña](english-small.png)

Los valores y alimentos de las capturas son datos de muestra para revisión visual.

# Corrección de assets femeninos — 14 septiembre 2026

Entregados cuerpo v2, camiseta v2 y tres cabellos largos en el catálogo existente. Se conservaron los GLB y Blender anteriores. La validación usa Blender y los componentes reales AvatarViewer/AvatarPage con respuestas HTTP de prueba; no certifica el circuito normal login/gateway.

## Archivos finales

Rutas relativas a `public/models/avatar/`:

| Asset | Archivo | Triángulos antes → después | Bytes finales | Materiales / texturas |
|---|---|---:|---:|---:|
| Cuerpo femenino v2 | `bodies/female-body-base-v2.glb` | 15.000 → 15.000 | 4.342.200 | 1 / 3 |
| Camiseta femenina v2 | `clothing/tops/female-shirt-basic-01-v2.glb` | 7.344 → 7.344 | 1.474.752 | 2 / 0 |
| Female Hair Long 01 · Liso | `hair/female-hair-long-01.glb` | nuevo → 2.816 | 322.976 | 1 / 0 |
| Female Hair Long 02 · Ondulado | `hair/female-hair-long-02.glb` | nuevo → 2.816 | 323.556 | 1 / 0 |
| Female Hair Long 03 · Recogido | `hair/female-hair-long-03.glb` | nuevo → 3.536 | 383.116 | 1 / 0 |

Editable: `sources/female-v2/female-polished-v2.blend` (5.171.653 bytes). Checkpoint anterior: `sources/female-v2/before-correction.blend`. Scripts de trabajo y Scene Passport en esa misma carpeta. Los peinados alternativos están ocultos en la vista para evitar superposición; se pueden mostrar individualmente.

## Cuerpo

La fórmula anterior de BodyVolume utilizaba desplazamientos distintos según el signo de Y. En los laterales de la cintura, vértices vecinos cruzaban esa frontera y recibían desplazamientos incompatibles. El máximo de estiramiento de arista era 20,02×. Se sustituyó por un campo continuo de expansión transversal con transiciones suaves por región, sin escalar globalmente la malla.

Se conservaron exactamente Basis, pesos del cuerpo, rest bones y Actions en Blender. Waist y Chest permanecen intactos. BodyVolume, BodyLean y Abdomen corrigieron la discontinuidad. Arms, Thighs, FaceVolume y MuscleDefinition recibieron suavizado localizado de sus desplazamientos existentes, justificado por los máximos anómalos medidos en sus aristas; no se cambió el contrato ni se añadieron morphs.

| Morph | Máximo de estiramiento antes | Después |
|---|---:|---:|
| BodyVolume | 20,020 | 1,613 |
| BodyLean | 7,016 | 1,473 |
| Abdomen | 4,122 | 1,274 |
| Waist, sin editar | 1,157 | 1,157 |
| Chest, sin editar | 1,309 | 1,309 |
| Arms | 12,017 | 1,756 |
| Thighs | 5,440 | 1,332 |
| FaceVolume | 3,861 | 1,365 |
| MuscleDefinition | 13,952 | 1,178 |

Estos cocientes miden aristas, no una métrica clínica ni de volumen corporal. La exportación introdujo diferencias de redondeo de posición de hasta 2,08 micrómetros y separó algunos vértices por sus normales; la geometría Basis de Blender se conserva exactamente y el total de triángulos no cambia.

## Camiseta

Se suavizó la superficie existente, se transfirieron los morphs continuos mediante correspondencia baricéntrica y se ajustó la holgura en espacio de reposo y durante Idle. La holgura inicial mínima de ajuste fue de 18 mm, con correcciones locales posteriores; no se aumentó globalmente el tamaño para esconder penetraciones. Cuello, mangas y borde inferior conservan sus contornos; un segundo material ligeramente más oscuro distingue de forma sutil sus bordes/costuras, sin añadir triángulos.

En las vistas revisadas no se observa piel atravesando claramente la camiseta. La medición conservadora encontró un máximo residual de **2,125 mm en un vértice de la axila**, con pequeñas irregularidades de tela todavía presentes. El método es distancia firmada desde vértices evaluados a la normal del triángulo corporal más cercano: es un indicador de contacto, no una prueba exacta de intersección de sólidos ni de todas las caras. No se afirma clipping matemáticamente cero.

## Cabellos

01 tiene caída lisa continua; 02 añade ondas y mayor longitud posterior; 03 recoge el cabello en una cola posterior. Sus geometrías son distintas. Se revisó la caída posterior hasta cuello/espalda alta y se retiró la zona inferior de los hombros para evitar penetraciones. Todos están anclados a Head con peso 1, sin física ni animación adicional. Conservan los nueve nombres de morph, con ajustes de contacto en las regiones necesarias.

No hubo muestras negativas superiores a 0,5 mm en los cabellos después de la corrección, usando el mismo método aproximado contra el cuerpo. Los accesorios existentes cargaron junto a los tres estilos en AvatarViewer y AvatarPage. No se certifica ausencia de toda intersección entre cualquier triángulo del pelo, prenda y accesorios.

## Rig y animación

51 huesos canónicos en cada GLB. Se eliminó únicamente el redondeo de las matrices de bind producido por la ida y vuelta Blender/glTF (máximo previo 0,00000793); las matrices finales coinciden exactamente con v1. No se cambió la estructura ni se retargeteó el rig.

Idle: 12 segundos, 30 FPS; RigCheck: 2 segundos. Ambos conservan exactamente los bytes de los accessors de sus 153 canales originales. También se compararon las curvas y handles de ambas Actions con el checkpoint Blender y coinciden. El visor reproduce Idle y completa bucles. No se generaron animaciones nuevas.

## Integración y pruebas

- `src/components/avatar/avatar-equipment.ts`: rutas femeninas v2, tres entradas de cabello solo femenino y validación de slots contra el catálogo del género seleccionado.
- `src/i18n/es.json`, `src/i18n/en.json`: tres etiquetas traducidas.
- `src/hooks/__tests__/avatar-configuration.test.tsx`: conservación de los nuevos IDs en femenino y retirada al pasar a masculino.
- `scripts/avatar-personalization-check.mjs`: comprobación de selección de los tres estilos en AvatarPage y nueva cuenta de draw calls femenina.
- Nuevos scripts `avatar-female-v2-check.mjs`, `avatar-female-v2-audit.mjs`, `avatar-female-v2-clips.mjs`, `avatar-female-v2-canonicalize.mjs`: evidencia, transferencia de clips y control del contrato GLB.
- Assets, fuentes y evidencias de esta carpeta; nota técnica de morphs en `LEARNINGS.md` de la raíz.

AvatarViewer, AvatarEquipment, AvatarPage, BodyState, progreso, backend, persistencia, Auth, Next/admin y assets masculinos no fueron modificados por esta ronda. Hay cambios anteriores en varios de esos archivos en el workspace; no se atribuyen a esta corrección.

Pruebas completadas:

- BodyVolume 0/.25/.5/.75/1; BodyLean 0/.5/1. Combinaciones utilizadas por la app, sin combinar simultáneamente volumen y delgadez.
- 30 renders: cuerpo frontal/perfil/3/4 y conjuntos con los tres cabellos. Fotografías principales revisadas visualmente.
- Contactos en frames 1/91/181/271/361 para siete estados distintos: 140 muestras de objeto/estado/frame.
- 21 escenarios en AvatarViewer real con GLB reales, camiseta, gafas, reloj, pulsera y los tres peinados; morphs, carga y loop comprobados.
- AvatarPage real: selección de estilos, compatibilidad entre géneros, carga, errores y guardado/reintento con HTTP controlado. El guardado simulado utiliza los IDs antiguos; no pretende validar la persistencia de los nuevos.
- 22 tests de configuración/progreso aprobados; TypeScript, lint focalizado y Vite build aprobados. i18n: cero claves faltantes; el escáner conserva sus avisos de claves huérfanas/dinámicas preexistentes.

## Rendimiento y límites

Edge local, ejecución headless de escritorio; no es un benchmark de teléfono:

- Conjunto con cabello 01/02: 26.981 triángulos; con 03: 27.701.
- 10 draw calls con accesorios (antes 9; la costura de la camiseta añade un material).
- Aproximadamente 59–60 FPS sostenidos en las muestras; una muestra al cambiar al recogido bajó a 15,79 FPS y las siguientes volvieron a ~60. No se ocultó ese dato.
- Assets por conjunto: aproximadamente 6,53–6,59 MB sin compresión HTTP.
- Heap JS del ensayo de visor: 82–91 MB. Página real con fixtures: ~108 MB. No es memoria GPU total.
- En el ensayo de página: carga del cuerpo ~219 ms, primer frame del conjunto ~2.623 ms y desde entrada a visible ~4.301 ms; son medidas locales con el arnés, no del circuito productivo.
- `THREE.Clock` emite una advertencia de deprecación preexistente; se dejó intacta la arquitectura.

**Limitación de persistencia:** el catálogo del backend actual acepta `hair-02` y `hair-03` según género, y no reconoce `female-hair-long-01/02/03`. Los nuevos estilos se pueden seleccionar y ver, pero guardarlos con ese backend será rechazado. No se modificó esa lista ni se ejecutaron escrituras reales. Su habilitación requiere una tarea autorizada aparte.

Fases 11–13 continúan IMPLEMENTADAS, PENDIENTES DE VALIDACIÓN DEL CIRCUITO NORMAL LOGIN/GATEWAY. No se aplicó `AddErpApplicationSuspension`, no se reiniciaron servicios ni se modificó ERP. No se avanzó a otras fases.

Evidencia numérica: `before-morph-audit.json`, `after-morph-audit.json`, `motion-contact-audit.json`, `blend-invariants.json`, `canonical-roundtrip.json`, `glb-audit.json`, `browser-validation.json`, `page/personalization.json`, `build.log`.

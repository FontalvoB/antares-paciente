# Demo de validación del avatar masculino

Implementación completada el 2026-09-10. Abrir la app en http://localhost:5173, acceder con el modo demo existente (ID 12345678, contraseña demo1234), ir a **Perfil → Probar avatar 3D**. La pantalla usa la navegación por estado actual, sin URL propia.

## Dependencias y alcance

- Three.js 0.185.0, React Three Fiber 9.7.0, Drei 10.7.8.
- Tipos de desarrollo: @types/three 0.185.4.
- React/React DOM 19.2.8, Ionic 8.8.18 y TypeScript 6.0.3 conservados. Ninguna versión de paquete preexistente del package-lock cambió ni se eliminó.
- npm intentó resolver peers opcionales de Expo/React Native y seleccionar React 19.3 (incompatible con R3F 9.7). Se verificaron los peers web y se instaló con `--legacy-peer-deps`, sin Expo, React Native ni actualización de React. Para reproducir este lockfile: `npm ci --legacy-peer-deps`.
- npm actualizó package-lock.json y yarn.lock. El flujo utilizado y verificado es npm.
- Motor 3D dentro de components/avatar; importación diferida de AvatarViewer (~945 kB minificado, ~253 kB gzip). No se carga el motor desde las otras pantallas.
- No se modificaron backend, admin, servicios, autenticación, navegación general ni assets 3D. No hay persistencia del avatar, ropa, cabello, accesorios, femenino ni lógica de peso clínico.

## Qué se implementó

AvatarPage compone Screen, Scroll y PageHeader existentes con IonButton, IonRange, IonCard e IonSpinner. El canvas es una visualización específica del dominio. Usa tokens existentes y estilos locales, sin modificar el tema global. El visor permanece visible al recorrer los sliders.

AvatarViewer descarga y analiza el GLB con GLTFLoader, valida mesh/skin y metadatos, configura cámara frontal hacia -Z y luces locales, y reproduce Idle con AnimationMixer en LoopRepeat. El clip exportado tiene tiempos 1/30..151/30; se clona y desplaza a 0..5 s **en memoria**, sin tocar el GLB. No se reproduce RigCheck. Los morphs no son sobrescritos por animación.

Los nombres provienen de morphTargetDictionary. El rango 0..1 procede del extra `morph_range` del propio GLB. El controlador respeta las combinaciones del esquema del asset: BodyVolume/BodyLean alternativos, regionales limitados por `1 - 0.75*BodyVolume`, MuscleDefinition con BodyVolume=0. Hay pausa/reproducción y presets A base, B volumen=1, C volumen=0,5, D reducción=1.

Se cancela la descarga al desmontar, se liberan geometrías/materiales/texturas/skeleton, se detiene el mixer y se desmonta Canvas. Se suspende el render cuando el visor no es visible o la pestaña está oculta. Error Boundary, fallo de WebGL, descarga fallida y reintento incluidos. Los controles no se habilitan antes de cargar el modelo.

## Asset y morphs

`public/models/avatar/bodies/male-body-base-v2.glb` — SHA256 `299368cbb15d77bac094b0817e5d6a09460203cfedccf0b223d654b2cf5da12f`.

3.921.396 bytes, 23.924 triángulos, 51 huesos, una malla, un material PBR, tres imágenes embebidas (albedo, normal, ORM), altura 1,70 m.

| Morph verificado | Comportamiento |
|---|---|
| BodyVolume | Aumento general; +34,34 % de volumen geométrico a peso 1 |
| BodyLean | Reducción general; −11,64 % a peso 1 |
| Abdomen | Proyección abdominal |
| Waist | Anchura/perímetro de cintura |
| Chest | Volumen de pecho/tórax |
| Arms | Grosor de brazos y antebrazos |
| Thighs | Volumen de muslos |
| FaceVolume | Mejillas, mandíbula y cuello |
| MuscleDefinition | Relieve anatómico; también modifica volumen |

Los porcentajes son geométricos, no grasa corporal ni kilogramos. La inspección binaria y desplazamientos medidos están en el documento 21 de avatar-documentation-v6 en la raíz del monorepo.

## Baseline medido

Evidencia: [baseline.json](baseline.json). Chrome 152.0.7977.83 sobre Windows, Vite en localhost; viewport móvil emulado 390×844 DPR1,5 y escritorio 1280×900 DPR1. Sin throttling de red. La emulación no representa una GPU móvil.

| Métrica | Primera entrada móvil emulada | Escritorio posterior |
|---|---:|---:|
| Descarga + análisis GLB | 115 ms | 72 ms |
| Desde inicio de descarga hasta primer render | 460 ms | 243 ms |
| FPS estable | 59,99–60,02 | 59,98 |
| Draw calls por frame | 1 | 1 |
| Heap JS de toda la página | 94,7–99,3 MiB | 109,4 MiB |
| Geometrías / texturas residentes contadas por renderer.info | 1 / 6 | 1 / 6 |

El contador de texturas GPU incluye recursos internos de morphs/skinning y no equivale al número de imágenes del GLB. No se obtuvo memoria GPU en bytes. El heap incluye React y el resto de la app; no es memoria exclusiva del avatar ni una prueba prolongada de fugas. El tiempo de primer render no incluye autenticación ni descarga previa del chunk JavaScript. Entradas posteriores pueden beneficiarse de caché.

## Pruebas realizadas

`node scripts/avatar-smoke.mjs` pasó en Chrome real sin ventana, usando puppeteer-core ya instalado:

- Login demo → Perfil → avatar, skeleton de 51 huesos y 23.924 triángulos.
- Idle automático, bucle completado, pausa, cambio real del quaternion de Head y Hips fijo.
- Imágenes distintas para los cuatro presets.
- Cada uno de los nueve sliders operado con teclado y cambio comprobado del canvas con Idle pausado.
- Renderizado de escritorio, salida sin canvas restante y reentrada correcta.
- Descarga del GLB abortada intencionalmente: mensaje de error y reintento exitoso.
- Sin errores JavaScript de la demo en el recorrido normal. Los errores de red de servicios ajenos no forman parte de esta validación.

`npm run build` pasó. `npm run lint` pasó con 13 advertencias preexistentes fuera del avatar. `npm run i18n:check` pasó sin claves faltantes. Vite informa chunks mayores de 500 kB; el motor queda diferido y no se aplicó optimización agresiva.

Capturas: [móvil](mobile-base.png), [escritorio](desktop.png), [base](body-base.png), [mayor volumen](body-larger.png), [intermedio](body-intermediate.png), [menor volumen](body-lean.png).

## Archivos

Nuevos: src/pages/AvatarPage.tsx; src/components/avatar/AvatarViewer.tsx y avatar-validation.ts; scripts/avatar-smoke.mjs; este informe, baseline.json y capturas.

Modificados: package.json, package-lock.json, yarn.lock; src/App.tsx, src/types.ts, src/pages/ProfilePage.tsx (integración mínima); src/i18n/es.json y en.json (textos de la demo). Se registró la aprobación en docs/avatar-documentation-v6/21_AVATAR_RUNTIME_INTEGRATION_INSPECTION.md de la raíz.

## Siguiente tarea

Validar esta misma demo en dispositivos Android/iOS físicos con Capacitor: GPU, carga en red móvil, temperatura, memoria durante entradas repetidas y deformaciones en los extremos. Aún no es el editor final. No se han validado todos los pares posibles de ajustes regionales ni Safari/iOS real. Mantener los límites existentes hasta ampliar esa validación.

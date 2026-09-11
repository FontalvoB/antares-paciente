# FASE 5 — Carga con datos previos

Validación local: 11/09/2026. APROBADA en navegador Edge con viewport móvil y escritorio; no certifica dispositivos físicos iOS/Android.

## Causa

AvatarPage montaba AvatarViewer desde la primera renderización, en paralelo al GET del historial. Los pesos ausentes se convertían en cero y generaban un BodyState neutral. El visor descargaba el GLB e iniciaba Idle mientras la petición seguía pendiente. Al llegar las mediciones, useFrame interpolaba desde ese estado neutral al estado real.

## Implementación

El hook distingue un historial aún desconocido de una respuesta válida vacía mediante `resolved`, siempre limitado a su sesión. AvatarPage solo calcula el estado corporal y monta el visor después de resolver los datos. Se mantienen las fórmulas existentes y el asset male-body-base-v7.glb.

Secuencia inicial: petición de historial → validación de registros → AvatarBodyState → BodyVolume/BodyLean iniciales → carga del módulo del visor y GLB → inicialización de morphs → Idle en tiempo cero → primer render → notificación de avatar listo.

Estados separados de datos y render:

| Estado | Significado |
| --- | --- |
| LOADING_USER_DATA | Historial pendiente; en la primera carga no hay visor ni petición del GLB. |
| USER_DATA_READY | Historial validado y estado corporal calculado. |
| NO_DATA | Respuesta válida sin registros: se permite el cuerpo neutral y se conserva «Completar historia clínica». |
| AVATAR_LOADING | Datos resueltos; carga del módulo/GLB y preparación del primer frame. |
| AVATAR_READY | Primer frame dibujado con morphs iniciales e Idle preparado. |
| ERROR | Datos inválidos/fallo de API/sesión o error del asset; mensajes y reintentos separados. |

Al guardar peso se utiliza el POST existente y después se recarga el historial. Durante esa petición se conservan las mediciones validadas y la misma instancia del visor. La respuesta actualiza los morphs mediante la transición existente. Un fallo inicial no habilita un avatar neutral. Un fallo posterior oculta y pausa el visor conservado; no reemplaza las medidas por valores inventados.

## Validación

`scripts/avatar-loading-check.mjs` sirve AvatarPage, AvatarViewer, Ionic y el GLB reales con un shell de navegación aislado y respuestas HTTP controladas. No escribe en la BD.

- Historial demorado 2,5 segundos: cero solicitudes GLB y cero canvas antes de resolverlo.
- Con historial: primer frame con BodyLean=0,5, sin transición inicial desde cero.
- Sin historial: primer frame neutral y CTA «Completar historia clínica» presente.
- Registro de peso mediante formulario y POST simulado: GET posterior, mismo elemento canvas, ninguna descarga GLB adicional y BodyVolume=0,5.
- Recarga de página: primer frame con el nuevo BodyVolume=0,5.
- HTTP 503 del historial: ningún GLB/canvas; reintento recupera la carga.
- HTTP 503 del GLB: error del asset independiente del historial; reintento correcto.
- Idle avanza después del primer frame. Los otros siete morphs permanecen en cero.
- Validación adicional en la aplicación completa en localhost:5173, autenticada contra los servicios reales, solo lectura: descarga del GLB posterior al historial y primer frame con BodyVolume=1, coincidente con AvatarBodyState.
- 31 tests de historial, aislamiento de sesión y registro de peso pasan.
- `npm run build`, `npm run lint` y `npm run i18n:check` pasan. Persisten advertencias previas de lint, tamaño de chunks y Three.Clock; no se amplía el alcance para resolverlas.

## Medición

Muestras locales de desarrollo en Edge headless. Primera ventana de FPS de aproximadamente un segundo; no son un benchmark estadístico. La muestra anterior se ejecutó sobre copias de los tres archivos originales, añadiendo únicamente marcas temporales de medición en memoria del servidor de pruebas.

| Métrica | Antes, historial controlado | Después, historial controlado | Después, sesión real |
| --- | ---: | ---: | ---: |
| Historial | 2510 ms | 2503 ms | 11658 ms |
| Entrada a pantalla → avatar visible | 1180 ms, neutral prematuro | 3689 ms, transformado | 12616 ms, transformado |
| Descarga + parseo GLB | 111 ms | 131 ms | 112 ms |
| Inicio carga GLB → primer render | 426 ms | 422 ms | 415 ms |
| FPS | 54,4 | 53,8 | 53,4 |

El primer render se mide inmediatamente después de enviar el dibujo a WebGL, no mediante un temporizador del compositor de pantalla. La espera total incluye datos, carga diferida del módulo y preparación gráfica. En la sesión real domina la petición del historial (11,66 s). No se modificó el backend ni se hicieron optimizaciones generales.

Evidencia: `avatar-loading-validation/before.json`, `after.json`, `real-session.json` y capturas PNG en la misma carpeta.

## Archivos de esta tarea

- `src/pages/AvatarPage.tsx`: puerta de entrada por datos, estados y métricas de carga.
- `src/hooks/useAvatarProgress.ts`: primera respuesta válida, retención durante actualización y tiempo de historial.
- `src/components/avatar/AvatarViewer.tsx`: morphs antes de Idle/render y notificación del primer frame.
- `src/components/avatar/avatar-validation.ts`: métricas de primer estado visible.
- `src/i18n/es.json`, `src/i18n/en.json`: tres textos del flujo de carga.
- `src/hooks/__tests__/avatar-progress.test.tsx`: regresiones de carga/actualización/sesión.
- `scripts/avatar-loading-check.mjs`: pruebas de navegador reproducibles.
- Este informe y `docs/avatar-loading-validation/`: resultados de validación.

No se modificaron assets 3D, skeleton, postura, animación exportada, fórmulas corporales, backend, admin ni dependencias. Los cambios previos del repositorio se conservaron.

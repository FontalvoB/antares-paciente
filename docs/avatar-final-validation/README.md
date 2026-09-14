# Avatar — fases 14, 15 y 16

14/09/2026. Trabajo secuencial: persistencia → medición en navegador → experiencia final. Por indicación posterior del usuario, la prueba física se realizará manualmente.

## Estado de cierre

| Fase | Estado |
|---|---|
| 14 Circuito y persistencia | Corrección implementada y probada. Login/GET/PUT compatibles funcionan. Pendiente cargar la corrección de cabello largo en el servicio Auth activo y repetir su guardado por el circuito normal. |
| 15 Medición | Completada en navegador de escritorio. Android/iPhone pendientes de prueba manual; no se certifica rendimiento físico. |
| 16 Experiencia | Implementada y validada en navegador con datos reales y pruebas HTTP controladas. La demo integrada completa de cabello largo conserva el pendiente de Fase 14. |

## Fase 14

La causa del rechazo era la diferencia entre el catálogo frontend y `AvatarCatalog` del backend: faltaban los tres IDs `female-hair-long-01/02/03`. Se incorporaron al catálogo central de dominio, exclusivamente para femenino. No se añadieron excepciones al controller ni se relajó la validación general. Se reutilizan UserPreferences/JSONB, serializer, GET y PUT; no hay migración ni endpoint nuevo.

- Diez unitarias del módulo: correctas.
- HTTP/JWT/PostgreSQL con rollback: correcto. Incluye los tres cabellos, readback, incompatibilidad por género, aislamiento A/B y conservación de idioma/acento. Las identidades transitorias no quedan en BD.
- Login normal mediante la app/gateway: correcto tras cerrar la sesión anterior y autenticar normalmente.
- Configuración original femenina con camiseta, cabello corto y los tres accesorios: GET/PUT correctos por UI normal. Se dejó esa selección original.
- Historial real: cuatro registros; BodyVolume=1. No se añadieron mediciones.
- No se afirma haber realizado login de dos cuentas reales por UI: A/B se comprobó en HTTP/JWT/PostgreSQL y en las pruebas de cambio de sesión del frontend.

**Limitación de puesta en marcha:** el proceso Auth activo sigue usando el catálogo anterior y falla al guardar cabello largo. La corrección pasa en el binario compilado aislado. Reiniciar el host ejecutaría seeders ajenos al avatar, incluido un restablecimiento incondicional de contraseña del administrador. No se reinició, no se omitieron comprobaciones del host y no se sustituyó el gateway por un TestServer.

Un SELECT de solo lectura mostró que la migración ERP prohibida ya figura aplicada en el entorno actual, a diferencia del diagnóstico histórico. No fue aplicada por esta tarea. El login sí funciona; no se presenta el antiguo bloqueo de esquema como si siguiera demostrado. [Diagnóstico y checkpoint completos](phase14.md).

## Fase 15 — mediciones

Entorno: Edge de escritorio headless con viewport móvil, Vite local, componentes y GLB reales. Historial/preferencias controlados en el harness. No son métricas de Android/iPhone ni un benchmark de producción.

| Escenario | FPS observado estable | Draw calls | Assets cargados |
|---|---:|---:|---:|
| Masculino base | 56,2 | 1 | 2.940.240 bytes |
| Masculino con todos los módulos | ~60 | 9 | ~4,00 MB |
| Femenino base | ~60 | 1 | 4.342.200 bytes |
| Femenino con todos los módulos | ~60 | 10 | 6.476.592 bytes |
| Femenino con cabello largo 01/02/03 y equipo | ~60 | 10 | 6,53–6,59 MB |

GLB de cuerpo observado: masculino ~68–107 ms y femenino ~116 ms. Entrada femenina equipada sin retrasos artificiales de API: ~2.342 ms hasta visible, con ~1.370 ms desde inicio de carga del cuerpo. La entrada masculina de la prueba de inicialización tardó ~4.175 ms, **incluyendo** retrasos inyectados de 2.500 ms de historial y 400 ms de preferencias. No comparar esos tiempos como una diferencia propia entre modelos.

Prueba continua de Idle durante 120 segundos: ~60 FPS; 9 geometrías y 22 texturas GPU estables. Heap JavaScript: primera muestra ~153,7 MiB, después ~99,7–104,6 MiB. La variación incluye recolección de basura; este ensayo corto no demuestra ausencia de fugas a largo plazo. No se midió memoria total del proceso ni VRAM.

Escenarios recorridos: cuerpos masculino/femenino, volumen 0/.25/.5/.75/1 y menor volumen, ropa, cabello corto/rizado/largo, accesorios, Idle y loops, cambio de morph/ropa/cabello/género, recarga, desmontaje del cuerpo y error/reintento. La entrada/salida por Perfil también se recorrió con la app normal. No se realizó una prueba física ni una sesión de horas.

`visibleMs` después de cambiar género sigue midiendo desde la entrada a la página: no se presenta como tiempo del cambio. FPS=0 del primer frame significa ausencia de muestra estable, no bloqueo.

**Optimizaciones: ninguna.** No hubo evidencia que justificara reducir geometría, texturas o materiales. El ajuste posterior del tamaño de la vista móvil pertenece a UX, no a optimización del asset.

Evidencia: [escenarios](phase15-browser/after.json), [cabello y sesión continua](phase15-personalization/performance.json), [carga y personalización](phase15-personalization/personalization.json). [Protocolo físico manual](physical-checklist.md).

## Fase 16 — experiencia

Entrada desde **Perfil → Mi Avatar**. Dos vistas dentro de la misma página y del mismo visor:

- **Mi Avatar:** Cuerpo, Ropa, Cabello, Accesorios y Guardar. Permite género, seleccionar/quitar módulos compatibles y guardar preferencias. El cuerpo usa siempre el último registro validado; no hay edición de peso ni sliders de morphs.
- **Mi evolución:** historial, comparación inicial/actual, selección de registro, Actualizar historial y Registrar peso mediante el formulario existente. POST correcto → GET → BodyState, sin cambiar la fórmula.
- Al volver a Mi Avatar después de observar un registro histórico se recupera el BodyState actual; el canvas permanece montado. Cambiar de género remonta únicamente el cuerpo y conserva el progreso y equipo compatible.
- Se resuelven sesión, preferencias, historial y estado antes de mostrar el modelo equipado. Vacío confirmado, error y carga siguen diferenciados. Un fallo inicial no presenta un cuerpo provisional.
- Nombres de peinados para usuarios, sin IDs de catálogo. Sin RigCheck, debug, controles de prueba ni HTTP/códigos internos visibles.
- Botones frontal/perfil como alternativa a arrastrar; pausa/reanudación de Idle. No se modificó la animación ni el skeleton.
- Ionic para segmentos, selects, botones y feedback; fuentes y tokens del proyecto. Paneles en dos columnas en escritorio; vista compacta y controles accesibles en móvil/horizontal.

Pruebas: 27 unitarias frontend correctas; TypeScript, build de producción, lint e i18n correctos. Persisten avisos previos de Fast Refresh, chunks y THREE.Clock obsoleto; no se actualizaron dependencias.

El harness de personalización pasó carga, guardado fallido/reintento, restauración, ambos géneros, los tres cabellos largos, separación del formulario de peso, recuperación del BodyState actual y canvas compartido. Se verificaron clics reales para quitar/reponer gafas en 375×812, 430×932 y 844×390, labels, estados disabled, feedback y targets de al menos 44 px, sin overflow horizontal. Se revisaron visualmente capturas móviles y escritorio. No se declara auditoría completa de WCAG ni prueba de lector físico.

El harness de inicialización pasó con la nueva separación de vistas: historial, vacío, error de API, error de GLB/reintento, preferencias ausentes, guardado de peso controlado, género y actualización de historial mientras carga una prenda. La UI normal conservó el historial real y permitió refresh desde Mi evolución.

Evidencia: [personalización final](phase16/personalization.json), [accesibilidad y tamaños](phase16/accessibility.json), [carga y errores](phase16-loading/after.json), [API real](phase16-live.json), [captura real](live-final.jpg).

## Archivos modificados en esta misión

Frontend:

- `src/pages/AvatarPage.tsx`: vistas de apariencia/evolución, estados, controles y cuerpo actual.
- `src/pages/ProfilePage.tsx`: entrada Mi Avatar.
- `src/components/avatar/AvatarCustomizer.tsx`: clase visual del editor existente.
- `src/components/avatar/AvatarViewer.tsx`: posiciones de cámara por botón y altura visual configurable.
- `src/components/avatar/avatar-equipment.ts`: nombres visibles de peinados; mismos IDs y rutas.
- `src/theme/global.css`: estilos limitados a `.avatar-experience`.
- `src/i18n/es.json`, `src/i18n/en.json`: textos y traducciones.
- `scripts/avatar-loading-check.mjs`, `scripts/avatar-personalization-check.mjs`: escenarios, separación de vistas y mediciones.
- `docs/avatar-final-validation/`: diagnóstico, evidencias y protocolo manual.

Backend:

- `src/Services/CoppAddresd.Auth/Domain/Avatar/AvatarCatalog.cs`.
- `tests/CoppAddresd.UnitTests/Auth/AvatarConfigurationTests.cs`.
- `tests/CoppAddresd.UnitTests/Auth/AvatarPostgresTests.cs`.
- `docs/modules/avatar/README.md`.

No se atribuyen a esta misión los otros cambios previos del worktree. No se modificaron assets, fuentes Blender —incluida la masculina—, mallas, rig, skeleton, morphs, Idle, fórmulas, ERP, gateway, autenticación, Next.js/admin ni dependencias.

## Pendientes y decisiones

1. Activar el binario corregido de Auth con un procedimiento autorizado que contemple sus seeders externos; repetir guardar/recargar cabello largo por UI normal. Hasta eso, Fase 14 no se considera cerrada integralmente.
2. Ejecutar Android e iPhone disponibles siguiendo el protocolo manual. No optimizar antes de obtener evidencia física.
3. Validar sesiones físicas prolongadas y lectores de pantalla antes de cerrar certificación móvil/accesibilidad. La experiencia de navegador está implementada; esas validaciones no se sustituyen por simulación.

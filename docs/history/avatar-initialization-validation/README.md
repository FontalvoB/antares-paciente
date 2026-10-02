# Validación de inicialización del avatar

14/09/2026. Alcance: inicialización de Mi evolución, sin modificar BD, backend, Auth, gateway, fórmulas, assets, Blender ni dependencias. No se aplicaron migraciones ni se reiniciaron servicios.

## Diagnóstico

La carga automática **ya existía** y funcionó antes de los cambios tanto con HTTP controlado como con la API real. No se reprodujo el síntoma de necesitar refresh para obtener los datos; por ello no se atribuye una causa exacta no demostrada. El [diagnóstico previo](diagnosis.md) conserva los resultados anteriores a modificar código.

Sí se comprobaron diferencias corregibles: «Actualizar historial» abría el formulario de peso en vez de consultar; preferencias e historial arrancaban en paralelo; faltaba tratar una respuesta satisfactoria de preferencias nula/204. Además, si el historial cambiaba mientras se cargaban los módulos, el estado visual inicial podía conservar morphs anteriores y comenzar interpolando. Ahora el primer fotograma toma el último BodyState confirmado. La caché HTTP no se identificó como causa del síntoma.

## Solución y secuencia

La función común `loadUserAvatarData()` de `src/hooks/useAvatarProgress.ts` consulta el endpoint existente `metrics-history?codes=weight&days=365` con `cache: 'no-store'` y valida los registros mediante la lógica existente. El mismo efecto la utiliza al entrar, al actualizar manualmente y después de guardar peso.

Secuencia: sesión resuelta → preferencias confirmadas → historial real → BodyState → género y assets → GLB → morphs iniciales y módulos equipados → Idle → primer fotograma visible. El viewer permanece en carga mientras faltan datos iniciales. El primer fotograma usa el estado corporal más reciente, incluso si cambió durante la carga de ropa.

«Actualizar historial» consulta directamente; «Registrar peso» abre el formulario existente. Guardado correcto → POST → GET por la función común → nuevo BodyState. Un cambio de género conserva el estado corporal y espera los assets compatibles.

Solo una respuesta satisfactoria de preferencias sin contenido utiliza defaults; errores HTTP o configuración inválida no se ocultan. Un historial vacío confirmado permite avatar neutral, Idle, mensaje y «Completar historia clínica». Error de consulta mantiene error y reintento; no se interpreta como ausencia de datos.

## Pruebas

| Caso | Evidencia y resultado |
|---|---|
| A: historial existente | API real, cuatro registros, configuración femenina y equipo guardado. Sin refresh: primer fotograma BodyVolume=1, BodyLean=0. También pasó con respuestas controladas y GLB real. |
| B: sin historial | HTTP controlado: avatar neutral solo después del GET vacío, mensaje y CTA. No se alteró una cuenta real para vaciar registros. |
| C: refresh | API real: consulta directa sin formulario. Prueba controlada: segundo GET, cero POST, mismo canvas y sin recargar GLB. |
| D: guardar peso | HTTP controlado: POST correcto seguido de GET y cambio de morphs, conservando canvas. No se guardó peso ficticio en la BD real. |
| E: recarga | Recarga del navegador con sesión real y nueva entrada a Mi evolución: cuatro registros y BodyVolume=1 desde el primer fotograma. |
| Preferencias/género | Historial espera preferencias; 204 usa defaults; cambio de género conserva morphs. |
| Errores | Error de API distinto de vacío; fallo de GLB y reintento verificados. |
| Historial durante carga de ropa | GET actualizado mientras la prenda seguía cargando: primer fotograma BodyVolume=.5, BodyLean=0; no interpolación inicial desde datos anteriores. |

27 pruebas unitarias en tres archivos pasaron. TypeScript, build de producción, lint y revisión i18n finalizaron correctamente; permanecen avisos existentes de Fast Refresh y tamaño de chunks. El harness de navegador terminó correctamente con los escenarios anteriores. La captura real se revisó visualmente.

Evidencia: [resultados controlados](after/after.json), [recarga con API real](live-after-reload.json), [refresh real](live-refresh.json), [captura](live-after.png). Los cinco assets femeninos auditados conservan sus hashes: [verificación](assets-unchanged.json).

## Tiempos observados con API real

| Métrica | Antes | Después |
|---|---:|---:|
| Consulta de historial | 10.479,9 ms | 5.882,3 ms |
| Carga GLB | 170,2 ms | 73,2 ms |
| Hasta avatar visible | 12.669,7 ms | 7.193,2 ms |

Son mediciones individuales locales con diferentes condiciones de caché/calentamiento. No constituyen un benchmark ni demuestran una mejora causada por estos cambios. No se realizó optimización de rendimiento.

## Archivos de esta corrección

- `src/pages/AvatarPage.tsx`: secuencia explícita y separación de refresh/registro.
- `src/hooks/useAvatarProgress.ts`: función común y espera de configuración.
- `src/hooks/useAvatarConfiguration.ts`: espera explícita de sesión.
- `src/services/program/metrics-history-service.ts`: opción de caché por llamada, sin cambiar otros consumidores.
- `src/services/avatar-configuration-service.ts`: defaults únicamente ante respuesta satisfactoria sin contenido.
- `src/components/avatar/AvatarViewer.tsx`: último BodyState en el primer fotograma.
- `src/hooks/__tests__/avatar-progress.test.tsx`: cobertura de secuencia.
- `src/hooks/__tests__/avatar-initialization-service.test.ts`: defaults, errores y consulta real del servicio.
- `scripts/avatar-loading-check.mjs`: validaciones de carga, refresh, guardado y carrera durante carga de módulos.
- `docs/avatar-initialization-validation/`: diagnóstico, copias previas, evidencias y este informe.
- `../LEARNINGS.md`: aprendizaje sobre morphs del primer fotograma.

## Estado de FASE 5

**APROBADA en el alcance funcional verificado:** entrada, actualización y recarga con API real; ausencia de historial y guardado mediante HTTP controlado, sin escrituras en BD. No se declara probado un POST de peso contra la BD real ni una cuenta real vacía. El estado de validación de otras fases no se modifica con este informe.

# FASE 4 — demostración local con BD real

Validación: 11 de septiembre de 2026. Alcance: avatar y preparación reversible de datos locales.

## Resultado

La demo del avatar queda validada en ambos escenarios. Sin historial se muestra el GLB vigente con Idle y los nueve morphs neutrales, el mensaje «No hay registros de peso suficientes para mostrar tu evolución.» y el botón «Completar historia clínica». Loading y errores siguen siendo estados diferentes de HTTP 200 sin datos. El visor permanece montado durante la actualización del historial.

Con historial se muestran las mediciones reales obtenidas por `GET /api/v1/program/me/metrics-history?codes=weight&days=365`, su referencia, último registro, selector y cambio relativo. Se conserva la normalización existente: cambio relativo / 0,20, limitado a [-1,1]. Solo BodyVolume y BodyLean varían. Los morphs regionales permanecen en cero.

**Aprobada para demostración local del avatar. La experiencia clínica completa no está aprobada:** el destino existente `navigate('hc')` abre `HistoryPage`, pero esa página ya contiene datos estáticos de demostración de otra identidad y no permite registrar peso. Se verificó la navegación y se conserva la pantalla solicitada; integrar su lectura/escritura autenticada es una tarea posterior. No presentar ese expediente de ejemplo como información de la cuenta autenticada.

## Cuenta y fixture

Cuenta «Paciente Antares», confirmada expresamente por el propietario como exclusivamente de pruebas.
Usuario: `8569f989-3d7b-4130-bc20-0c41c1e188ef`.
Paciente: `a90bd89b-984f-4a96-8095-9da2fb2bc3da`.
Base verificada: `coppaddresd`, servidor PostgreSQL loopback `::1`. Antes del seed: cero mediciones clínicas para este paciente. No se crearon usuarios ni se modificaron registros clínicos preexistentes.

| Fecha (America/Bogota, 12:00) | Peso | Papel | BodyVolume | BodyLean |
|---|---:|---|---:|---:|
| 2026-07-13 | 90 kg | Inicial | 0 | 0 |
| 2026-08-12 | 94 kg | Intermedio | 0,222222 | 0 |
| 2026-09-11 | 86 kg | Actual | 0 | 0,222222 |

Hay **tres registros** en `app.clinical_measurements`, usando catálogo activo `weight` y unidad `kg`. Todos llevan la nota `DATOS DE PRUEBA LOCAL - avatar-phase4-20260911` y UUID determinista del lote. Cambio actual: -4 kg (-4,44 %) respecto a la referencia. Son mediciones ficticias de desarrollo, no resultados clínicos.

El repositorio tiene scripts de seed, pero el seeder de mediciones inicializa el catálogo, no este historial. Se añadió un script específico en el directorio existente `coppAddresdBack/scripts`, sin modificar servicios, endpoints, capas, migraciones ni tablas. Exige `Development`, valida host loopback, nombre de BD e identidad exacta y rechaza insertar sobre otras mediciones. Lee la conexión de la configuración local; no contiene contraseñas ni tokens.

Desde la raíz del monorepo:

```powershell
./coppAddresdBack/scripts/seed_avatar_local_demo.ps1 -Mode Seed -Environment Development
./coppAddresdBack/scripts/seed_avatar_local_demo.ps1 -Mode Remove -Environment Development
```

`Seed` es idempotente y no sobrescribe. `Remove` exige coincidencia de paciente, autor, nota y los tres UUID del lote. Se probaron seed repetido → tres filas, limpieza → cero filas y seed final → tres filas. El estado final conserva los datos para la demostración.

La caché existente del endpoint dura hasta cinco minutos. Tras una inserción/eliminación directa con este script, esperar su expiración antes de pulsar «Actualizar historial». No se vació la caché global ni se cambió el comportamiento del backend.

## Pruebas y evidencia

El navegador integrado falló antes de conectar. Se utilizó Playwright ya instalado con Edge aislado y login real contra `localhost:5173`, sin interceptar ni sustituir respuestas HTTP, sin acceder a perfiles personales y sin persistir credenciales en el script o resultados.

- Sin datos: tres respuestas HTTP 200 con `metrics: []`, avatar visible, nueve morphs en cero, al menos un bucle Idle completo, refresh y navegación real a `HistoryPage`.
- Con datos: respuestas HTTP 200 con exactamente las tres mediciones de la BD; selección inicial/intermedia/actual y refresh hacia el último registro.
- Valores observados en la malla durante la transición: BodyLean 0,222086 (actual), BodyVolume 0,222057 (intermedio), referencia neutral con residuo temporal menor a 0,002. Los demás morphs fueron cero.
- Capturas comparadas con Idle pausado: cambios sutiles en torso/extremidades, coherentes con el rango existente. No se amplificó la fórmula para exagerar la demostración.
- `npm run build`: correcto; advertencia existente de chunks grandes.
- `npm run test -- src/hooks/__tests__/avatar-progress.test.tsx`: 13/13 correctas. Estas son pruebas de regresión aisladas; la comprobación de datos reales es el E2E anterior.
- `npm run lint`: sin errores, advertencias preexistentes del proyecto.
- `npm run i18n:check`: cero traducciones inglesas faltantes; claves huérfanas preexistentes.
- `git diff --check`: correcto.

Métricas orientativas de Edge en este equipo: ~60 FPS, un draw call, carga GLB ~105 ms y primer frame ~513 ms; heap de página ~106 MB. Asset vigente `male-body-base-v3.glb`: 4.059.596 bytes, 23.924 triángulos, 51 huesos, un material, tres texturas. No equivalen a una medición móvil o de memoria GPU.

Evidencia en `avatar-local-demo-validation/`: `empty.json`, `data.json`, capturas de ausencia de historial, navegación y estados inicial/intermedio/actual. El script reproducible `scripts/avatar-local-demo-check.mjs` recibe `AVATAR_TEST_DOCUMENT` y `AVATAR_TEST_PASSWORD` solo por el entorno del proceso, y acepta `empty` o `data` según el estado preparado de la BD. No ejecuta el seed automáticamente.

## Archivos de esta corrección

- `antares-paciente/src/pages/AvatarPage.tsx`: visor compartido entre estados, orden avatar → información y CTA existente de historia.
- `antares-paciente/src/i18n/es.json` y `en.json`: dos textos nuevos.
- `antares-paciente/scripts/avatar-local-demo-check.mjs`: E2E local real.
- `coppAddresdBack/scripts/seed_avatar_local_demo.ps1`: fixture y limpieza local.
- Este documento y `avatar-local-demo-validation/`: resultados y capturas.

Los cambios anteriores del repositorio, assets, Idle, skeleton, rig, Morph Targets, materiales y dependencias se conservaron. No se modificó Next.js/admin ni el código de los servicios .NET.

Siguiente tarea recomendada: conectar la Historia Clínica existente a la identidad autenticada y al flujo real de registro de mediciones antes de aprobar el recorrido completo «Completar historia clínica → volver al avatar».

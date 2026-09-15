# Avatar: fases 11, 11.1, 12 y 13

14/09/2026. Implementación secuencial sobre el sistema existente. Sin dependencias nuevas, cambios en Next/admin o lógica clínica.

## Estado y límite operativo

**Estado confirmado: IMPLEMENTADA, PENDIENTE DE VALIDACIÓN DEL CIRCUITO NORMAL DE LOGIN/GATEWAY.** El usuario no autoriza aplicar AddErpApplicationSuspension ni reinicios que modifiquen ERP. Diagnóstico de los seis puntos y alternativas sin implementar: [login-gateway-diagnosis.md](avatar-phases-11-13-validation/login-gateway-diagnosis.md).

Implementados y probados: femenino independiente, integración común, editor Ionic, catálogo compatible y persistencia estética. La cuenta de pruebas autorizada quedó con configuración femenina, camiseta, peinado lateral, gafas, reloj y pulsera. El valor previo era null; respaldo en `avatar-phases-11-13-validation/prior-demo-avatar.json`.

**No se arrancó el host Auth normal ni se probó el circuito completo login/gateway.** La BD local tiene pendiente `20260913184501_AddErpApplicationSuspension`; el arranque actual ejecuta todas las migraciones y seeders. Hacerlo habría modificado ERP fuera del alcance. Se aplicó únicamente la migración independiente del avatar. Su API se probó mediante TestServer con JWT y PostgreSQL reales; la restauración visual se probó con la página real y HTTP controlado. No se afirma que el circuito desplegado ya esté validado.

## Fase 11 — Femenino base

- Activo: `public/models/avatar/bodies/female-body-base-v1.glb`.
- Fuente editable limpia: `public/models/avatar/sources/female-v1/female-body-base-v1.blend`.
- 15.000 triángulos, 4.268.016 bytes, 1 material, 3 imágenes de 1024×1024.
- Anatomía femenina independiente generada con Higgsfield/Tripo; no se modificó la malla masculina. Original de 1.458.788 triángulos conservado para recuperación.
- Skeleton canónico de 51 huesos, nombres/jerarquía compatibles; altura aproximada 1,60 m. Rig adaptado mediante escala uniforme del armature; matrices de bind verificadas. Máximo 4 influencias normalizadas por vértice.
- Nueve morphs anatómicos: BodyVolume, BodyLean, Abdomen, Waist, Chest, Arms, Thighs, FaceVolume, MuscleDefinition.
- Idle existente reutilizado, 12 segundos a 30 FPS; RigCheck técnico de 2 segundos. Ninguna animación nueva. Diferencia de vértices entre extremos del loop: cero. Movimiento máximo entre muestras: 5,25 cm; sin desplazamiento acumulado.
- Validación mediante reimportación independiente: keys, pesos, rig, loop y estados base/intermedio/volumen/lean. Cada morph muestreado en frames 1, 91, 181, 271, 361. Evidencia `female-checkpoint.json` y renders `export-*`.
- Problemas corregidos: orientación, costuras sin unir antes de decimar y pesos. Primer envío de generación rechazado 422; reenvío mínimo produjo un único job completado, 5 créditos reportados. No se dependió de una herramienta de estimación ausente.

## Fase 11.1 — Integración común

- `AvatarViewer.tsx` selecciona el cuerpo desde el catálogo y comparte escena, mixer, morphs, equipamiento y disposal. Desmonta el cuerpo anterior al cambiar de género.
- `avatar-equipment.ts` concentra rutas de cuerpos/módulos; `avatar-validation.ts` reutiliza la referencia masculina centralizada.
- `AvatarPage.tsx` espera datos antes de habilitar el visor. La entrega final también espera configuración y equipamiento inicial: primer frame con BodyState y conjunto correctos, sin masculino provisional.
- Un solo AvatarBodyState para ambos cuerpos, derivado del historial, sin lógica clínica duplicada.
- Pruebas: ambos cuerpos, 51 huesos, Idle/morphs, cambio de género y una sola canvas; datos vacíos, API/asset fallidos, reintento y actualización de peso sin reconstruir cuerpo. `phase11-integration/after.json`.

## Fase 12 — Personalización

- `avatar-state.ts`: AvatarConfiguration guarda preferencias; AvatarState combina estas con BodyState derivado sin duplicar progreso.
- `AvatarCustomizer.tsx`: secciones Ionic Cuerpo, Ropa, Cabello y Accesorios. Equipar/cambiar/quitar inmediatamente. Sin controles de prueba antiguos; métricas técnicas ocultas para QA, pausa de movimiento disponible.
- IDs estables: `shirt-basic-01`/`shirt-basic-01-navy`, `hair-02`, `hair-03` (masculino), `glasses-01`, `watch-01`, `bracelet-01`. Los compatibles resuelven la variante anatómica según género. Hair03 se retira al cambiar a femenino. Pants/shoes permanecen slots nulos sin inventar assets.
- Se reutiliza AvatarEquipment: un único skeleton vivo/mixer, mismos pesos en cuerpo y módulos por frame. El primer frame espera todos los elementos seleccionados.
- Variantes femeninas activas: `clothing/tops/female-shirt-basic-01-v1.glb`, `hair/female-hair-02-v1.glb`, `accessories/glasses/female-glasses-02-v1.glb`, `accessories/watches/female-watch-02-v1.glb`, `accessories/bracelets/female-bracelet-02-v1.glb`.
- Fuente del conjunto: `public/models/avatar/sources/female-v1/female-equipment-v1.blend`, aproximadamente 5 MB. Matrices de bind, nueve keys, máximo 4 influencias y loop comprobados tras reimportar los cinco módulos: `female-equipment-checkpoint.json`.
- Camiseta femenina de 7.344 triángulos, construida sobre su superficie, con holgura y bordes. Corregidas penetración de pecho/cuello y posiciones de gafas/correas. Persisten irregularidades superficiales menores de cerca; no se garantiza ausencia de contacto en cualquier mezcla extrema de morphs.
- Página/GLB reales probados en Edge a 430×1000 y 1280×900: equipar/cambiar/quitar, género, BodyState, Idle y errores. `phase12/after.json` y capturas.

## Fase 13 — Persistencia

- Entidad `UserPreference`, tabla existente `auth."UserPreferences"`. Columna nueva nullable `AvatarConfiguration jsonb`; sin tabla paralela ni datos clínicos.
- GET/PUT `/api/auth/me/avatar`: Controller → Application (casos de uso/interfaz) → Domain (compatibilidad/defaults) → Infrastructure (EF/PostgreSQL), dentro de Auth standalone, dueño de preferencias. Sin referencias nuevas entre proyectos.
- Identidad desde ClaimTypes.NameIdentifier; nunca desde body/query. Campos JSON desconocidos, versiones/IDs/slots/géneros incompatibles rechazados. Request limitado a 4 KB, respuestas no-store; sin rutas, GLB, morphs o peso.
- Defaults según género del perfil cuando existe; camiseta/cabello compatibles y accesorios vacíos. GET sin configuración no escribe. Upsert parametrizado atómico conserva idioma/color.
- `useAvatarConfiguration.ts`: carga por sesión, cambios inmediatos, guardar explícito, error/reintento sin perder selección. No sustituye cambios más recientes con respuestas antiguas. Descarta respuestas de otra sesión.
- `avatar-configuration-service.ts`: base URL existente de Auth. La escritura fija el token de origen y no reintenta automáticamente bajo otra identidad. No se modificó gateway, navegación general o progreso clínico.
- Migración/snapshot `20260914152543_AddAvatarConfigurationPreference`. Up revisado y aplicado solo a la columna y su registro de historial. Down generado; no se ejecutó sobre la configuración guardada.
- Backend: 7 pruebas unitarias + 1 HTTP/JWT/PostgreSQL con rollback + 1 opt-in de commit/lectura desde otra conexión para la cuenta de pruebas: 9/9.
- Frontend: 19/19 pruebas de configuración/progreso. Navegador: fallo de carga sin cuerpo provisional, fallo de guardar conserva selección, reintento, recarga/restauración, compatibilidad y primer frame vestido. `phase13/personalization.json`.
- No se modificó ClinicalMeasurement ni se crearon mediciones ficticias. El peso continúa en el historial existente.

## Rendimiento

Edge headless local, viewport 430×1000, DPR limitado a 1,5. GLB reales y HTTP clínico/configuración controlado. Baseline sin demoras artificiales: `avatar-phases-11-13-validation/baseline/personalization.json`. Cada conjunto: cuerpo, camiseta, Hair02, gafas, reloj y pulsera.

| Medida | Masculino | Femenino |
|---|---:|---:|
| Triángulos | 22.006 | 26.063 |
| Bytes cargados | 4.002.684 | 6.149.480 |
| Materiales | 8 | 8 |
| Draw calls | 9 | 9 |
| FPS observados | 59,96 | 59,98 |
| Heap de página | 112,21 MiB | 103,32 MiB |
| Carga/parseo del cuerpo | 112 ms | 140,2 ms |
| Inicio de carga → primer frame completo | 743 ms | 1.236,2 ms |

Masculino medido después del cambio de género; femenino en entrada inicial. No son benchmarks fríos equivalentes. Heap incluye toda la página, no GPU. Entrada incluye compilación/carga del visor y HTTP local; no predice producción. Falta medición en móvil físico.

## Archivos y limpieza

Frontend: AvatarPage, AvatarViewer, avatar-equipment, avatar-validation, AvatarCustomizer nuevo, avatar-state nuevo, useAvatarConfiguration nuevo, avatar-configuration-service nuevo, es/en, tests de hook y scripts de navegador/auditoría. GLB/fuentes femeninos en rutas anteriores. Inventario de los 13 GLB activos: `active-assets.json`.

Backend: UserPreference, AuthDbContext, Program (solo DI), snapshot/migración, AvatarConfigurationController nuevo, Application/Avatar, Domain/Avatar, Infrastructure/Avatar, dos archivos de tests Auth y documentación `coppAddresdBack/docs/modules/avatar/README.md`.

TypeScript + Vite correctos; lint sin errores y con advertencias preexistentes ajenas a avatar; i18n sin claves faltantes. Ninguna dependencia instalada/actualizada; sin Next/admin o módulos clínicos modificados.

Auditoría previa en `reference-inventory.json`. Eliminados seis intermedios femeninos sin referencias: `female-body-base-v1.blend1`, `female-equipment-review.blend1`, `female-intake.blend`, `female-reduced.blend`, `female-rig-review.blend1`, `female-weld-before-reduction.blend`. Total 413.540.470 bytes; hashes en `cleanup.json`. Raw, fuentes limpias y recuperación conservados. Ningún GLB masculino activo alterado: siete hashes coinciden con inventario previo. Fuente masculina de 09:08:17 anterior a esta misión; el hash de su inventario histórico precede la corrección de FPS documentada en v9, no representa una modificación de esta misión.

## Siguiente validación

Mantener el estado actual. No aplicar la migración ERP ni modificar Auth/gateway para completar esta validación sin autorización explícita. Cualquier propuesta posterior deberá partir del diagnóstico documentado; no hay solución adicional autorizada o implementada.

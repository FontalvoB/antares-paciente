# FASE 7 — Historia Clínica, Mediciones y Consolidación de Avatar / Perfil Corporal: Informe de Integración

> **Change OpenSpec**: `app-fase-7-historia-metricas-avatar`  
> **Fecha**: 2026-09-24  
> **Estado**: Completada e integrada (Backend + APP móvil + QA automatizado con Playwright/Puppeteer)

---

## 1. Resumen Ejecutivo

La Fase 7 conecta el expediente clínico y las mediciones corporales del paciente con la base de datos real PostgreSQL sin intermediación de mocks, garantizando que:
1. **Historia clínica propia**: El paciente puede consultar todas sus mediciones de laboratorio, signos vitales y composición corporal vía `GET /api/v1/me/measurements` con paginación estable por cursor keyset `(observed_at DESC, id DESC)`.
2. **Independencia del programa**: No tener una inscripción activa a un programa no bloquea ni oculta la historia clínica.
3. **Consolidación de Avatar y Perfil corporal**: Se eliminó el `BodyMap` estático y datos falsos de `src/data/bodyProfile` (sin 'Riesgo bajo', sin % de grasa inventado). El Avatar 3D (`AvatarStage`) vive en Perfil corporal con tres pestañas nativas (`IonSegment`): *Composición*, *Mi evolución* y *Personalización*.
4. **Navegación unificada**: La acción «Mi Avatar» desde Perfil redirige directamente a `screen='body'`.
5. **Cero mock fallbacks**: Todos los datos se obtienen de la verdad persistida.

---

## 2. Cambios en Backend (`coppAddresdBack`)

### 2.1 Nuevos Endpoints y Contratos
- `GET /api/v1/me/measurements`:
  - Parámetros: `pageSize` (1-100, default 20), `cursor` (opaco Base64 de `observedAt|id`), `codes` (filtro opcional CSV).
  - Respuestas: `200 OK` (`CursorPagedResult<MeasurementItemDto>`), `400 Bad Request`, `401 Unauthorized`, `404 Not Found`.
  - Resuelve la identidad únicamente desde el JWT (`patient_profiles.user_id`), impidiendo cualquier IDOR.
  - DTO mínimo `MeasurementItemDto`: `id, metricCode, metricName, value, unitCode, unitSymbol, observedAt, source` (sin notas clínicas ni PHI sensible innecesario).
- `GET /api/v1/me/metrics-history`:
  - Parámetros: `codes` (CSV requerido), `days` (7-365, default 180).
  - Devuelve la serie diaria por métrica sin requerir inscripción activa al programa.
  - Conserva `/api/v1/program/me/metrics-history` con su validación estricta de inscripción (contrato congelado).

### 2.2 Repositorio y Rendimiento SQL
- `PatientMeasurementRepository`:
  - Keyset pagination `(observed_at, id) < (cursorDate, cursorId)`.
  - Proyección `AsNoTracking` con joins de catálogo en un solo roundtrip SQL (cero N+1).
  - `Take(pageSize + 1)` para calcular `hasNextPage` sin `COUNT(*)` costosos.
- **EXPLAIN (ANALYZE, BUFFERS)** en PostgreSQL local:
  - Base `LIMIT 21`: Usa `Index Scan using ix_clinical_measurements_patient_observed` (2.7 ms, 78 hits).
  - Con filtro por código: `Bitmap Index Scan` (0.66 ms, 91 hits).
  - **Veredicto**: El índice existente cubre perfectamente la consulta. **Cero migraciones requeridas**.

### 2.3 Pruebas Unitarias Backend
- `dotnet test tests/CoppAddresd.UnitTests --filter "FullyQualifiedName~Measurements"`: **22 pasados, 0 fallidos**.
- Barrido completo `ProgramProgress` + `Measurements`: **255 pasados, 0 fallidos, 0 regresiones**.
- `dotnet build src/CoppAddresd.Api`: **0 warnings, 0 errores**.

---

## 3. Cambios en Frontend (`antares-paciente`)

### 3.1 Cliente y Hooks Tipados
- `src/services/measurements/my-measurements-service.ts`:
  - `getMyMeasurements()` y `getMyMetricsHistory()`.
- `src/hooks/useMyMeasurements.ts`:
  - Hook reactivo basado en `useInfiniteQuery` de TanStack Query.
  - Paginación incremental (`loadMore`), deduplicación por `id`, y limpieza de caché ante `onSessionInvalid`.

### 3.2 Historia Clínica (`HistoryPage.tsx`)
- Conectada a `useMyMeasurements()` para mostrar todas las observaciones clínicas persistidas.
- Soporta carga de páginas anteriores con botón nativo *Cargar mediciones anteriores*.
- Estados de UI claros: Skeleton durante carga, estado vacío honesto, mensaje de error con botón de reintento.
- Identificación y puntajes del programa mostrados como sección opcional si existen.

### 3.3 Consolidación de Perfil Corporal (`BodyProfilePage.tsx`)
- Eliminado `BodyMap` y datos mock de `src/data/bodyProfile`.
- Integración de `AvatarStage` 3D reutilizable con carga lazy, Error Boundary y detección de `prefers-reduced-motion`.
- Tres segmentos nativos (`IonSegment`):
  1. `composition`: Avatar 3D arriba y mediciones corporales reales abajo (peso, talla, cintura, cadera, muñeca, grasa sólo si existe, BMI calculado/servido).
  2. `evolution`: Visualización cronológica del peso histórico y delta. Botón de registro de peso visible **únicamente** con rol `Admin`.
  3. `appearance`: Selector de prendas y personalización cosmética del avatar.
- `ProfilePage.tsx` y `AppContext.tsx`: La opción «Mi Avatar» navega directamente a `screen='body'`.

### 3.4 Calidad y Pruebas Frontend
- `npm run lint`: **0 errores** (oxlint).
- `npm run i18n:check`: **0 claves faltantes** en `es.json` y `en.json`.
- `npm run build`: **Exitoso** (`tsc -b && vite build` en 1.21s).
- `npm test`: **76 archivos de prueba, 615 tests pasados (100% verde)**.

---

## 4. Verificación Automatizada de QA (Playwright / Puppeteer)

Se ejecutó la suite de verificación automatizada headless `scripts/fase7-qa-check.mjs` en viewport táctil **390×844**:

```text
  ✓ viewport 390x844 táctil
  ✓ historia: GET measurements inicial sin cursor
  ✓ historia: filas reales (nombre, valor+unidad, fecha, origen)
  ✓ historia: loadMore pide cursor y concatena
  ✓ navegación: 'Mi Avatar' abre body
  ✓ body: Avatar 3D (canvas) sin errores WebGL
  ✓ body: segmentos Composición / Mi evolución / Personalización
  ✓ body: sin BodyMap viejo ni 'Riesgo bajo' falso
  ✓ body: medidas reales (sin fecha fija 05/08/2026)
  ✓ reduced-motion: emulación activa y body estable
  ✓ cero pageerrors en toda la sesión
{"passed":11,"failed":0}
```

### Capturas de Pantalla Generadas en `docs/fase7-qa/`:
1. `cel-historia-mediciones.png`: Historia clínica con observaciones reales y paginación.
2. `cel-perfil-corporal-avatar.png`: Perfil corporal con Avatar 3D y mediciones corporales reales.
3. `cel-perfil-corporal-evolucion.png`: Pestaña de evolución de peso y registros históricos.
4. `cel-perfil-corporal-personalizacion.png`: Pestaña de personalización estética del avatar.

---

## 5. Próximo Paso: Fase 8

Con la Fase 7 completada y validada en su totalidad:
- **Fase 8**: Nutrición y plan alimentario (plan diario del paciente, registro fotográfico y conexión con Food AI Service `:8010`).

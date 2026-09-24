# FASE 11 — Notificaciones Push FCM y Centro de Avisos de Salud In-App: Informe de Integración

> **Change OpenSpec**: `app-fase-11-notificaciones`
> **Fecha**: 2026-09-24
> **Estado**: Completada e integrada (Backend + APP móvil + suites en verde + E2E verificado en vivo)

---

## 1. Resumen Ejecutivo

La Fase 11 dota a la aplicación móvil `antares-paciente` y al backend `coppAddresdBack` de un canal centralizado de avisos de salud in-app y soporte de notificaciones push FCM, complementando el programa clínico y mejorando la adherencia del paciente:

1. **Centro de Avisos In-App Reactivo**: Conexión de la campana superior en el encabezado de `HomePage.tsx` con apertura de modal deslizable (`NotificationsModal.tsx`), insignia numérica flotante (`unreadCount`) y agrupación temporal intuitiva (*"Hoy"* y *"Esta semana"*).
2. **Acceso Seguro Anti-IDOR por JWT**: Rutas de notificaciones en `ProgramController.cs` (`GET /api/v1/program/notifications` y `GET /api/v1/program/me/notifications`) habilitadas para pacientes móviles (`aud="app"`) sin requerir permisos de personal médico (`Program.View`). El `patientId` se extrae exclusivamente del token JWT vía `IProgramActorContext`.
3. **Lectura y Sincronización Optimista**: Marcado de avisos leídos (`POST /api/v1/program/notifications/{id}/read`) con actualización inmediata en cache local de React Query y validación anti-IDOR estricta en base de datos (404 inmediato si el aviso no pertenece al paciente).
4. **Siembra Idempotente de Avisos Demo**: Integración en `DevProgramSeeder.cs` para el paciente de prueba (`55551234` / `Luis Prueba Movil`), garantizando 3 avisos clínicos iniciales (cita médica próxima, hidratación y meta de racha alcanzada).
5. **Elevación Visual y Ergonomía Móvil (front-artisan)**: Tarjetas bento blancas con borde sutil `var(--bd)`, radio de curvatura de 22px, puntos de no leído, iconos pastel según categoría clínica, tipografía Space Grotesk para marcas de tiempo relativas y touch targets ergonométricos de al menos 44px. Verificación con Playwright a 390×844.

---

## 2. Cambios en Backend (`coppAddresdBack`)

### 2.1 Autorización de Paciente y Rutas en `ProgramController.cs`

- Se eliminó el atributo `[RequirePermission("Program.View")]` de los métodos:
  - `ListNotifications`: accesible con solo `[Authorize]` para tokens con audiencia `app`.
  - `MarkNotificationRead`: marcado individual de avisos.
- Se agregó el alias `[HttpGet("me/notifications")]` alineado a la convención estándar `me/*` del backend.
- Anti-IDOR garantizado: si el usuario autenticado no posee perfil de paciente, el endpoint responde `404 Not Found` en lugar de exponer registros ajenos.

### 2.2 Siembra Demo y Corrección de Datos (`DevProgramSeeder.cs`)

- Se implementó `SeedDemoNotificationsAsync`:
  - `appointment_reminder` (Prioridad: `high`): recordatorio de cita clínica en 1 hora.
  - `hydration_reminder` (Prioridad: `normal`): meta de consumo de agua diaria.
  - `streak_milestone` (Prioridad: `normal`): hito de 7 días continuos en el programa.
- La ejecución del seeder se priorizó de forma protegida para ejecutarse inmediatamente tras asegurar los perfiles de paciente.
- **Normalización de Base de Datos**: Se corrigieron valores históricos en la columna `category` de la tabla `app.media_items` que contenían strings no mapeados (`'Podcast'`, `'Video'`), asignándolos a valores canónicos del enum `MediaCategory` (`Habitos`, `SaludFisica`, `Nutricion`, `BienestarEmocional`).

### 2.3 Pruebas Automatizadas Backend

- **`CoppAddresd.UnitTests`**:
  - `PatientNotificationsTests.cs` (13 pruebas unitarias pasando al 100%):
    - Acceso exitoso con cálculo de `unreadCount`.
    - Resolución de `patientId` a partir del actor context.
    - Rechazo con 404 para usuarios sin perfil.
    - Verificación anti-IDOR al marcar lectura.
    - Idempotencia y completitud de la siembra demo.
  - Suite general de pruebas unitarias: **915 pruebas pasando, 0 fallos**.

---

## 3. Cambios en Frontend (`antares-paciente`)

### 3.1 Tipos y Servicio de Transporte (`notifications-service.ts`)

- `src/services/notifications/types.ts`: Definición de interfaces `InAppNotification` y `PaginatedNotificationsResult`.
- `src/services/notifications/notifications-service.ts`:
  - `fetchNotifications(page, pageSize)`: Consulta paginada a través de `apiFetch` hacia `/api/v1/program/notifications`. Incorpora normalizador defensivo capaz de recibir payloads tanto con estructura `data`/`total` como `items`/`totalCount`.
  - `markNotificationRead(id)`: Llamada a `/api/v1/program/notifications/{id}/read`.

### 3.2 Hook Reactivo `useNotifications` (`useNotifications.ts`)

- Implementado con `@tanstack/react-query` y clave centralizada `notificationsKeys.list(page, pageSize)`.
- `staleTime: 60_000` ms para evitar peticiones repetitivas innecesarias.
- `markAsRead`: Actualización optimista de la cache de React Query que decrementa `unreadCount` y asigna `readAt` al instante.
- `markAllAsRead`: Marcado en lote secuencial en backend y actualización en una sola pasada en el cliente.
- Manejo honesto de errores: ante fallos de red en refetch se conserva la lista en cache para no despojar al paciente de su contexto (patrón `useMetricsHistory`).

### 3.3 Componente `NotificationsModal.tsx` y Campana de Cabecera

- `NotificationsModal.tsx`:
  - Despliegue en hoja móvil (`IonModal` con `breakpoints: [0, 0.9, 1]`).
  - Agrupación por antigüedad: *"Hoy"* (últimas 24 horas) y *"Esta semana"*.
  - Iconos temáticos diferenciados por categoría clínica (`calendarOutline`, `waterOutline`, `flameOutline`, `chatbubblesOutline`, `nutritionOutline`).
  - Deep-links clínicos que navegan directamente a Citas (`book`), Nutrición (`nut`), Chat Clínico (`chat`) o Comunidad (`com`).
  - Botón de acción masiva *"Marcar todas como leídas"*.
- `HomePage.tsx`:
  - Icono de campana en cabecera enriquecido con `IonBadge` flotante (formato `99+` para conteos elevados).
  - Eliminado el toast genérico previo; ahora abre suavemente el centro de avisos.

### 3.4 Pruebas y Control de Calidad Frontend

- **Vitest Suite**: **90 archivos de prueba, 707 pruebas unitarias pasando al 100%**.
- **Linter**: `npm run lint` ejecutado sin errores.
- **Internacionalización**: `npm run i18n:check` verificado con 0 claves faltantes en español e inglés.
- **Build de Producción**: `npm run build` completado en 1.5s sin discrepancias.

---

## 4. Elevación Visual y Ergonomía Móvil (`front-artisan`)

- **Bento Cards de Avisos (`.nt-card`)**:
  - Fondo blanco puro, radio de 22px, bordes de 1px con `var(--bd)`.
  - Punto indicador verde esmeralda para notificaciones no leídas.
  - Micro-interacción `:active` con escala `scale(0.92)`.
  - Targets táctiles de 44×44px mínimo para botones de acción y cierre.
- **Tarjetas de Eventos y Vivos de Clubes (`ClubsSection.tsx`)**:
  - Bento cards elevadas con `DatePill` de 60×68px en tipografía Space Grotesk.
  - Gradientes semánticos por modalidad (azul/púrpura para eventos presenciales, cian/verde azulado para virtuales).
- **Validación Visual con Playwright**: Capturas en modo móvil (390×844) en `$env:LOCALAPPDATA\Temp\opencode\notifications-ui` confirmando legibilidad, contraste y cero desbordes horizontales.

---

## 5. Verificación E2E en Vivo

Se realizaron pruebas de integración reales consumiendo el Gateway (`http://127.0.0.1:5080`) con el usuario de pruebas `55551234` / `Demo1234!`:

| Paso | Acción | Endpoint | Resultado Esperado | Resultado Real |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Autenticación de Paciente | `POST /api/auth/login` | Token JWT con `aud="app"` | `200 OK` (Token emitido) |
| 2 | Consulta de Centro de Avisos | `GET /api/v1/program/notifications` | Lista de 3 avisos y `unreadCount: 3` | `200 OK` (3 ítems, unreadCount=3) |
| 3 | Marcado de Aviso Leído | `POST /api/v1/program/notifications/{id}/read` | `204 No Content` | `204 No Content` |
| 4 | Re-consulta de Estado | `GET /api/v1/program/notifications` | `unreadCount` disminuido a `2` | `200 OK` (unreadCount=2, `readAt` con timestamp ISO) |
| 5 | Anti-IDOR | `POST /api/v1/program/notifications/{guid_ajeno}/read` | Error 404 | `404 Not Found` |

---

## 6. Registro de Commits

- **`coppAddresdBack`**:
  - `c8ef702`: `feat(notifications): enable patient access to in-app notifications and add unit tests`
  - `5046987`: `fix(seed): prioritize demo notifications seeding in DevProgramSeeder`
- **`antares-paciente`**:
  - `2da9bc4`: `feat(community-ui): elevate club event and live cards to premium bento`
  - `1d24fcd`: `feat(notifications): implement in-app notification center, reactive hook and service`
  - `d4d77f1`: `fix(notifications): normalize paginated data and items response`

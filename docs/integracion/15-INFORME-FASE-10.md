# FASE 10 — Comunidad, Clubes Clínicos y Red de Salud: Informe de Integración

> **Change OpenSpec**: `app-fase-10-comunidad`
> **Fecha**: 2026-09-24
> **Estado**: Completada e integrada (Backend + APP móvil + suite completa en verde)

---

## 1. Resumen Ejecutivo

La Fase 10 conecta integralmente la experiencia comunitaria y social del paciente con el backend y ERP, transformando el módulo de Comunidad en una red de salud asistida y segura:

1. **Clubes Clínicos del Sistema**: Siembra y auditoría de los 5 clubes oficiales del sistema COPP-ADRESD (Nutrición Inteligente, Reto Caminata, Salud Mental y Hábitos) con publicaciones, eventos virtuales y presenciales, y encuestas clínicas.
2. **Seguridad y Resolución Anti-IDOR por JWT**: Blindaje de las mutaciones de GraphQL (`joinClubDirect`, `leaveClub`, `createPost`, `likePost`, `unlikePost`, `votePoll`, `reportPost`) mediante `[Authorize]` y extracción del perfil vinculado al `UserId` del token JWT. Auto-provisión de perfil de comunidad para pacientes recién registrados.
3. **Privacidad PHI Preventiva**: Banner interactivo de advertencia preventiva de privacidad en `ComposePostModal.tsx` que orienta al paciente a no compartir datos sensibles de su historia clínica, números de identificación ni resultados confidenciales.
4. **Recomendador Inteligente de Clubes**: En `ClubsSection.tsx` y `club-recommendations.ts`, los clubes afines al plan de salud, diagnóstico o hábitos del paciente se destacan automáticamente con un badge sutil de *"Recomendado para ti"*.
5. **Compartir Logros y Rachas**: Componente `AchievementCard.tsx` que permite llevar hitos del programa (semanas completadas, rachas de hidratación, badges de constancia) hacia el muro comunitario con diseño de tarjeta visual enriquecida y XP.
6. **Elevación Visual y Ergonomía Móvil (front-artisan)**: Rediseño visual de las tarjetas de publicación (`PostCard.tsx` y `.com-post`), esquinas redondeadas modernas (`radius 22`), imágenes de medios contenidas (`border-radius: 16px`), barra de acciones táctiles (targets ≥44px con microanimación `scale(0.92)` y contadores en tipografía Space Grotesk). Validación visual Playwright en viewport móvil (390×844).

---

## 2. Cambios en Backend (`coppAddresdBack`)

### 2.1 Blindaje y Resolución de Identidad en Mutaciones (`ClubMutation.cs` y `CommunityMutation.cs`)

- Se reforzó `[Authorize]` y `RequireMyProfileAsync(db, http, ct)` en todas las mutaciones de clubes y comunidad:
  - `joinClubDirect(clubId)` / `requestMembership(clubId)`: Inscribe al paciente autenticado con rol `Miembro` y estado `Activo`, verificando la cuota máxima y evitando sobre-inscripción.
  - `createPost(...)`: Crea publicaciones generales asignando automáticamente el `ProfileId` del paciente autenticado sin aceptar perfiles ajenos en el payload.
  - `likePost(postId)` / `unlikePost(postId)`: Gestiona las reacciones del paciente vinculado al JWT actualizando los rollups de métricas de forma transaccional.
  - `reportPost(postId, reason, details)`: Registra reportes de moderación asignando el autor del reporte por token JWT.
- **Auto-provisión de Perfil**: Si un paciente autenticado interactúa por primera vez con la comunidad, el backend resuelve su perfil a partir de su cuenta de usuario sin fallar con errores de clave foránea huérfana.

### 2.2 Semillas de Clubes del Sistema (`ClubSeeder.cs`)

- Siembra idempotente en el arranque de `CoppAddresd.Community` para garantizar la presencia de los 5 clubes oficiales:
  - `caminantes-adres` / `reto-caminata`: Club de movimiento y actividad física.
  - `cocina-saludable` / `nutricion-inteligente`: Club de educación nutricional y recetas.
  - `apoyo-emocional` / `salud-mental-conversa`: Club de bienestar emocional y resiliencia.
  - `comunidad-general` / `comunidad-adres`: Canal oficial del programa COPP-ADRESD.
  - `solo-inactivos`: Espacio de reactivación y motivación.
- Inclusión de posts demo, encuestas con opciones múltiples, eventos con URLs virtuales (`https://meet.coppaddresd.com/...`) y conteos de cupos.

### 2.3 Pruebas Backend

- **`CoppAddresd.Community.UnitTests`**: **132 pruebas pasando al 100%** (0 fallos, 10 skipped de backfill de integración).
  - `ClubMutationIdentityTests.cs`: Pruebas de resolución de identidad, rechazo de claims falsos o vacíos y validación de reglas de membresía.
  - `OfficialClubsSeedTests.cs`: Pruebas de idempotencia de siembra, consistencia de slugs y preservación de membresías preexistentes.
- **`CoppAddresd.UnitTests`**: **898 pruebas pasando al 100%**.

---

## 3. Cambios en Frontend (`antares-paciente`)

### 3.1 Advertencia Preventiva de Privacidad PHI (`ComposePostModal.tsx`)

- Banner con icono `shieldCheckmarkOutline`, borde suave ámbar/teal y texto i18n (`t("Cuida tu privacidad: recuerda no compartir datos de historia clínica...")`).
- Visible de forma no invasiva sobre el área de redacción para concientizar antes de publicar.

### 3.2 Recomendador de Clubes Clínicos (`club-recommendations.ts` & `ClubsSection.tsx`)

- `src/utils/club-recommendations.ts`: Función pura `getRecommendedClubSlugs(patientContext)` que asigna afinidad según:
  - Condiciones metabólicas / diabetes → Nutrición y Diabetes en Control.
  - Programa de actividad física / sobrepeso → Reto Caminata y Caminantes.
  - Estrés o temperamento melancólico → Apoyo Emocional y Salud Mental.
- En `ClubsSection.tsx`: Los clubes recomendados reciben un badge visible *"Recomendado para ti"* y se priorizan visualmente en la cuadrícula bento.

### 3.3 Compartir Logros y Rachas (`AchievementCard.tsx`)

- Componente accesible para transformar hitos de las Fases 4, 5 y 8 (rachas de hábitos, misiones completadas, vasos de agua) en tarjetas ricas para el feed:
  - Ícono dinámico según el tipo (`trophy`, `water`, `flame`, `ribbon`).
  - Puntos de experiencia (XP) otorgados.
  - Botón táctil para compartir en el muro general o en un club específico.

### 3.4 Elevación Visual y Ergonomía (`front-artisan`, commit `01a05d8`)

- **Tarjetas de Publicación (`.com-post`)**: Fondo blanco nítido, borde `var(--bd)`, sombra suave `var(--shadow-sm)` y radio de curvatura de 22px coherente con las tarjetas de Inicio (`.hm-*`).
- **Medios (`.com-post-media img`)**: Bordes redondeados de 16px con márgenes laterales alineados.
- **Barra de Acciones (`button.com-act-btn`)**: Touch targets con altura mínima de 44px, padding ergonómico (7px 12px), iconos proporcionados a 24px (en vez de 31px desbordantes), microanimación activa `scale(0.92)` y contadores en Space Grotesk 13.5px.
- **Validación Playwright**: Capturas en `C:\Users\Luis\AppData\Local\Temp\opencode\com-post-cards\` confirmando cero desbordes horizontales en viewport móvil de 390×844.

---

## 4. Batería de Pruebas y Verificaciones

| Comprobación | Herramienta / Comando | Resultado |
|---|---|---|
| **Tests Móvil** | `npm test` | **681 pasados (87 archivos, 100%)** |
| **Linting Móvil** | `npm run lint` (`oxlint`) | **0 errores** |
| **i18n Móvil** | `npm run i18n:check` | **0 claves faltantes** |
| **Build Móvil** | `npm run build` (`vite build`) | **Exitoso en 1.20s** |
| **Tests Backend Community** | `dotnet test tests/CoppAddresd.Community.UnitTests` | **132 pasados (100%)** |
| **Tests Backend General** | `dotnet test tests/CoppAddresd.UnitTests` | **898 pasados (100%)** |
| **Gateway E2E GraphQL** | `POST :5080/api/v1/community/graphql` | **200 OK con JWT Bearer** |
| **Mutaciones Seguras** | `joinClubDirect`, `createPost`, `likePost`, `reportPost` | **200 OK validadas en vivo** |

---

## 5. Guía de Prueba Manual para el Usuario

1. Iniciar sesión en la app móvil con credenciales demo (`55551234` / `Demo1234!`).
2. Navegar a la pestaña **Comunidad**.
3. **Revisar Feed**: Observar el nuevo diseño de las publicaciones con avatares nítidos, imágenes contenidas con bordes curvos y botones de like/comentario con respuesta táctil fluida.
4. **Probar Interacción**: Dar like a una publicación y notar el conteo en tipografía Space Grotesk.
5. **Crear Publicación**: Tocar el botón flotante `+`. Notar el banner superior de advertencia sobre no publicar datos médicos sensibles (PHI).
6. **Explorar Clubes**: Cambiar al segmento de **Clubes**. Verificar los 5 clubes oficiales sembrados y el badge *"Recomendado para ti"* en el club afín a la condición de salud.
7. **Unirse a un Club**: Tocar "Unirse" en un club público y verificar la confirmación inmediata.

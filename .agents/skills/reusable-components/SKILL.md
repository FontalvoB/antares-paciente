---
name: reusable-components
description: Componentes reutilizables de ANTARES Paciente. Clasificación (Ionic / Domain / Layout / Primitive), cuáles existen, regla anti-duplicación y cuándo crear vs reutilizar. Cargar antes de crear cualquier componente nuevo.
---

# Componentes reutilizables — ANTARES Paciente

## Clasificación de componentes (decidir ANTES de crear)

| Tipo | Qué es | Ejemplos | Regla |
|---|---|---|---|
| **Ionic Component** | Ionic ya resuelve la necesidad | `IonButton`, `IonInput`, `IonModal`, `IonToast`, `IonTabs` | **Usarlo directo.** No crear wrapper sin razón (un wrapper SOLO se justifica si añade tokens de dominio consistentes y se usa en 3+ lugares) |
| **Domain Component** | Componente específico del negocio ANTARES, compone Ionic/custom | `PatientCard`, `AppointmentCard`, `MedicalRecordCard`, `PatientHeader`, `MealCard`, `PostCard` | Crear cuando el bloque de negocio se repite (3+ usos o 2 con variaciones) |
| **Layout Component** | Estructura visual de la app | `Screen`, `Scroll`, `BottomNav`, `DashboardLayout`, `AuthLayout`, `MobileHeader`, `DesktopSidebar` | Crear para estructura; NO poner lógica de negocio |
| **Primitive Component** | Pieza mínima sin equivalente Ionic adecuado | `ScaleList`, `ChipGrid` (existen), OTP cell, ring SVG | **ÚLTIMO recurso.** Solo cuando Ionic no tiene solución razonable. Documentar por qué en el archivo |

> **ESTADO RECOMENDADO:** nuevo código → Ionic Component primero; Domain/Layout solo cuando aporten; Primitive solo con justificación. **ESTADO ACTUAL:** hay custom (`.btn`, `.card`, `.prow`, overlays) que la auditoría documenta para migración futura — no crear MÁS custom; los nuevos deben ser Ionic-first.

## Componentes compartidos existentes (usar SIEMPRE primero)

| Componente | Export | Dónde | Uso |
|---|---|---|---|
| `Screen` | `{ Screen, Scroll }` | `src/components/Screen.tsx` | Envoltorio de toda página: animación framer-motion + `BottomNav` automático (`hideNav`, `darkNav`) |
| `Scroll` | ídem | ídem | Área scrolleable con padding para nav (`noNav` si no hay nav) |
| `BottomNav` | `BottomNav` | `src/components/BottomNav.tsx` | Barra inferior 5 tabs (`home,book,nut,chat,prof`) + SOS (lo monta `Screen`) |
| `useApp` | hook | `src/context/AppContext.tsx` | Todo estado global y acciones (`navigate`, `showToast`, `pointsTotal`) |
| `LanguageToggle` | `LanguageToggle` | `src/components/LanguageToggle.tsx` | Selector es/en — va en login (`.auth-lang`), headers de pantalla (`.hm-chips`) y páginas |
| `CTABanner` | `CTABanner` | `src/components/CTABanner.tsx` | Banner CTA con gradiente + icono + título + subtítulo (extraído de HomePage) |
| `ProtocolWheel` | `ProtocolWheel` | `src/components/ProtocolWheel.tsx` | Rueda del protocolo diario (ring con segmentos) — se usa en HomePage (`hm-wheel-card`) |
| `MetricHistoryModal` | `MetricHistoryModal` | `src/components/MetricHistoryModal.tsx` | Historial de un indicador de salud (`IonModal`) — lo abre HomePage |
| `ScaleList` / `ChipGrid` | `{ ScaleList, ChipGrid }` | `src/components/Forms.tsx` | Preguntas de escala (tests) y chips de selección múltiple |
| `ToastHost` | `ToastHost` | `src/components/ToastHost.tsx` | Toast global (montado en `App.tsx`) — **YA usa `IonToast`** (migrado) |

## Cómo usar

```tsx
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
```

1. Toda página: `<Screen><Scroll>…</Scroll></Screen>` (ver `HomePage.tsx:213-214`).
2. Estado/acciones compartidas: `const { navigate, showToast, pointsTotal } = useApp()`.
3. Tests: `ScaleList` + `ChipGrid` (`TestsPage.tsx:19-20`).

## Regla anti-duplicación (obligatoria)

> Antes de crear `NewButton`, `CustomButton`, `AppButton`, `PrimaryButton` (o `XInput`, `XCard`, `XModal`, `XAlert`, `XSelect`, `XTabs`, `XList`, `XLoader`, `XToast`…) → buscar primero el componente Ionic equivalente (`IonButton`, `IonInput`, …) en la matriz de `ionic-components`. Si existe → NO crear wrapper; usarlo directo.

Misma regla para: inputs, cards, modales, alerts, selects, tabs, listas, navegación, loaders y feedback.

Solo se permite wrapper propio si: (a) Ionic no cubre la necesidad, O (b) el wrapper añade el design system de forma consistente y se usa en 3+ sitios.

## Patrones DUPLICADOS detectados en auditoría (candidatos a extraer)

| Patrón duplicado | Ocurrencias | Sugerencia |
|---|---|---|
| Card módulo (`card card-accent` + `ico` + `ct` + `cs`) | HomePage accesos (`grid-2`), InfinitoPage, AcademyPage | Crear `ModuleCard` |
| Fila de lista (`prow`/`row-card`/`group-row` con icono + texto + chevron) | ProfilePage, CommunityPage, HomePage (`group-list`) | MIGRACIÓN FUTURA: `IonList`/`IonItem` (o crear `ListRow` Domain) |
| Header de página (hero + chips) | todas las pages | Mantener patrón `hero hero-X` + `.chips` (CSS ya centralizado) |
| Botón con icono circular | ChatPage, VoiceOverlay | `IonButton` `fill="clear"` round |
| Barra de progreso | ~8 pages (`.ptrack/.pfill`) | MIGRACIÓN FUTURA: `IonProgressBar` |
| Botón píldora con icono + label + chevrons | LoginPage (3 usos: `cta-pill`) | Ya centralizado en `global.css` (`.cta-pill`), no extraer a componente — variante de `IonButton` |

> Los banners CTA de HomePage (pánico/voz/programa) YA se extrajeron a `CTABanner.tsx` — no duplicar.

## Reglas

1. **Buscar antes de crear**: `src/components/` + tabla existentes + matriz Ionic.
2. **Tres usos = componente**: 3+ lugares (o 2 con variaciones) → extraer a `components/`.
3. **No duplicar estilos**: clases nuevas a `theme/global.css`; si existe, reusar (`.card`, `.chip`, `.btn`, `.prow`, `.avatar`, `.ico`, `.ct`, `.cs`).
4. **Componente nuevo** → export nombrado en `components/`, sin lógica de negocio (props; estado global solo vía `useApp()`).
5. **Composición**: UI puros + páginas que orquestan (patrón `Screen`/`BottomNav`).
6. Tras extraer un patrón duplicado, reemplazar TODAS las ocurrencias (no dejar copias).
7. Al migrar: preferir el componente oficial Ionic ANTES que el wrapper propio.

## PENDIENTE DE VALIDACIÓN

- `MealCard`/`food-item` (NutritionPage) — candidato Domain si el plan se repite en otras pantallas.
- Componentes de comunidad (`PostCard`, `ComposePostModal`, `CreateGroupModal`, `MemberProfile`, `MediaLightbox`, `PostDetailModal`, `NewChatModal`, `ComSidebar`, `PollBlock`) — existen en `src/components/community/`; extraer/reutilizar si otra pantalla necesita feed social.

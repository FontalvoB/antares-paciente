---
name: ionic-responsive
description: Responsive / mobile-first en ANTARES Paciente. Reglas para que toda pantalla nueva funcione en móvil, tablet y desktop sin rehacer la UI: shell, safe areas, teclado virtual, orientación, scrolling, touch targets, gestos y Capacitor.
---

# Responsive / Mobile-first — ANTARES Paciente

La app es **mobile-first por diseño** y debe poder convertirse en app móvil real (Capacitor 8 ya instalado) **sin rehacer la UI**. El shell `app-shell` simula un teléfono (max 430px) en desktop y ocupa el 100 % en `<480px` (`theme/global.css:12-54`). Toda pantalla nueva DEBE respetar este modelo.

## Dimensiones objetivo

| Dispositivo | Comportamiento |
|---|---|
| Móvil (375-430px base) | Diseño principal — app a pantalla completa (`global.css:36-47`) |
| Tablet (≥768px) | Shell con frame; layouts multi-columna solo si aporta (`sizeMd` en `IonGrid` o CSS) — PENDIENTE de validar landscape |
| Desktop (≥481px) | Shell teléfono centrado con frame (`border-radius 40px`, `border 8px solid #111`, `global.css:49-54`) — NO rediseñar |

## Reglas obligatorias

1. **Mobile-first**: diseñar en ~375-430px; desktop = shell centrado, no rediseño.
2. **Touch targets ≥ 44px** (estándar iOS; `.btn` usa `min-height: 48px` — mantener). Tabs, chips y controles táctiles igual.
3. **Nada depende de hover**: todo estado interactivo con `:active`/`:focus-visible` (patrón global.css:273-275, 362-364).
4. **Safe areas**: `env(safe-area-inset-top/bottom)` en headers fijos, nav, footers y overlays — patrón ya aplicado: `.hero` (global.css:84), `.bnav` (global.css:428-442), `.overlay` (global.css:508-518), sticky footers (OnboardingPage:371, TestsPage:289). Todo elemento fijo nuevo DEBE usar safe areas.
5. **Teclado virtual**: `IonInput`/`IonTextarea` (auto scroll-into-view al enfocar); `capacitor.config.ts` ya configura `Keyboard.resize: 'body'` ✓. Usar `inputmode` y `enterkeyhint` correctos por campo. NO `user-scalable=no`/`maximum-scale=1` (index.html:8 los tiene — PENDIENTE de corrección, WCAG 1.4.4).
6. **Viewport**: no añadir meta de zoom bloqueado; respetar `viewport-fit=cover` (necesario para safe areas).
7. **Orientación**: diseñar portrait primero; validar landscape (especialmente `.bnav` fijo y `.app-stage`).
8. **Scrolling**: una sola columna vertical; `.screen-scroll` con `overflow-x: hidden` (global.css:69); padding-bottom para `--nav-h` (global.css:65-72). Sin scroll horizontal.
9. **Gestos**: swipe/pull-to-refresh (`IonRefresher`) solo si el usuario lo pide; no inventar gestos que compitan con scroll nativo o navegación.

## Herramientas disponibles

### Patrón actual del proyecto (preferido para consistencia)

- Layout 2 columnas: `.grid-2` (`global.css:255-260`) — cards de módulos, métricas.
- `display:flex` con `gap` para filas (patrón dominante en pages).
- `.kpi-strip` grid 4 columnas en Home (`global.css:202-208`).

### Ionic Grid (cuando aplique)

```tsx
import { IonGrid, IonRow, IonCol } from '@ionic/react'
<IonGrid>
  <IonRow>
    <IonCol size="6" sizeMd="4">…</IonCol>
  </IonRow>
</IonGrid>
```

- Útil en tablet/desktop (`sizeMd`, `sizeLg`). Para la app actual (una columna telefónica) el CSS grid existente es suficiente — no forzar.

## Breakpoints reales del proyecto

| Rango | Comportamiento |
|---|---|
| ≤480px | App a pantalla completa (`global.css:36-47`) |
| ≥481px | Shell teléfono con frame (`global.css:49-54`) |
| ≥768px | (PENDIENTE) tablet — validar antes de usar |

No introducir más breakpoints sin necesidad real.

## Checklist por pantalla nueva

- [ ] Compila en móvil y desktop (shell centrado, sin overflow horizontal)
- [ ] Safe areas en header/bottom elements (`env(safe-area-inset-*)`)
- [ ] Touch targets ≥44px; sin hover-only interactions
- [ ] Texto legible ≥11px (patrón del proyecto: 11-15px, headers 18-22px)
- [ ] Scroll vertical con `.screen-scroll`, padding-bottom para `--nav-h`
- [ ] Teclado: campos con `IonInput`/`IonTextarea` (o validar comportamiento manual)
- [ ] Estado visual en `:active`/`:focus-visible` para feedback táctil
- [ ] Sin scroll horizontal (`.screen-scroll` tiene `overflow-x: hidden`)
- [ ] Overlays globales respetan safe-area-bottom (`.overlay`, global.css:516)
- [ ] Orientación portrait OK; landscape al menos no rompe layout
- [ ] Si hay campos: `inputmode`/`enterkeyhint` correctos
- [ ] Capacitor: nada que dependa de `pointer: fine` exclusivo

## PENDIENTE DE VALIDACIÓN

- Tablet landscape real (≥768px) — el diseño actual asume portrait; validar `app-stage` en landscape.
- Barra inferior en landscape iPhone (`.bnav` fijo — revisar en Capacitor).
- Visual Viewport en web cuando el teclado del móvil abre (IonInput lo resuelve).

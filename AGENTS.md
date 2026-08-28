# ANTARES Paciente — Guía de Agentes (frontend)

App móvil **React 19 + Ionic 8.8 + Capacitor 8 + Vite + TS** del programa COPP-ADRESD. Demo funcional mobile-first, sin backend integrado.

## Regla principal

**Este es un proyecto Ionic React.** Antes de cualquier cambio: cargar la skill `ionic-rules` (reglas globales + regla PRIORITARIA Ionic-first + BEFORE CODING + Definition of Done) y `ionic-architecture` (estructura). Si la tarea toca componentes visuales, formularios, navegación, overlays, responsive o tema, cargar la skill correspondiente (abajo).

**Regla prioritaria (resumen):** antes de crear cualquier elemento de UI con HTML nativo, CSS custom o librería externa → verificar si Ionic tiene equivalente (matriz de decisión en `ionic-components`). Si existe → usarlo. No aplica a: decorativos, gráficos bespoke, componentes de dominio, layouts de identidad (detalle en `ionic-components` §Excepciones).

## Skills del proyecto (`.agents/skills/`)

| Skill | Cuándo |
|---|---|
| `ionic-rules` | SIEMPRE — reglas globales, Ionic-first, BEFORE CODING, Definition of Done |
| `ionic-architecture` | SIEMPRE antes de trabajo sustancial |
| `ionic-components` | antes de crear CUALQUIER elemento visual — matriz de decisión Ionic |
| `reusable-components` | antes de crear cualquier componente — clasificación Ionic/Domain/Layout/Primitive + anti-duplicación |
| `ionic-forms` | formularios, inputs, validación, estados, teclado móvil |
| `ionic-navigation` | cambiar pantallas, tabs — estado de UI vs navegación real (router = MIGRACIÓN FUTURA) |
| `ionic-overlays` | modales, toasts, alerts, loading, popover, action sheet |
| `ionic-responsive` | cualquier pantalla nueva (mobile-first, tablet, safe areas, gestos) |
| `ionic-theme` | colores, design system + convivencia con Ionic/Framer Motion, dark mode |
| `i18n-translations` | agregar cualquier texto visible — t() + es.json + en.json; correr `npm run i18n:check` antes de commitear |

## Estado real vs estado recomendado (no confundir)

- **ESTADO ACTUAL (verificado):** navegación por state machine en `AppContext` (`flow` + `screen`), SIN react-router (instalado ^7.18.2 pero sin imports). Solo `IonApp`, `IonIcon`, `setupIonicReact({mode:'ios'})`, CSS bundles y variables `--ion-*`. Todo lo demás es HTML/CSS custom (botones, inputs, toasts, overlays, tabs).
- **ESTADO RECOMENDADO:** todo desarrollo NUEVO con componentes Ionic (matriz en `ionic-components`): `IonButton`, `IonInput`, `IonSelect`, `IonModal`, `IonToast`, `IonAlert`, `IonLoading`, `IonTabs`, `IonList`, `IonProgressBar`, `IonDatetime`, etc.
- **MIGRACIÓN FUTURA (NO ejecutar):** router (`IonReactRouter`/`IonRouterOutlet`), migración del custom existente, dark mode, estados empty/error, persistencia. Requieren autorización explícita.
- **Datos**: 100 % simulados (contexto + `data/tests.ts`). Sin servicios, sin persistencia.
- **Dark mode**: no existe. **Estados empty/error**: no existen (crearlos en código nuevo).
- **Design system**: tokens en `src/theme/variables.css`, estilos en `src/theme/global.css`. Fuentes Inter + Space Grotesk. Framer Motion para animación de contenido — NO para reemplazar comportamiento Ionic.

## Commands

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run sync       # build + npx cap sync
```

## BEFORE CODING (obligatorio)

Antes de escribir código de UI: 1) leer AGENTS.md, 2) cargar skills relevantes, 3) buscar componentes existentes en `src/components/`, 4) buscar equivalente Ionic (matriz en `ionic-components`), 5) revisar design system (`ionic-theme`), 6) revisar patrones existentes, 7) solo después implementar. Verificar con la Definition of Done de `ionic-rules`.

## Flujo

onboarding 5 pasos (OTP demo `123456`) → tests de salud (9, saltables con *Después*) → app (Inicio, Citas, Historia, Nutrición, Academia, INFINITO, Reloj, Chat IA, Perfil, Programa, Comunidad, SOS, agente de voz).

## Docs

- `docs/auditoria.md` — auditoría completa + catálogo de componentes Ionic (leer antes de migrar algo).

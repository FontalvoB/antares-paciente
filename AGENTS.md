# ANTARES Paciente — Guía de Agentes (frontend)

App móvil **React 19 + Ionic 8.8 + Capacitor 8 + Vite + TS** del programa COPP-ADRESD. En transición demo→producción: auth, citas, perfil, programa, tests de salud, nutrición/Food AI, chat IA, comunidad y push YA consumen el backend real (vía Gateway `:5080`, JWT `aud=app`); quedan módulos mock listados en `docs/integracion/01-FASE-0-AUDITORIA.md`.

## Integración con el backend (LEER PRIMERO para tareas de conexión)

- **Plan maestro por fases**: `docs/integracion/00-PLAN-MAESTRO.md` — orden por dependencias, DoD por fase.
- **Auditoría FASE 0** (mapa APP↔API↔BD↔ERP, gaps, mocks, seeds, riesgos): `docs/integracion/01-FASE-0-AUDITORIA.md`.
- **Contrato de trabajo**: `../PROMPT_INICIAL_APP.md` (una fase a la vez, STOP para validación, seeds idempotentes en el backend, Grill Me para reglas de negocio).

## Regla principal

**Este es un proyecto Ionic React.** Antes de cualquier cambio: cargar la skill `ionic-rules` (reglas globales + regla PRIORITARIA Ionic-first + BEFORE CODING + Definition of Done) y `ionic-architecture` (estructura). Si la tarea toca componentes visuales, formularios, navegación, overlays, responsive o tema, cargar la skill correspondiente (abajo).

**Regla prioritaria (resumen):** antes de crear cualquier elemento de UI con HTML nativo, CSS custom o librería externa → verificar si Ionic tiene equivalente (matriz de decisión en `ionic-components`). Si existe → usarlo. No aplica a: decorativos, gráficos bespoke, componentes de dominio, layouts de identidad (detalle en `ionic-components` §Excepciones).

## Skills del proyecto (`.agents/skills/`)

| Skill                 | Cuándo                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `ionic-rules`         | SIEMPRE — reglas globales, Ionic-first, BEFORE CODING, Definition of Done                                 |
| `ionic-architecture`  | SIEMPRE antes de trabajo sustancial                                                                       |
| `ionic-components`    | antes de crear CUALQUIER elemento visual — matriz de decisión Ionic                                       |
| `reusable-components` | antes de crear cualquier componente — clasificación Ionic/Domain/Layout/Primitive + anti-duplicación      |
| `ionic-forms`         | formularios, inputs, validación, estados, teclado móvil                                                   |
| `ionic-navigation`    | cambiar pantallas, tabs — estado de UI vs navegación real (router = MIGRACIÓN FUTURA)                     |
| `ionic-overlays`      | modales, toasts, alerts, loading, popover, action sheet                                                   |
| `ionic-responsive`    | cualquier pantalla nueva (mobile-first, tablet, safe areas, gestos)                                       |
| `ionic-theme`         | colores, design system + convivencia con Ionic/Framer Motion, dark mode                                   |
| `i18n-translations`   | agregar cualquier texto visible — t() + es.json + en.json; correr `npm run i18n:check` antes de commitear |

## Estado real vs estado recomendado (no confundir)

- **ESTADO ACTUAL (verificado):** navegación por state machine en `AppContext` (`flow` + `screen`), SIN react-router (instalado ^7.18.2 pero sin imports). Solo `IonApp`, `IonIcon`, `setupIonicReact({mode:'ios'})`, CSS bundles y variables `--ion-*`. Todo lo demás es HTML/CSS custom (botones, inputs, toasts, overlays, tabs).
- **ESTADO RECOMENDADO:** todo desarrollo NUEVO con componentes Ionic (matriz en `ionic-components`): `IonButton`, `IonInput`, `IonSelect`, `IonModal`, `IonToast`, `IonAlert`, `IonLoading`, `IonTabs`, `IonList`, `IonProgressBar`, `IonDatetime`, etc.
- **MIGRACIÓN FUTURA (NO ejecutar):** router (`IonReactRouter`/`IonRouterOutlet`), migración del custom existente, dark mode, estados empty/error, persistencia. Requieren autorización explícita.
- **Datos**: mezcla real+mock — ver tabla de mocks en `docs/integracion/01-FASE-0-AUDITORIA.md` §1 (Home/History/BodyProfile/Onboarding aún usan `src/data/`). NO inventar endpoints: reutilizar los existentes o proponer gap al plan.
- **Dark mode**: no existe. **Estados empty/error**: no existen (crearlos en código nuevo).
- **Design system**: tokens en `src/theme/variables.css`, estilos en `src/theme/global.css`. Fuentes Inter + Space Grotesk. Framer Motion para animación de contenido — NO para reemplazar comportamiento Ionic.

## Commands

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run sync       # build + npx cap sync
```

## Modos de build iOS (development vs production)

El backend al que apunta la app lo decide **Vite al compilar**, no el instalador:

|           | `development` (device contra el Mac)           | `production` (TestFlight / release)              |
| --------- | ---------------------------------------------- | ------------------------------------------------ |
| Comando   | `npm run sync:dev`                             | `npm run sync`                                   |
| Modo Vite | `vite build --mode development`                | `vite build` (production)                        |
| Env       | `.env.development` → `http://10.50.30.99:5080` | `.env.production` → `https://erp.coppadresd.com` |
| Datos     | pacientes demo + seeds locales                 | datos reales (sin usuarios demo)                 |
| iOS extra | ATS + permiso de red local (solo dev)          | ninguno (https)                                  |

Verificación rápida de qué quedó embebido:

```bash
rg -o "10\.50\.30\.99:5080|erp\.coppadresd\.com" dist/assets/*.js | sort -u
```

**Credenciales demo contra el gateway local** (verificadas, `application: "app"`):
`32534534` / `Demo1234!` (paciente.prueba@mediquer.com) y `1000000001` / `Demo1234!`
(Juan Pérez). `Test@1234` del `.http` está obsoleto. Reset de una cuenta:
`POST /api/auth/internal/seed-demo-password` `{email,password}` con `X-Internal-Key`
(solo Development).

**Extras iOS del modo development** (no commitear; agregar localmente a
`ios/App/App/Info.plist` para probar http en el device, con el teléfono en la
misma red que el Mac):

```xml
<key>NSAppTransportSecurity</key>
<dict>
	<key>NSAllowsArbitraryLoads</key><true/>
	<key>NSAllowsLocalNetworking</key><true/>
</dict>
<key>NSLocalNetworkUsageDescription</key>
<string>Copp Adresd se conecta al servidor de desarrollo en tu red local durante las pruebas.</string>
```

Antes de archivar para TestFlight **revertir ese bloque** y validar con
`npm run release:check` (falla si el ATS de desarrollo sigue presente).

**Permisos nativos que deben estar commiteados en `Info.plist`** (aplican a dev
y a TestFlight; el CLI de Capacitor 8 **no** aplica `ios.infoPlist`, así que el
plist es la fuente operativa):

- `NSBluetoothAlwaysUsageDescription` + `NSBluetoothPeripheralUsageDescription`
  — sin ellas iOS **termina la app** al escanear/conectar el wearable.
- Cámara, micrófono y fotos (ya presentes).

Pendiente cuando la app deba recibir push en device/TestFlight: capability
_Push Notifications_ + _Background Modes ▸ Remote notifications_ en Xcode y la
APNs key en App Store Connect; sin eso `PushNotifications.register()` falla en
silencio (hoy no hay `App.entitlements`).

**Recarga en vivo** (opcional, dev): `npm run dev` + `CAP_LIVE_RELOAD=1 npx cap sync ios`
(el device carga `http://10.50.30.99:5173`; requiere los extras iOS de arriba).

**Checklist TestFlight**: `git pull` en main → `yarn install` → `npm run sync`
→ subir `CURRENT_PROJECT_VERSION` (`cd ios/App && xcrun agvtool new-version -all N`)
→ Xcode: scheme `App`, Any iOS Device, Product ▸ Archive ▸ Distribute App ▸
App Store Connect ▸ Upload → esperar _Processing_ en TestFlight → grupo de testers.

## BEFORE CODING (obligatorio)

Antes de escribir código de UI: 1) leer AGENTS.md, 2) cargar skills relevantes, 3) buscar componentes existentes en `src/components/`, 4) buscar equivalente Ionic (matriz en `ionic-components`), 5) revisar design system (`ionic-theme`), 6) revisar patrones existentes, 7) solo después implementar. Verificar con la Definition of Done de `ionic-rules`.

## Flujo

onboarding 5 pasos (OTP demo `123456`) → tests de salud (9, saltables con _Después_) → app (Inicio, Citas, Historia, Nutrición, Academia, INFINITO, Reloj, Chat IA, Perfil, Programa, Comunidad, SOS, agente de voz).

## Docs

- `docs/auditoria.md` — auditoría completa + catálogo de componentes Ionic (leer antes de migrar algo).

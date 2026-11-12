# ANTARES · App Paciente

App móvil de **ANTARES Biohacking** (programa COPP-ADRESD) construida con **React + Ionic + Capacitor**.

## Cómo correrla

```bash
cd antares-paciente
npm install
npm run dev
```

Abre `http://localhost:5173`. En escritorio se ve como un teléfono; en un móvil ocupa toda la pantalla con safe-areas.

## Flujo

1. **Onboarding** (5 pasos): identidad → OTP demo `123456` → familiar → consentimiento/firma → contraseña.
2. **Tests de salud** (9 evaluaciones). Puedes pulsar _Después_ para saltarlos.
3. **App principal** con módulos: Inicio, Citas, Historia, Nutrición, Academia, INFINITO, Reloj, Chat IA, Perfil, Programa del día, Comunidad, SOS y agente de voz.

## Capacitor (iOS / Android)

```bash
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

## Deploy iOS → TestFlight (CI/CD automatizado)

Push/merge a `dev` ejecuta el pipeline de GitHub Actions (validaciones → build
web → firma con Fastlane Match → archive → IPA → upload a TestFlight). Nada de
Xcode manual ni números de build a mano.

```bash
bundle install                  # dependencias de fastlane (una vez)
bundle exec fastlane ios check  # lint + tests + i18n + release:check
bundle exec fastlane ios beta   # flujo completo local hasta TestFlight
```

Guía completa (secretos, firma, rotación de credenciales, troubleshooting):
[`docs/IOS_CICD_TESTFLIGHT.md`](docs/IOS_CICD_TESTFLIGHT.md)

## Visibilidad de Citas

Citas está oculto por defecto; Nutrición ocupa su pestaña móvil. El código, los contratos y los datos de agenda se conservan. Para reactivarlo, compilar con `VITE_APPOINTMENTS_ENABLED=true`. La opción no activa enlaces de Nutrición en el chat: esa configuración es independiente.

Prueba de navegador con API simulada: `COP_E2E_APP_URL=http://localhost:5188 node e2e/appointments-hidden.mjs`. Para comprobar la reactivación contra un servidor con la opción habilitada: `COP_E2E_MODE=restored COP_E2E_APP_URL=http://localhost:5189 node e2e/appointments-hidden.mjs`. Los tests existentes del módulo se ejecutan con Citas habilitado en Vitest.

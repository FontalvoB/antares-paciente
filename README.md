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
2. **Tests de salud** (9 evaluaciones). Puedes pulsar *Después* para saltarlos.
3. **App principal** con módulos: Inicio, Citas, Historia, Nutrición, Academia, INFINITO, Reloj, Chat IA, Perfil, Programa del día, Comunidad, SOS y agente de voz.

## Capacitor (iOS / Android)

```bash
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

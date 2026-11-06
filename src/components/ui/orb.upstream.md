# Procedencia del Orb

Base oficial: ElevenLabs UI, commit `3a28ebab197f`, MIT (ver `orb.LICENSE`).

- Componente: https://raw.githubusercontent.com/elevenlabs/ui/3a28ebab197f/apps/www/registry/elevenlabs-ui/ui/orb.tsx
- Demo: https://raw.githubusercontent.com/elevenlabs/ui/3a28ebab197f/apps/www/registry/elevenlabs-ui/examples/orb-demo.tsx
- Docs: https://raw.githubusercontent.com/elevenlabs/ui/3a28ebab197f/apps/www/content/docs/components/orb.mdx
- Licencia: https://raw.githubusercontent.com/elevenlabs/ui/3a28ebab197f/LICENSE.md
- SHA256 fuente original: `16fdb804e37c495806091d34712e689f89c02b4638bb173ab5bef5e5eac52b91`.
- Textura exacta del upstream: https://storage.googleapis.com/eleven-public-cdn/images/perlin-noise.png
- SHA256 textura local: `6327c82c7700d6774794f7b06517e45bfedba50ef3b71abac280bd2595e98e6c`.

El 06-11-2026 se ejecuto `npx @elevenlabs/cli@latest components add orb`.
El registro devolvio HTTP 429; se uso el raw del pin autorizado. No hubo fichero
generado del CLI para comparar: el raw fijado es la base de esta copia.

Adaptaciones sobre el pin:

- Textura importada localmente por Vite; sin CDN en runtime.
- Imports directos de drei para evitar cargar componentes ajenos al orbe.
- Clase propia, sin Tailwind ni MutationObserver de dark mode.
- DPR 1..1.5 con PerformanceMonitor; Canvas fallback y notificacion de context loss.
- Limpieza del listener, parada del loop y renderer.dispose al desmontar.
- Interpolacion exponencial independiente de FPS; ataque 18/s y release 7/s.
- Rampa navy en lugar de negro; suavizado de pliegues .85, distorsion angular
  .18..0.5 y respiracion lenta/asimetrica dentro del loop de R3F.
- El wrapper VoiceOrb usa exclusivamente modo manual: SDK para output y
  WebAudio RMS para input. No activa la simulacion automatica del upstream.
- React.lazy, Suspense y error boundary en VoiceOrb; muted/unavailable y
  prefers-reduced-motion usan un gradiente estatico sin Canvas.

API comprobada en las versiones instaladas @elevenlabs/react 1.16.0 y
@elevenlabs/client 1.26.0: `useConversation().getOutputVolume(): number`.
El contrato VolumeProvider.getVolume es un escalar 0..1; `setVolume` es ganancia.
La entrada es el stream de permiso ya solicitado por la app, ahora medido con
AnalyserNode y liberado junto con AudioContext al cerrar. El SDK conserva su
propio stream de conversacion. Web Speech no expone nivel TTS: no se inventa
volumen de salida en ese fallback.

Las cuatro dependencias autorizadas ya estaban en dev: three 0.185.0,
@react-three/fiber 9.7.0, @react-three/drei 10.7.8, @types/three 0.185.4.
Se verifico package-lock.json con npm install --package-lock-only (sin diff),
y se reconcilio yarn.lock con Yarn Classic 1.22.22 y frozen-lockfile.
La generacion del lock se hizo en una carpeta aislada porque el packageManager
pnpm de C:/Users/Luis/package.json impide ejecutar Yarn Classic en este checkout.

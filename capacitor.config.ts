import type { CapacitorConfig } from "@capacitor/cli";
import manifest from "./package.json";

const config: CapacitorConfig = {
  appId: "com.coppadresd.app",
  appName: "Agentic Wellness IA",
  webDir: "dist",
  server: {
    // Dev: sin server.url → Capacitor carga el bundle local (webDir). En
    // producción se apuntará al gateway api.coppaddresd.com cuando exista.
    // Dev: 'http' para que no haya mixed-content con backends HTTP locales.
    // En producción se usa 'https' (el gateway AWS termina TLS).
    androidScheme: "http",
    // Recarga en vivo (solo desarrollo): con CAP_LIVE_RELOAD=1 el device carga
    // el dev server de Vite en la red local en vez del bundle embebido.
    // Uso: `npm run dev` + `CAP_LIVE_RELOAD=1 npx cap sync ios`.
    ...(process.env.CAP_LIVE_RELOAD
      ? {
          url: process.env.CAP_LIVE_RELOAD_URL ?? "http://10.50.30.99:5173",
          cleartext: true,
        }
      : {}),
  },
  // Cámara (consultas de telemedicina + análisis de comidas con
  // @capacitor/camera) y galería (selector de fotos de comidas).
  // Se aplican en `npm run sync`.
  ios: {
    // El plugin oficial solo se usa en Android. Su inicializador de iOS toma
    // el delegado de notificaciones, que aquí pertenece al router de Capacitor.
    includePlugins: Object.keys(manifest.dependencies).filter(name => name !== "@capacitor/health-fitness"),
    infoPlist: {
      // Permisos de Bluetooth: sin estas claves iOS mata la app al primer
      // acceso BLE. OJO: el CLI de Capacitor 8 NO aplica `ios.infoPlist` al
      // Info.plist (verificado con sync + grep); la fuente operativa es
      // ios/App/App/Info.plist, que sí sobrevive a `cap sync`. Se dejan aquí
      // como documentación/por si una versión futura del CLI sí las aplica.
      NSBluetoothAlwaysUsageDescription:
        "Copp Adresd no usa Bluetooth en esta versión. Si en el futuro se activa, solo se usará con tu permiso.",
      NSBluetoothPeripheralUsageDescription:
        "Copp Adresd no usa Bluetooth en esta versión. Si en el futuro se activa, solo se usará con tu permiso.",
      NSCameraUsageDescription:
        "Copp Adresd usa la cámara para las consultas de telemedicina y el análisis de comidas.",
      NSMicrophoneUsageDescription:
        "Copp Adresd usa el micrófono para las consultas de telemedicina.",
      NSPhotoLibraryUsageDescription:
        "Copp Adresd accede a tus fotos para analizar tus comidas.",
      NSPhotoLibraryAddUsageDescription:
        "Copp Adresd guarda las fotos de tus comidas para tu registro nutricional.",
    },
  },
  android: {
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
    ],
  },
  plugins: {
    LocalNotifications: { presentationOptions: ["banner", "list", "sound"] },
    // CapacitorHttp: en nativo, fetch pasa por HTTP nativo con el cookie jar
    // del SO — la cookie HttpOnly copp_refresh_token viaja sin importar el
    // SameSite=Lax de Development (WebView: origen http://localhost → gateway
    // LAN = cross-site). Las llamadas SSE (chat/stream, salas) hacen bypass
    // usando el fetch original del WebView (ver utils/threadApi.ts).
    CapacitorHttp: {
      enabled: true,
    },
    Keyboard: {
      // iOS: useKeyboardInset ajusta el viewport compartido de pantallas/modales.
      // "body" duplicaba el desplazamiento y dejaba un hueco sobre el teclado.
      resize: "none",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // Valor inicial antes de que cargue JS: la mayoría de pantallas tienen cabecera
      // clara (iconos oscuros = LIGHT). useStatusBarContrast lo ajusta por pantalla.
      style: "LIGHT",
      backgroundColor: "#FFFFFF",
    },
    // PushNotifications (@capacitor/push-notifications): no requiere
    // configuración JS. Para recibir notificaciones FCM reales hace falta el
    // trabajo de Firebase del usuario (fuera del alcance de código):
    //   - Android: android/app/google-services.json (proyecto Firebase + FCM)
    //   - iOS:     App/App/GoogleService-Info.plist (proyecto Firebase + APNs)
    // Luego: pnpm run sync && pnpm cap open <platform>. Mientras esos archivos
    // no existan, el plugin registra (token local) pero FCM no entrega.
  },
};

export default config;

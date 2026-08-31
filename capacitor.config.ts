import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.antares.paciente',
  appName: 'ANTARES',
  webDir: 'dist',
  server: {
    // Dev: sin server.url → Capacitor carga el bundle local (webDir). En
    // producción se apuntará al gateway api.coppaddresd.com cuando exista.
    // Dev: 'http' para que no haya mixed-content con backends HTTP locales.
    // En producción se usa 'https' (el gateway AWS termina TLS).
    androidScheme: 'http',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#06091A',
    },
    // PushNotifications (@capacitor/push-notifications): no requiere
    // configuración JS. Para recibir notificaciones FCM reales hace falta el
    // trabajo de Firebase del usuario (fuera del alcance de código):
    //   - Android: android/app/google-services.json (proyecto Firebase + FCM)
    //   - iOS:     App/App/GoogleService-Info.plist (proyecto Firebase + APNs)
    // Luego: pnpm run sync && pnpm cap open <platform>. Mientras esos archivos
    // no existan, el plugin registra (token local) pero FCM no entrega.
  },
}

export default config

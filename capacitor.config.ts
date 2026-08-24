import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.antares.paciente',
  appName: 'ANTARES',
  webDir: 'dist',
  server: {
    // URL del gateway en producción (placeholder). Se completa cuando exista el
    // custom domain api.coppaddresd.com en AWS (ver coppAddresdBack/docs/architecture/gateway.md).
    // Nota: con server.url definido, Capacitor carga la app desde esa URL remota en
    // Android/iOS — mientras no exista el dominio, quitar este campo o apuntar a localhost.
    url: 'https://api.coppaddresd.com',
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#06091A',
    },
  },
}

export default config

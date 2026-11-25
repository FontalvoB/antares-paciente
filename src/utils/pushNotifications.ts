import { Capacitor } from '@capacitor/core'
import { PushNotifications, type RegistrationError, type Token } from '@capacitor/push-notifications'
import { getAccessToken } from './authApi'
import { getApiBaseUrl } from './apiBaseUrl'

/**
 * Registro de notificaciones push (FCM) en ANTARES Paciente.
 *
 * - Pide permiso solo desde la activación explícita y registra en Capacitor.
 * - Con el token FCM obtenido, lo registra en el backend
 *   (POST /api/v1/notifications/devices). El endpoint exige JWT: mientras el
 *   login demo no esté conectado el registro puede devolver 401 — se degrada
 *   con un log sin romper la app.
 * - Al tocar una notificación de un módulo retirado, la app abre Inicio.
 *
 * Configuración por plataforma:
 *   - Android: android/app/google-services.json (proyecto Firebase + FCM)
 *   - iOS: Firebase convierte el token APNs a FCM en AppDelegate. Requiere
 *     GoogleService-Info.plist y una firma con la capacidad de push.
 */
interface PushRegistrationOptions {
  language?: 'es' | 'en'
  onOpenHome?: () => void
  canPrompt?: () => boolean
}

// Los listeners del plugin se registran una sola vez por sesión; el guard evita
// duplicarlos si registerForPush se llama más de una vez.
let started = false
let currentLanguage: 'es' | 'en' = 'es'
let latestDevice: { token: string; platform: string } | null = null
// Serialize language updates: a slower old request must not overwrite a newer preference.
let registrationQueue: Promise<void> = Promise.resolve()
let registrationEnabled = true

/** Refresh an existing token using the current JWT; never prompts or registers listeners. */
export function syncPushLanguage(language: 'es' | 'en'): Promise<void> {
  currentLanguage = language
  registrationEnabled = true
  return queueDeviceRegistration()
}

function queueDeviceRegistration(): Promise<void> {
  registrationQueue = registrationQueue.then(async () => {
    if (registrationEnabled && latestDevice) await registerDeviceToken(latestDevice.token, latestDevice.platform, currentLanguage)
  })
  return registrationQueue
}

/** Call before clearing auth on logout. Late native token events stay suspended until the next authenticated sync. */
export function unregisterPushDevice(): Promise<void> {
  registrationEnabled = false
  const accessToken = getAccessToken()
  const token = latestDevice?.token
  registrationQueue = registrationQueue.then(async () => {
    if (!accessToken || !token) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      await fetch(`${getApiBaseUrl()}/api/v1/notifications/devices/${encodeURIComponent(token)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
      })
    } catch {
      console.warn('[push] Could not unregister the device during logout')
    } finally {
      clearTimeout(timeout)
    }
  })
  return registrationQueue
}

// Callbacks vigentes: el listener se registra una sola vez, pero los handlers
// pueden llegar después (el contexto de navegación monta más tarde que el
// listener en un arranque en frío), por lo que cada llamada los refresca.
let currentOptions: PushRegistrationOptions = {}


export async function registerForPush(options: PushRegistrationOptions = {}): Promise<void> {
  const platform = Capacitor.getPlatform()
  // En web (dev en navegador) el plugin no existe: no hacer nada.
  if (platform !== 'android' && platform !== 'ios') {
    console.log(`[push] Plataforma "${platform}" no soportada — se omite el registro`)
    return
  }

  // Refresca los handlers en cada llamada: el listener es único por sesión,
  // pero el contexto que navega puede montar después (cold start).
  currentOptions = { ...currentOptions, ...options }
  if (options.language) currentLanguage = options.language

  if (started) {
    await syncPushLanguage(currentLanguage)
    return
  }
  let permission
  try {
    permission = options.canPrompt?.()
      ? await PushNotifications.requestPermissions()
      : await PushNotifications.checkPermissions()
  } catch {
    return
  }
  if (permission.receive !== 'granted') return
  if (started || (options.canPrompt && !options.canPrompt())) return
  started = true
  registrationEnabled = true

  void PushNotifications.addListener('registration', (token: Token) => {
    latestDevice = { token: token.value, platform }
    void queueDeviceRegistration()
  })
  void PushNotifications.addListener('registrationError', (error: RegistrationError) => {
    console.warn('[push] Error al registrar el dispositivo en FCM:', error.error)
  })
  void PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // El sistema ya muestra la notificación; solo se loguea en foreground.
    console.log('[push] Notificación recibida:', notification.title ?? '(sin título)')
  })
  void PushNotifications.addListener('pushNotificationActionPerformed', () => {
    if (getAccessToken()) currentOptions.onOpenHome?.()
  })

  try {
    await PushNotifications.register()
    console.log('[push] Registro iniciado — el token llega por el evento "registration"')
  } catch (error) {
    // Degradación: sin permiso o sin Firebase configurado el registro falla
    // pero la app sigue funcionando con normalidad.
    console.warn('[push] No se pudo registrar el dispositivo:', error)
  }
}

/** Registra el token del dispositivo en el backend (best-effort, nunca lanza). */
async function registerDeviceToken(token: string, platform: string, language: 'es' | 'en'): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const accessToken = getAccessToken()
    if (!accessToken) return
    const res = await fetch(`${getApiBaseUrl()}/api/v1/notifications/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ token, platform, language }),
      signal: controller.signal,
    })
    if (!res.ok) {
      // 401 esperado en demo (login no conectado): se reintenta en la próxima
      // apertura de la app. Nunca romper el flujo.
      console.warn(`[push] El backend rechazó el registro del token (${res.status})`)
      return
    }
    console.log('[push] Token registrado en el backend')
  } catch (error) {
    console.warn('[push] No se pudo contactar el backend para registrar el token:', error)
  } finally {
    clearTimeout(timeout)
  }
}

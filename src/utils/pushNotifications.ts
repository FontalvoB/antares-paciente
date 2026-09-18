import { Capacitor } from '@capacitor/core'
import { PushNotifications, type RegistrationError, type Token } from '@capacitor/push-notifications'
import { getAccessToken } from './authApi'
import { getApiBaseUrl } from './apiBaseUrl'

/**
 * Registro de notificaciones push (FCM) en ANTARES Paciente.
 *
 * - Pide permiso (iOS) y registra el dispositivo en Capacitor.
 * - Con el token FCM/APNS obtenido, lo registra en el backend
 *   (POST /api/v1/notifications/devices). El endpoint exige JWT: mientras el
 *   login demo no esté conectado el registro puede devolver 401 — se degrada
 *   con un log sin romper la app.
 * - Al tocar una notificación navega al chat para que el paciente vea el
 *   mensaje del bot inyectado en su thread estable.
 * - Si la carga pide la sala (data.screen === "room" o data.appointmentId),
 *   delega en onOpenRoom con el id de la cita.
 *
 * Requiere (trabajo del usuario, fuera del alcance de código):
 *   - Android: android/app/google-services.json (proyecto Firebase + FCM)
 *   - iOS: App/App/GoogleService-Info.plist (proyecto Firebase + APNs)
 * Sin esos archivos el plugin registra pero FCM no entrega notificaciones.
 */
interface PushRegistrationOptions {
  /** Se invoca al tocar una notificación (navegar al chat con el threadId si viene en la carga). */
  onOpenChat?: (threadId?: string) => void
  /** Se invoca al tocar una notificación de sala (quien navega resuelve la cita). */
  onOpenRoom?: (appointmentId: string) => void
}

// Los listeners del plugin se registran una sola vez por sesión; el guard evita
// duplicarlos si registerForPush se llama más de una vez.
let started = false

// Callbacks vigentes: el listener se registra una sola vez, pero los handlers
// pueden llegar después (el contexto de navegación monta más tarde que el
// listener en un arranque en frío), por lo que cada llamada los refresca.
let currentOptions: PushRegistrationOptions = {}

// ── Cola de arranque en frío ───────────────────────────────────────────────
// Al abrir la app tocando una notificación, pushNotificationActionPerformed
// puede llegar antes de que exista quién navegue. En ese caso el appointmentId
// se guarda aquí y Shell lo consume una sola vez al montar el contexto
// (si llegan varios taps fríos, el último gana: es la intención más reciente).
let pendingRoomAppointmentId: string | null = null

/** Encola la sala a abrir cuando todavía no hay contexto de navegación. */
export function queuePendingRoomAppointmentId(appointmentId: string): void {
  pendingRoomAppointmentId = appointmentId
}

/** Devuelve y limpia la sala pendiente de abrir (null si no hay ninguna). */
export function consumePendingRoomAppointmentId(): string | null {
  const appointmentId = pendingRoomAppointmentId
  pendingRoomAppointmentId = null
  return appointmentId
}

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

  if (started) return
  started = true

  void PushNotifications.addListener('registration', (token: Token) => {
    void registerDeviceToken(token.value, platform)
  })
  void PushNotifications.addListener('registrationError', (error: RegistrationError) => {
    console.warn('[push] Error al registrar el dispositivo en FCM:', error.error)
  })
  void PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // El sistema ya muestra la notificación; solo se loguea en foreground.
    console.log('[push] Notificación recibida:', notification.title ?? '(sin título)')
  })
  void PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    const data = notification.notification?.data as Record<string, unknown> | undefined
    const rawAppointmentId = data?.appointmentId ?? data?.appointment_id
    const appointmentId =
      typeof rawAppointmentId === 'string' && rawAppointmentId ? rawAppointmentId : undefined
    // Notificación de sala: screen === "room" (y/o appointmentId en la carga).
    if (data?.screen === 'room' || appointmentId) {
      if (!appointmentId) {
        console.warn('[push] Notificación de sala sin appointmentId; se ignora')
        return
      }
      if (currentOptions.onOpenRoom) {
        currentOptions.onOpenRoom(appointmentId)
      } else {
        // Sin contexto de navegación todavía (cold start): se encola.
        queuePendingRoomAppointmentId(appointmentId)
      }
      return
    }
    const threadId = (data?.thread_id ?? data?.threadId) as string | undefined
    currentOptions.onOpenChat?.(threadId)
  })

  try {
    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') {
      console.log('[push] Permiso de notificaciones denegado')
      return
    }
    await PushNotifications.register()
    console.log('[push] Registro iniciado — el token llega por el evento "registration"')
  } catch (error) {
    // Degradación: sin permiso o sin Firebase configurado el registro falla
    // pero la app sigue funcionando con normalidad.
    console.warn('[push] No se pudo registrar el dispositivo:', error)
  }
}

/** Registra el token del dispositivo en el backend (best-effort, nunca lanza). */
async function registerDeviceToken(token: string, platform: string): Promise<void> {
  try {
    const accessToken = getAccessToken()
    const res = await fetch(`${getApiBaseUrl()}/api/v1/notifications/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ token, platform }),
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
  }
}
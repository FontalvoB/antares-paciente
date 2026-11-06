import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  platform: 'ios', jwt: 'patient-jwt',
  listeners: new Map<string, (value: unknown) => void>(),
  addListener: vi.fn(), requestPermissions: vi.fn(), register: vi.fn(), fetch: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => native.platform } }))
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: native }))
vi.mock('../authApi', () => ({ getAccessToken: () => native.jwt }))
vi.mock('../apiBaseUrl', () => ({ getApiBaseUrl: () => 'https://api.example.test' }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  native.platform = 'ios'
  native.jwt = 'patient-jwt'
  native.listeners.clear()
  native.addListener.mockImplementation((event, callback) => {
    native.listeners.set(event, callback)
    return Promise.resolve({ remove: vi.fn() })
  })
  native.requestPermissions.mockResolvedValue({ receive: 'granted' })
  native.register.mockResolvedValue(undefined)
  native.fetch.mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', native.fetch)
})

function body(index: number) {
  return JSON.parse(native.fetch.mock.calls[index][1].body)
}

describe('push device language', () => {
  it('registers current English and refreshes Spanish using the latest JWT without new native setup', async () => {
    const { registerForPush, syncPushLanguage } = await import('../pushNotifications')
    await registerForPush({ language: 'en' })
    native.listeners.get('registration')!({ value: 'opaque-device-token' })
    await vi.waitFor(() => expect(native.fetch).toHaveBeenCalledTimes(1))
    expect(body(0)).toEqual({ token: 'opaque-device-token', platform: 'ios', language: 'en' })
    native.jwt = 'refreshed-jwt'
    await syncPushLanguage('es')
    expect(body(1).language).toBe('es')
    expect(native.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer refreshed-jwt')
    expect(native.requestPermissions).toHaveBeenCalledTimes(1)
    expect(native.register).toHaveBeenCalledTimes(1)
    expect(native.addListener).toHaveBeenCalledTimes(4)
  })

  it('remembers language chosen before a token arrives and skips unauthenticated updates', async () => {
    const { registerForPush, syncPushLanguage } = await import('../pushNotifications')
    await syncPushLanguage('en')
    expect(native.fetch).not.toHaveBeenCalled()
    await registerForPush()
    native.jwt = ''
    native.listeners.get('registration')!({ value: 'token' })
    await syncPushLanguage('en')
    expect(native.fetch).not.toHaveBeenCalled()
    native.jwt = 'next-user-jwt'
    await syncPushLanguage('en')
    expect(body(0).language).toBe('en')
  })

  it('serializes updates so an older in-flight preference cannot win', async () => {
    const { registerForPush, syncPushLanguage } = await import('../pushNotifications')
    await registerForPush({ language: 'es' })
    let release!: (value: { ok: boolean }) => void
    native.fetch.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    native.listeners.get('registration')!({ value: 'token' })
    await vi.waitFor(() => expect(native.fetch).toHaveBeenCalledTimes(1))
    const update = syncPushLanguage('en')
    expect(native.fetch).toHaveBeenCalledTimes(1)
    release({ ok: true })
    await update
    expect(body(0).language).toBe('es')
    expect(body(1).language).toBe('en')
  })

  it('captures logout credentials and suspends late token events until the next account sync', async () => {
    const { registerForPush, syncPushLanguage, unregisterPushDevice } = await import('../pushNotifications')
    await registerForPush({ language: 'en' })
    native.listeners.get('registration')!({ value: 'token/to-encode' })
    await vi.waitFor(() => expect(native.fetch).toHaveBeenCalledTimes(1))
    const cleanup = unregisterPushDevice()
    native.jwt = '' // logout clears auth immediately, before queued cleanup starts
    await cleanup
    expect(native.fetch.mock.calls[1][0]).toContain('/devices/token%2Fto-encode')
    expect(native.fetch.mock.calls[1][1].method).toBe('DELETE')
    expect(native.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer patient-jwt')
    native.listeners.get('registration')!({ value: 'token/to-encode' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(native.fetch).toHaveBeenCalledTimes(2)
    native.jwt = 'next-account-jwt'
    await syncPushLanguage('es')
    expect(native.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer next-account-jwt')
    expect(body(2).language).toBe('es')
    expect(native.requestPermissions).toHaveBeenCalledTimes(1)
    expect(native.register).toHaveBeenCalledTimes(1)
  })

  it('does not prompt or register on web', async () => {
    native.platform = 'web'
    const { registerForPush, syncPushLanguage } = await import('../pushNotifications')
    await registerForPush({ language: 'en' })
    await syncPushLanguage('en')
    expect(native.requestPermissions).not.toHaveBeenCalled()
    expect(native.addListener).not.toHaveBeenCalled()
    expect(native.fetch).not.toHaveBeenCalled()
  })
})

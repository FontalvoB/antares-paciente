import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { activateSosAlert } from '../sosApi'
import { getAccessToken } from '../authApi'

/**
 * Cliente SOS: nunca lanza — devuelve null sin token, ante !ok o error de red.
 */
vi.mock('../authApi', () => ({ getAccessToken: vi.fn() }))
vi.mock('../apiBaseUrl', () => ({ getGatewayBaseUrl: vi.fn(() => 'http://test') }))

const mockedToken = vi.mocked(getAccessToken)
const fetchMock = vi.fn()

const payload = {
  latitude: 25.7617,
  longitude: -80.1918,
  language: 'es' as const,
  vitals: { heartRate: 140, spo2: 94, bloodPressure: '160/110' },
}

const dispatchResult = {
  id: 'abc',
  status: 'Sent',
  triggeredAt: '2026-09-03T00:00:00Z',
  messageText: 'ALERTA SOS',
  emergencyNumber: '911',
  channels: {
    sms: { status: 'Sent' },
    email: { status: 'Sent' },
    voice: { status: 'Sent' },
  },
}

describe('activateSosAlert', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('sin token devuelve null y no llama fetch', async () => {
    mockedToken.mockReturnValue(null)
    await expect(activateSosAlert(payload)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía POST con Bearer, body JSON y parsea el resultado', async () => {
    mockedToken.mockReturnValue('jwt-123')
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(dispatchResult), { status: 200 }),
    )

    const result = await activateSosAlert(payload)

    expect(fetchMock).toHaveBeenCalledWith('http://test/api/v1/sos/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-123',
      },
      body: JSON.stringify(payload),
    })
    expect(result).toEqual(dispatchResult)
  })

  it('respuesta no ok (401) devuelve null', async () => {
    mockedToken.mockReturnValue('jwt-123')
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))
    await expect(activateSosAlert(payload)).resolves.toBeNull()
  })

  it('fallo de red devuelve null (nunca lanza)', async () => {
    mockedToken.mockReturnValue('jwt-123')
    fetchMock.mockRejectedValue(new TypeError('network down'))
    await expect(activateSosAlert(payload)).resolves.toBeNull()
  })
})

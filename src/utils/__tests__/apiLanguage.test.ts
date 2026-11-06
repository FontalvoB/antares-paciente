import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../apiClient'
import { fetchMyTest, submitMyTest } from '../healthTestsApi'
import { ApiClientError, createRequest, fetchMyAppointments } from '../appointmentsApi'

const auth = vi.hoisted(() => ({ token: 'old-token', refresh: vi.fn(), clear: vi.fn() }))
vi.mock('../authApi', () => ({ getAccessToken: () => auth.token, clearSessionAndNotify: auth.clear, sharedRefresh: auth.refresh }))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn()
beforeEach(() => {
  localStorage.clear(); auth.token = 'old-token'; auth.refresh.mockReset(); fetchMock.mockReset()
  auth.refresh.mockImplementation(async () => { auth.token = 'new-token'; return { status: 200, result: { accessToken: 'new-token' } } })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
const headers = (index: number) => new Headers(fetchMock.mock.calls[index][1].headers)

describe('idioma y errores de transporte del paciente', () => {
  it('usa el idioma vigente en lecturas de evaluaciones y citas y preserva respuestas canónicas', async () => {
    localStorage.setItem('antares_lang', 'es'); fetchMock.mockResolvedValueOnce(json({ questions: [] }))
    await fetchMyTest('assessment-id')
    localStorage.setItem('antares_lang', 'en'); fetchMock.mockResolvedValueOnce(json({ items: [] }))
    await fetchMyAppointments()
    expect(headers(0).get('Accept-Language')).toBe('es')
    expect(headers(1).get('Accept-Language')).toBe('en')
    expect(headers(0).get('X-App-Language')).toBe('es')
    expect(headers(1).get('X-App-Language')).toBe('en')
    fetchMock.mockResolvedValueOnce(json({}))
    await submitMyTest('assessment-id', [{ questionId: 'q', valueText: 'Texto personal sin traducir' }])
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ answers: [{ questionId: 'q', valueText: 'Texto personal sin traducir' }] })
    expect(headers(2).get('Accept-Language')).toBe('en')
  })
  it('relee idioma y token después de un único refresh401', async () => {
    localStorage.setItem('antares_lang', 'es')
    fetchMock.mockImplementationOnce(async () => { localStorage.setItem('antares_lang', 'en'); return json({}, 401) }).mockResolvedValueOnce(json({ ok: true }))
    await apiFetch('/api/v1/program/me/snapshot')
    expect(headers(0).get('Accept-Language')).toBe('es')
    expect(headers(1).get('Accept-Language')).toBe('en')
    expect(headers(1).get('Authorization')).toBe('Bearer new-token')
    expect(headers(0).get('X-App-Language')).toBe('es')
    expect(headers(1).get('X-App-Language')).toBe('en')
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })
  it('conserva un idioma explícito y encabezados personalizados también en el reintento', async () => {
    localStorage.setItem('antares_lang', 'en')
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}))
    await apiFetch('/api/v1/program/me/snapshot', { headers: new Headers({ 'Accept-Language': 'es', 'X-Request': 'retained' }) })
    expect(headers(0).get('Accept-Language')).toBe('es')
    expect(headers(1).get('Accept-Language')).toBe('es')
    expect(headers(1).get('X-Request')).toBe('retained')
    expect(headers(0).get('X-App-Language')).toBe('es')
    expect(headers(1).get('X-App-Language')).toBe('es')
  })
  it('conserva la selección explícita de contenido también al renovar auth', async () => {
    localStorage.setItem('antares_lang', 'es')
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}))
    await apiFetch('/api/v1/me/nutrition-plan', { headers: { 'X-App-Language': 'en' } })
    expect(headers(0).get('X-App-Language')).toBe('en')
    expect(headers(1).get('X-App-Language')).toBe('en')
    expect(headers(0).get('Accept-Language')).toBe('es')
  })
  it.each(['message', 'detail'])('conserva CONTENT_TRANSLATION_UNAVAILABLE desde %s', async field => {
    fetchMock.mockResolvedValueOnce(json({ [field]: 'English content could not be prepared. Please try again.', code: 'CONTENT_TRANSLATION_UNAVAILABLE' }, 503))
    await expect(fetchMyTest('assessment-id')).rejects.toMatchObject({ status: 503, code: 'CONTENT_TRANSLATION_UNAVAILABLE' })
  })
  it('mantiene ApiClientError y el JSON original de las mutaciones de citas', async () => {
    localStorage.setItem('antares_lang', 'en')
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ id: 'request' }))
    const input = { patientId: 'patient', organizationId: 'org', specialtyId: 'specialty', reason: 'My original reason', priority: 'Urgent' as const }
    await createRequest(input)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(input)
    expect(headers(1).get('Accept-Language')).toBe('en')
    fetchMock.mockResolvedValueOnce(json({ detail: 'English content unavailable', code: 'CONTENT_TRANSLATION_UNAVAILABLE' }, 503))
    await expect(fetchMyAppointments()).rejects.toBeInstanceOf(ApiClientError)
  })
  it.each([
    ['/api/v1/program/me/snapshot', 'en', 45_000],
    ['/api/v1/program/me/snapshot', 'es', 15_000],
    ['/api/v1/appointments/mine', 'en', 15_000],
  ] as const)('acota %s en %s a %ims sin cancelar prematuramente', async (path, lang, budget) => {
    vi.useFakeTimers(); localStorage.setItem('antares_lang', lang)
    let requestSignal: AbortSignal | undefined
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      requestSignal = init.signal
      init.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true })
    }))
    const rejected = expect(apiFetch(path)).rejects.toMatchObject({ errorType: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(budget - 1)
    expect(requestSignal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
  })
  it.each([false, true])('usa la calidad de X-App-Language para el presupuesto de lectura (retry=%s)', async retry => {
    vi.useFakeTimers()
    localStorage.setItem('antares_lang', 'es')
    if (retry) fetchMock.mockResolvedValueOnce(json({}, 401))
    let requestSignal: AbortSignal | undefined
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      requestSignal = init.signal
      init.signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true })
    }))
    const rejected = expect(apiFetch('/api/v1/program/me/snapshot', { headers: { 'X-App-Language': 'fr-FR,en-US;q=0.8' } }))
      .rejects.toMatchObject({ errorType: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(requestSignal?.aborted).toBe(false)
    expect(headers(retry ? 1 : 0).get('X-App-Language')).toBe('fr-FR,en-US;q=0.8')
    await vi.advanceTimersByTimeAsync(30_000)
    await rejected
  })
})

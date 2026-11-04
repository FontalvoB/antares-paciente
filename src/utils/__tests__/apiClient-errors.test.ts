import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../apiClient'

vi.mock('../authApi', () => ({ getAccessToken: () => null, clearSessionAndNotify: vi.fn(), sharedRefresh: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())
describe('códigos de negocio del gateway', () => {
  it.each([
    { message: 'NO_ACTIVE_ENROLLMENT: no existe una inscripción activa para el paciente.' },
    { detail: 'NO_ACTIVE_ENROLLMENT: no existe una inscripción activa para el paciente.' },
  ])('conserva el código tanto en message como en detail', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 404, headers: { 'Content-Type': 'application/json' } })))
    await expect(apiFetch('/api/v1/program/me/snapshot')).rejects.toMatchObject({ status: 404, code: 'NO_ACTIVE_ENROLLMENT' })
  })
  it('no convierte un 404 genérico en falta de inscripción', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'No encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } })))
    await expect(apiFetch('/api/v1/program/me/snapshot')).rejects.toMatchObject({ status: 404, code: undefined })
  })
})

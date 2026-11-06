import { afterEach, describe, expect, it, vi } from 'vitest'
import { patientReadTimeout, requestLanguage } from '../requestLanguage'

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })
describe('idioma de cada petición', () => {
  it('lee el idioma vigente cada vez, sin congelarlo al importar', () => {
    localStorage.setItem('antares_lang', 'es')
    expect(requestLanguage()).toBe('es')
    localStorage.setItem('antares_lang', 'en')
    expect(requestLanguage()).toBe('en')
    localStorage.setItem('antares_lang', 'unknown')
    expect(requestLanguage()).toBe('es')
  })
  it('tolera almacenamiento no disponible', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(requestLanguage()).toBe('es')
  })
  it('amplía solo lecturas traducidas, respetando el idioma explícito del recurso', () => {
    expect(patientReadTimeout('/api/v1/program/me/snapshot', 'GET', 'en')).toBe(45_000)
    expect(patientReadTimeout('/api/v1/health-tests/me/tests/id/submit', 'POST', 'en')).toBe(15_000)
    expect(patientReadTimeout('/api/v1/me/nutrition-plan/status', 'GET', 'en')).toBe(15_000)
    expect(patientReadTimeout('/api/v1/me/measurements?pageSize=20', 'GET', 'en')).toBe(45_000)
    expect(patientReadTimeout('/api/v1/specialties', 'GET', 'en')).toBe(45_000)
    expect(patientReadTimeout('/api/v1/foodai/analyses/id?language=en', 'GET', 'es')).toBe(45_000)
    expect(patientReadTimeout('/api/v1/foodai/analyses/id?language=es', 'GET', 'en')).toBe(15_000)
  })
  it.each([
    ['fr-FR,en-US;q=0.8', 45_000],
    ['ES-co;q=0.4,EN-us;q=0.9', 45_000],
    ['en;q=0.5,ES;q=0.9', 15_000],
    ['en;q=0,fr;q=1', 15_000],
    ['en;q=oops,es;q=0.5', 15_000],
    ['garbage;;,EN;q=0.7', 45_000],
    ['en;q=2,es;q=0.5', 15_000],
    ['en;q=-1,es;q=0.5', 15_000],
    ['*;q=1,en;q=0.5', 15_000],
    ['*;q=1,es;q=0,en;q=0.5', 45_000],
    ['*;q=0.4,es;q=0,en;q=0', 15_000],
    ['*;q=1,es;q=0.5,en;q=0.6', 45_000],
    ['ES;q=0.8,en;q=0.8', 15_000],
  ])('presupuesta la preferencia compatible %s como el servidor', (preference, budget) => {
    expect(patientReadTimeout('/api/v1/program/me/snapshot', 'GET', preference)).toBe(budget)
  })
  it('prioriza la consulta explícita válida y no interpreta regiones ni q en la consulta', () => {
    expect(patientReadTimeout('/api/v1/program/me/snapshot?language=%20EN%20', 'GET', 'es')).toBe(45_000)
    expect(patientReadTimeout('/api/v1/program/me/snapshot?language=fr', 'GET', 'en')).toBe(15_000)
    expect(patientReadTimeout('/api/v1/program/me/snapshot?language=en-US', 'GET', 'en')).toBe(15_000)
    expect(patientReadTimeout('/api/v1/program/me/snapshot?language=en%3Bq%3D0', 'GET', 'en')).toBe(15_000)
    expect(patientReadTimeout('/api/v1/program/me/snapshot?language=', 'GET', 'fr,en;q=0.8')).toBe(45_000)
  })
})

import { describe, it, expect } from 'vitest'

import { buildSosDataBlock } from '../sosMessage'
import type { UserProfile } from '../../types'

/**
 * SOS — bloque de datos de emergencia (TTS/SMS/email):
 * localizado es/en, omite campos faltantes y NUNCA emite "null"/"undefined".
 */
const makeUser = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    nombre: 'María González',
    dob: '1990-01-15',
    cedula: '12345678',
    grupo: 'O+',
    seguro: 'BlueCross',
    poliza: 'BCB-20247381',
    fam1Nombre: 'Pedro González',
    fam1Parentesco: 'Esposo',
    fam1Cel: '+1 (786) 555-0192',
    fam1Email: 'pedro@test.com',
    ...overrides,
  }) as unknown as UserProfile

const coords = { latitude: 25.7617, longitude: -80.1918, accuracy: 30.4 }
const vitals = { heartRate: 140, spo2: 94, bloodPressure: '160/110' }

describe('buildSosDataBlock', () => {
  it('bloque completo en español con todos los datos', () => {
    const block = buildSosDataBlock(makeUser(), coords, vitals, 'es')
    expect(block).toContain('ALERTA SOS — COPP-ADRESD')
    expect(block).toContain('Paciente: María González')
    expect(block).toMatch(/^Edad: \d+ años$/m)
    expect(block).toContain('Cédula: 12345678')
    expect(block).toContain('Grupo sangre: O+')
    expect(block).toContain('Seguro: BlueCross · BCB-20247381')
    expect(block).toContain('Vitales: FC 140 lpm · SpO2 94% · TA 160/110')
    expect(block).toContain('Ubicación: 25.7617° N, 80.1918° W (±30 m)')
    expect(block).toContain('https://maps.google.com/?q=25.7617,-80.1918')
    expect(block).toContain(
      'Contacto de emergencia: Pedro González · Esposo · +1 (786) 555-0192',
    )
  })

  it('bloque completo en inglés', () => {
    const block = buildSosDataBlock(makeUser(), coords, vitals, 'en')
    expect(block).toContain('SOS ALERT — COPP-ADRESD')
    expect(block).toContain('Patient: María González')
    expect(block).toMatch(/^Age: \d+ years$/m)
    expect(block).toContain('ID: 12345678')
    expect(block).toContain('Blood type: O+')
    expect(block).toContain('Insurance: BlueCross · BCB-20247381')
    expect(block).toContain('Vitals: FC 140 lpm · SpO2 94% · TA 160/110')
    expect(block).toContain('Location: 25.7617° N, 80.1918° W (±30 m)')
    expect(block).toContain('Emergency contact: Pedro González · Esposo · +1 (786) 555-0192')
  })

  it('sin GPS usa "Ubicación no disponible" / "Location unavailable"', () => {
    expect(buildSosDataBlock(makeUser(), null, vitals, 'es')).toContain(
      'Ubicación no disponible',
    )
    expect(buildSosDataBlock(makeUser(), null, vitals, 'en')).toContain(
      'Location unavailable',
    )
  })

  it('coordenadas negativas → S/W', () => {
    const block = buildSosDataBlock(
      makeUser(),
      { latitude: -10.5, longitude: -70.2 },
      vitals,
      'es',
    )
    expect(block).toContain('10.5000° S')
    expect(block).toContain('70.2000° W')
  })

  it('vitales parciales solo incluyen lo presente', () => {
    const block = buildSosDataBlock(makeUser(), null, { heartRate: 140 }, 'es')
    expect(block).toContain('Vitales: FC 140 lpm')
    expect(block).not.toContain('SpO2')
    expect(block).not.toMatch(/\bTA\b/)
  })

  it('nunca emite "null" ni "undefined" con usuario casi vacío', () => {
    const block = buildSosDataBlock(
      makeUser({ grupo: '', seguro: '', poliza: '', fam1Nombre: '' }),
      null,
      {},
      'es',
    )
    expect(block).not.toMatch(/null|undefined/)
  })
})

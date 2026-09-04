import { describe, it, expect } from 'vitest'

import { buildSosDataBlock } from '../sosMessage'
import type { UserProfile } from '../../types'

/**
 * SOS — emergency data block (TTS/SMS/email):
 * English-only output matching backend format. Omits missing fields and
 * NEVER emits "null" or "undefined".
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
  it('full English block with all data', () => {
    const block = buildSosDataBlock(makeUser(), coords, vitals, 'en')
    expect(block).toContain('=== SOS ALERT - EMERGENCY ===')
    expect(block).toContain('Patient: María González')
    expect(block).toMatch(/^Age \d+ years \(DOB \d{2}\/\d{2}\/\d{4}\)$/m)
    expect(block).toContain('Document: 12345678')
    expect(block).toContain('Blood type: O+')
    expect(block).toContain('Insurer: BlueCross')
    expect(block).toContain('Member ID: BCB-20247381')
    expect(block).toContain('--- Vital Signs ---')
    expect(block).toContain('Heart Rate 140 bpm')
    expect(block).toContain('SpO2 94%')
    expect(block).toContain('Blood Pressure 160/110')
    expect(block).toContain('Location:')
    expect(block).toContain('Decimal: 25.761700, -80.191800 (±30 m)')
    expect(block).toContain('DMS: 25.7617° N, 80.1918° W')
    expect(block).not.toContain('--- Emergency Contact ---')
    expect(block).not.toContain('Pedro González')
    expect(block).toContain('Call 911 if needed.')
    expect(block).not.toContain('maps.google.com')
  })

  it('output is English regardless of lang param', () => {
    const block = buildSosDataBlock(makeUser(), coords, vitals, 'es')
    expect(block).toContain('=== SOS ALERT - EMERGENCY ===')
    expect(block).toContain('Patient: María González')
    expect(block).toContain('Document: 12345678')
    expect(block).toContain('Blood type: O+')
    expect(block).toContain('--- Vital Signs ---')
    expect(block).toContain('Heart Rate 140 bpm')
    expect(block).toContain('Call 911 if needed.')
  })

  it('with coords.label includes Address line', () => {
    const block = buildSosDataBlock(
      makeUser(),
      { ...coords, label: '123 Main St, Miami, FL' },
      vitals,
      'en',
    )
    expect(block).toContain('Address: 123 Main St, Miami, FL')
    expect(block).toContain('Decimal:')
    expect(block).toContain('DMS:')
  })

  it('without label omits Address line', () => {
    const block = buildSosDataBlock(makeUser(), coords, vitals, 'en')
    expect(block).not.toContain('Address:')
  })

  it('no GPS shows "Location: Not available"', () => {
    expect(buildSosDataBlock(makeUser(), null, vitals, 'en')).toContain(
      'Location: Not available',
    )
  })

  it('negative coordinates → S/W', () => {
    const block = buildSosDataBlock(
      makeUser(),
      { latitude: -10.5, longitude: -70.2 },
      vitals,
      'en',
    )
    expect(block).toContain('10.5000° S')
    expect(block).toContain('70.2000° W')
  })

  it('partial vitals only include what is present', () => {
    const block = buildSosDataBlock(makeUser(), null, { heartRate: 140 }, 'en')
    expect(block).toContain('Heart Rate 140 bpm')
    expect(block).not.toContain('SpO2')
    expect(block).not.toContain('Blood Pressure')
  })

  it('never emits "null" or "undefined" with near-empty user', () => {
    const block = buildSosDataBlock(
      makeUser({ grupo: '', seguro: '', poliza: '', fam1Nombre: '' }),
      null,
      {},
      'en',
    )
    expect(block).not.toMatch(/null|undefined/)
  })
})

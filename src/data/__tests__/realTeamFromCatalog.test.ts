import { describe, expect, it } from 'vitest'
import { realProfessionalByType, realTeamFromCatalog } from '../appointments'
import type { ProfessionalCatalogItem } from '../../utils/appointmentsApi'

/** Catálogo de profesionales con defaults de campos no relevantes al test. */
function catalogItem(
  overrides: Pick<
    ProfessionalCatalogItem,
    'id' | 'fullName' | 'professionalTypeName'
  > &
    Partial<ProfessionalCatalogItem>,
): ProfessionalCatalogItem {
  return {
    employeeId: `emp-${overrides.id}`,
    specialties: [],
    locations: [],
    clinicIds: [],
    status: 'Active',
    ...overrides,
  }
}

describe('realTeamFromCatalog — equipo real, jamás el mock', () => {
  it('catálogo nulo → null (la UI no puede afirmar nada)', () => {
    expect(realTeamFromCatalog(null)).toBeNull()
  })

  it('catálogo sin profesionales activos → [] (vacío honesto, sin mock)', () => {
    const team = realTeamFromCatalog([
      catalogItem({
        id: 'p1',
        fullName: 'Dr. Carlos Ramírez, MD',
        professionalTypeName: 'Physician',
        status: 'Inactive',
      }),
    ])
    expect(team).toEqual([])
  })

  it('mapea un profesional real por rol disponible, sin nombres inventados', () => {
    const team = realTeamFromCatalog([
      catalogItem({
        id: 'p1',
        fullName: 'Dra. Sofía Vargas',
        professionalTypeName: 'Physician',
      }),
      catalogItem({
        id: 'p2',
        fullName: 'Nut. Carla Méndez',
        professionalTypeName: 'Registered Dietitian',
      }),
      catalogItem({
        id: 'p3',
        fullName: 'Psic. Lucía Pardo',
        professionalTypeName: 'Psychologist',
      }),
    ])

    expect(team?.map((p) => p.name)).toEqual([
      'Dra. Sofía Vargas',
      'Nut. Carla Méndez',
      'Psic. Lucía Pardo',
    ])
    expect(team?.map((p) => p.typeId)).toEqual([
      'medica',
      'nutricion',
      'psicologia',
    ])
    const names = team?.map((p) => p.name).join(' ') ?? ''
    for (const mockName of [
      'Carlos Ramírez',
      'Ana Torres',
      'Luis Mora',
      'Marco Reyes',
    ]) {
      expect(names).not.toContain(mockName)
    }
  })

  it('omite los roles que el catálogo no provee (sin relleno mock)', () => {
    const team = realTeamFromCatalog([
      catalogItem({
        id: 'p1',
        fullName: 'Dra. Sofía Vargas',
        professionalTypeName: 'Physician',
      }),
    ])

    expect(team).toHaveLength(1)
    expect(team?.[0]?.name).toBe('Dra. Sofía Vargas')
  })

  it('realProfessionalByType conserva el fallback mock existente (wizard demo)', () => {
    const pro = realProfessionalByType('medica', null)
    expect(pro.name).toBe('Dr. Carlos Ramírez, MD')
  })
})

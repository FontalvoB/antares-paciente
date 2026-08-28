export type RankCategory = 'racha' | 'evo' | 'adh' | 'rec'

export interface PatientRank {
  id: string
  name: string
  initials: string
  city: string
  you?: boolean
  tone: 'teal' | 'blue' | 'pur' | 'org' | 'ice' | 'navy'
  racha: number
  evo: number
  adh: number
  rec: number
}

export const USER_STATE = 'Florida'
export const USER_STATE_CODE = 'FL'

export const RANK_CATEGORIES: { id: RankCategory; label: string; unit: string; suffix: string }[] = [
  { id: 'racha', label: 'Racha', unit: 'días', suffix: '' },
  { id: 'evo', label: 'Evolución', unit: '%', suffix: '%' },
  { id: 'adh', label: 'Adherencia', unit: '%', suffix: '%' },
  { id: 'rec', label: 'Recuperación', unit: 'índice', suffix: '' },
]

/** Pacientes activos del estado del usuario (demo: Florida · María). */
export const FLORIDA_PATIENTS: PatientRank[] = [
  { id: 'sr', name: 'Sofía Reyes', initials: 'SR', city: 'Miami', tone: 'ice', racha: 34, evo: 36, adh: 94, rec: 91 },
  { id: 'do', name: 'Daniel Ortiz', initials: 'DO', city: 'Orlando', tone: 'blue', racha: 31, evo: 33, adh: 91, rec: 88 },
  { id: 'cv', name: 'Camila Vargas', initials: 'CV', city: 'Tampa', tone: 'pur', racha: 29, evo: 31, adh: 90, rec: 86 },
  { id: 'lh', name: 'Luis Herrera', initials: 'LH', city: 'Jacksonville', tone: 'navy', racha: 27, evo: 30, adh: 89, rec: 84 },
  { id: 'ab', name: 'Ana Beltrán', initials: 'AB', city: 'Miami', tone: 'teal', racha: 26, evo: 28, adh: 87, rec: 82 },
  { id: 'js', name: 'Javier Soto', initials: 'JS', city: 'Fort Lauderdale', tone: 'org', racha: 24, evo: 29, adh: 86, rec: 80 },
  { id: 'er', name: 'Elena Ruiz', initials: 'ER', city: 'Hialeah', tone: 'pur', racha: 23, evo: 26, adh: 85, rec: 79 },
  {
    id: 'mg',
    name: 'María González',
    initials: 'MG',
    city: 'Miami',
    you: true,
    tone: 'teal',
    racha: 22,
    evo: 27,
    adh: 88,
    rec: 74,
  },
  { id: 'cp', name: 'Carlos Peña', initials: 'CP', city: 'Tampa', tone: 'org', racha: 21, evo: 24, adh: 83, rec: 77 },
  { id: 'im', name: 'Isabel Mora', initials: 'IM', city: 'Orlando', tone: 'ice', racha: 20, evo: 25, adh: 84, rec: 76 },
  { id: 'ac', name: 'Andrés Castro', initials: 'AC', city: 'Miami', tone: 'blue', racha: 19, evo: 23, adh: 81, rec: 73 },
  { id: 'vc', name: 'Valentina Cruz', initials: 'VC', city: 'West Palm Beach', tone: 'pur', racha: 18, evo: 22, adh: 80, rec: 72 },
  { id: 'md', name: 'Mateo Díaz', initials: 'MD', city: 'Jacksonville', tone: 'navy', racha: 16, evo: 21, adh: 78, rec: 70 },
  { id: 'lj', name: 'Laura Jiménez', initials: 'LJ', city: 'Miami', tone: 'teal', racha: 15, evo: 19, adh: 77, rec: 68 },
  { id: 'dn', name: 'Diego Navarro', initials: 'DN', city: 'Orlando', tone: 'org', racha: 14, evo: 18, adh: 75, rec: 66 },
  { id: 'pm', name: 'Paula Méndez', initials: 'PM', city: 'Tampa', tone: 'ice', racha: 12, evo: 16, adh: 73, rec: 64 },
]

export function rankedPatients(category: RankCategory): (PatientRank & { rank: number; value: number })[] {
  const sorted = [...FLORIDA_PATIENTS].sort(
    (a, b) => b[category] - a[category] || a.name.localeCompare(b.name, 'es'),
  )
  return sorted.map((row, i) => ({ ...row, rank: i + 1, value: row[category] }))
}

export function userRank(category: RankCategory) {
  return rankedPatients(category).find((r) => r.you)!
}

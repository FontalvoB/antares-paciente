import {
  ADHER_QS,
  ANTECS,
  CARDIO_QS,
  FAM_HX,
  MOV_QS,
  NUT_QS,
  PRIORITIES,
  PURPOSE_OPEN,
  PURPOSE_SCALE,
  SISTEMAS,
  SLEEP_FLAGS,
  SLEEP_QS,
  STRESS_QS,
  TEMP_QS,
  type ScaleQ,
} from '../../data/tests'
import type { MeQuestion } from '../../utils/healthTestsApi'

export type TestMood =
  | 'clinic'
  | 'mind'
  | 'food'
  | 'move'
  | 'night'
  | 'bond'
  | 'heart'
  | 'storm'
  | 'cosmos'

export interface TestTheme {
  emoji: string
  accent: string
  accentSoft: string
  hero: 'hero-cosmos' | 'hero-navy' | 'hero-teal' | 'hero-pur' | 'hero-indigo'
  mood: TestMood
  sub: string
  kicker: string
  minutes: number
}

export type LikertVariant = 'likert' | 'cards' | 'yesno'

export type WizardStep =
  | {
      kind: 'intro'
      key: string
      title: string
      sub: string
      emoji: string
      minutes: number
      count: number
    }
  | {
      kind: 'scale'
      key: string
      index: number
      text: string
      section?: string
      scale: string[]
      leftLabel: string
      rightLabel: string
      variant: LikertVariant
      optionLabels?: string[]
    }
  | {
      kind: 'multi'
      key: string
      title: string
      hint: string
      items: { ico: string; label: string }[]
      store: 'chips' | 'fam' | 'flags' | 'backend'
      backendIndex?: number
      layout?: 'clinic' | 'flags'
    }
  | {
      kind: 'system'
      key: string
      index: number
      name: string
      ico: string
      color: string
      bg: string
      symptoms: string[]
    }
  | {
      kind: 'open'
      key: string
      index: number
      question: string
      placeholder: string
    }
  | {
      kind: 'priority'
      key: string
      items: typeof PRIORITIES
    }

export const THEMES_BY_ID: Record<number, TestTheme> = {
  1: {
    emoji: '🩺',
    accent: 'var(--blue)',
    accentSoft: 'var(--blue-l)',
    hero: 'hero-navy',
    mood: 'clinic',
    sub: 'Antecedentes · Examen físico · Sistemas',
    kicker: 'Historia clínica',
    minutes: 4,
  },
  2: {
    emoji: '🧠',
    accent: 'var(--pur)',
    accentSoft: 'var(--pur-l)',
    hero: 'hero-pur',
    mood: 'mind',
    sub: 'Sanguíneo · Colérico · Melancólico · Flemático',
    kicker: 'Temperamento',
    minutes: 5,
  },
  3: {
    emoji: '🥗',
    accent: 'var(--teal)',
    accentSoft: 'var(--teal-l)',
    hero: 'hero-teal',
    mood: 'food',
    sub: 'Alimentación · Conducta · Motivación',
    kicker: 'Nutrición',
    minutes: 3,
  },
  4: {
    emoji: '🏃',
    accent: 'var(--org)',
    accentSoft: 'var(--org-l)',
    hero: 'hero-navy',
    mood: 'move',
    sub: 'AMAF · Nivel funcional · Capacidad',
    kicker: 'Movimiento',
    minutes: 2,
  },
  5: {
    emoji: '🌙',
    accent: 'var(--pur)',
    accentSoft: 'var(--pur-l)',
    hero: 'hero-pur',
    mood: 'night',
    sub: 'Duración · Calidad · Hábitos · Riesgos',
    kicker: 'Sueño',
    minutes: 3,
  },
  6: {
    emoji: '🤝',
    accent: 'var(--cyan)',
    accentSoft: 'var(--ice-l)',
    hero: 'hero-navy',
    mood: 'bond',
    sub: 'Motivación · Autoeficacia · Compromiso',
    kicker: 'Adherencia',
    minutes: 2,
  },
  7: {
    emoji: '❤️',
    accent: 'var(--red)',
    accentSoft: 'var(--red-l)',
    hero: 'hero-cosmos',
    mood: 'heart',
    sub: 'OMS · Obesidad · Complicaciones · Riesgo',
    kicker: 'Riesgo ORP',
    minutes: 3,
  },
  8: {
    emoji: '⚡',
    accent: 'var(--org)',
    accentSoft: 'var(--org-l)',
    hero: 'hero-indigo',
    mood: 'storm',
    sub: 'Familia · Pareja · Trabajo · Entorno social',
    kicker: 'Estrés relacional',
    minutes: 2,
  },
  9: {
    emoji: '🧬',
    accent: 'var(--cyan)',
    accentSoft: 'var(--ice-l)',
    hero: 'hero-cosmos',
    mood: 'cosmos',
    sub: 'PHS · Propósito · Mentalidad · Perfil final',
    kicker: 'Batería ANTARES',
    minutes: 4,
  },
}

export const THEMES_BY_CODE: Record<string, TestTheme> = {
  'historia-clinica': THEMES_BY_ID[1],
  temperamento: THEMES_BY_ID[2],
  nutricional: THEMES_BY_ID[3],
  movimiento: THEMES_BY_ID[4],
  sueno: THEMES_BY_ID[5],
  'iac-adresd': THEMES_BY_ID[6],
  orp: THEMES_BY_ID[7],
  ers: THEMES_BY_ID[8],
  'bateria-antares': THEMES_BY_ID[9],
}

export const FALLBACK_THEME: TestTheme = {
  emoji: '📋',
  accent: 'var(--blue)',
  accentSoft: 'var(--blue-l)',
  hero: 'hero-cosmos',
  mood: 'clinic',
  sub: '',
  kicker: 'Evaluación',
  minutes: 3,
}

export function themeFor(code: string | null | undefined, demoId?: number | null): TestTheme {
  if (code && THEMES_BY_CODE[code]) return THEMES_BY_CODE[code]
  if (demoId && THEMES_BY_ID[demoId]) return THEMES_BY_ID[demoId]
  return FALLBACK_THEME
}

const SCALE_VALUES: Record<number, string[]> = {
  2: ['1', '2', '3', '4', '5'],
  3: ['1', '2', '3', '4', '5'],
  4: ['1', '2', '3', '4'],
  5: ['0', '1', '2', '3', '4'],
  6: ['0', '1', '2', '3', '4'],
  7: ['0', '1', '2', '3'],
  8: ['0', '1', '2', '3', '4'],
  9: ['1', '2', '3', '4', '5'],
}

const SCALE_META: Record<
  number,
  { left: string; right: string; variant: LikertVariant; optionLabels?: string[] }
> = {
  2: { left: 'Nada como yo', right: 'Totalmente como yo', variant: 'likert' },
  3: { left: 'Nunca', right: 'Siempre', variant: 'likert' },
  4: { left: 'No puedo', right: 'Sin dificultad', variant: 'likert' },
  5: { left: 'Nunca', right: 'Siempre', variant: 'likert' },
  6: { left: 'Nada', right: 'Totalmente', variant: 'likert' },
  7: {
    left: 'No',
    right: 'Sí',
    variant: 'cards',
    optionLabels: ['No', 'Leve', 'Moderado', 'Sí'],
  },
  8: { left: 'Nada', right: 'Mucho', variant: 'likert' },
  9: { left: 'En desacuerdo', right: 'De acuerdo', variant: 'likert' },
}

const QMAP: Record<number, ScaleQ[]> = {
  2: TEMP_QS,
  3: NUT_QS,
  4: MOV_QS,
  5: SLEEP_QS,
  6: ADHER_QS,
  7: CARDIO_QS,
  8: STRESS_QS,
  9: PURPOSE_SCALE,
}

function scaleSteps(testId: number, questions: ScaleQ[]): WizardStep[] {
  const meta = SCALE_META[testId] ?? {
    left: 'Nada',
    right: 'Mucho',
    variant: 'likert' as LikertVariant,
  }
  const scale = SCALE_VALUES[testId] ?? ['1', '2', '3', '4', '5']
  return questions.map((q, i) => ({
    kind: 'scale' as const,
    key: `s-${testId}-${i}`,
    index: i,
    text: q.text,
    section: q.section,
    scale,
    leftLabel: meta.left,
    rightLabel: meta.right,
    variant: meta.variant,
    optionLabels: meta.optionLabels,
  }))
}

function withIntro(theme: TestTheme, title: string, steps: WizardStep[]): WizardStep[] {
  return [
    {
      kind: 'intro',
      key: 'intro',
      title,
      sub: theme.sub,
      emoji: theme.emoji,
      minutes: theme.minutes,
      count: steps.length,
    },
    ...steps,
  ]
}

export function buildDemoSteps(openId: number, title: string): WizardStep[] {
  const theme = THEMES_BY_ID[openId] ?? FALLBACK_THEME

  if (openId === 1) {
    const steps: WizardStep[] = [
      {
        kind: 'multi',
        key: 'antecs',
        title: 'Antecedentes patológicos',
        hint: 'Marca todo lo que te hayan diagnosticado',
        items: ANTECS,
        store: 'chips',
        layout: 'clinic',
      },
      ...SISTEMAS.map((s, i) => ({
        kind: 'system' as const,
        key: `sis-${i}`,
        index: i,
        name: s.s,
        ico: s.ico,
        color: s.color,
        bg: s.bg,
        symptoms: s.sintomas,
      })),
      {
        kind: 'multi',
        key: 'fam',
        title: 'Antecedentes familiares',
        hint: 'Lo que conoces de padres, hermanos o hijos',
        items: FAM_HX,
        store: 'fam',
        layout: 'clinic',
      },
    ]
    return withIntro(theme, title, steps)
  }

  if (openId >= 2 && openId <= 8) {
    const qs = QMAP[openId] ?? []
    const steps = scaleSteps(openId, qs)
    if (openId === 5) {
      steps.push({
        kind: 'multi',
        key: 'flags',
        title: 'Señales de alerta',
        hint: 'Marca si te ocurre alguna de estas situaciones',
        items: SLEEP_FLAGS,
        store: 'flags',
      })
    }
    return withIntro(theme, title, steps)
  }

  if (openId === 9) {
    const steps: WizardStep[] = [
      ...PURPOSE_OPEN.map((p, i) => ({
        kind: 'open' as const,
        key: `open-${i}`,
        index: i,
        question: p.q,
        placeholder: p.ph,
      })),
      ...scaleSteps(9, PURPOSE_SCALE),
      { kind: 'priority', key: 'prio', items: PRIORITIES },
    ]
    return withIntro(theme, title, steps)
  }

  return withIntro(theme, title, [])
}

function inferScaleMeta(
  options: string[],
  mood?: TestMood,
): {
  left: string
  right: string
  variant: LikertVariant
  optionLabels?: string[]
} {
  const numeric = options.length > 0 && options.every((o) => /^\d+$/.test(o.trim()))
  if (mood === 'move') {
    return {
      left: !numeric && options[0] ? options[0] : 'No puedo',
      right: !numeric && options[options.length - 1] ? options[options.length - 1] : 'Sin dificultad',
      variant: 'likert',
    }
  }
  if (options.length >= 4 && numeric) {
    return {
      left: 'Nada',
      right: 'Mucho',
      variant: 'likert',
    }
  }
  if (options.length === 2) {
    return { left: options[0], right: options[1], variant: 'yesno', optionLabels: options }
  }
  if (options.length <= 4) {
    return {
      left: options[0] ?? 'No',
      right: options[options.length - 1] ?? 'Sí',
      variant: 'cards',
      optionLabels: options,
    }
  }
  return { left: options[0] ?? 'Nada', right: options[options.length - 1] ?? 'Mucho', variant: 'likert' }
}

export function buildBackendSteps(
  questions: MeQuestion[],
  title: string,
  theme: TestTheme,
): WizardStep[] {
  const steps: WizardStep[] = questions.map((q, qi) => {
    if (q.type === 'multi') {
      return {
        kind: 'multi' as const,
        key: q.id,
        title: q.section || q.text,
        hint: q.section ? q.text : 'Marca todo lo que aplique',
        items: q.options.map((o) => ({ ico: '•', label: o.text })),
        store: 'backend' as const,
        backendIndex: qi,
        layout: theme.mood === 'clinic' ? ('clinic' as const) : 'flags',
      }
    }
    if (q.type === 'open') {
      return {
        kind: 'open' as const,
        key: q.id,
        index: qi,
        question: q.section || q.text,
        placeholder: q.text,
      }
    }
    const optionTexts = q.options.map((o) => o.text)
    const meta = inferScaleMeta(optionTexts, theme.mood)
    return {
      kind: 'scale' as const,
      key: q.id,
      index: qi,
      text: q.text,
      section: q.section ?? undefined,
      scale: optionTexts.length > 0 ? optionTexts.map((_, i) => String(i + 1)) : ['1', '2', '3', '4', '5'],
      leftLabel: meta.left,
      rightLabel: meta.right,
      variant: meta.variant,
      optionLabels: meta.optionLabels,
    }
  })
  return withIntro(theme, title, steps)
}

export function isNoneLabel(label: string): boolean {
  return /ninguno/i.test(label)
}

export function itemTint(label: string): { bg: string; fg: string } {
  const s = label.toLowerCase()
  if (isNoneLabel(s)) return { bg: 'var(--g1)', fg: 'var(--mu)' }
  if (/diabetes|prediabetes/.test(s)) return { bg: 'var(--red-l)', fg: 'var(--red)' }
  if (/hipertens|hta/.test(s)) return { bg: 'var(--blue-l)', fg: 'var(--blue)' }
  if (/cardio|coronaria/.test(s)) return { bg: 'var(--red-l)', fg: 'var(--red)' }
  if (/colesterol|triglic/.test(s)) return { bg: 'var(--org-l)', fg: 'var(--org)' }
  if (/hígado|higado/.test(s)) return { bg: 'var(--org-l)', fg: '#b45309' }
  if (/asma|epoc/.test(s)) return { bg: 'var(--blue-l)', fg: 'var(--blue)' }
  if (/artros/.test(s)) return { bg: 'var(--org-l)', fg: '#b45309' }
  if (/depres|ansied|acv/.test(s)) return { bg: 'var(--pur-l)', fg: 'var(--pur)' }
  if (/tiroides|cáncer|cancer/.test(s)) return { bg: 'var(--pur-l)', fg: 'var(--pur)' }
  return { bg: 'var(--blue-l)', fg: 'var(--blue)' }
}

export function sectionTone(section?: string): string {
  if (!section) return ''
  const s = section.toLowerCase()
  if (s.includes('sanguíneo') || s.includes('sanguineo')) return 'sang'
  if (s.includes('colérico') || s.includes('colerico')) return 'col'
  if (s.includes('melancólico') || s.includes('melancolico')) return 'mel'
  if (s.includes('flemático') || s.includes('flematico')) return 'fle'
  if (s.includes('riesgo') || s.includes('alerta')) return 'risk'
  if (s.includes('motiv') || s.includes('propósito') || s.includes('proposito')) return 'goal'
  return ''
}

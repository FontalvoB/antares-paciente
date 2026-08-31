import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { IonButton, IonIcon, IonLoading, IonProgressBar, IonSpinner } from '@ionic/react'
import {
  checkmarkCircle,
  chevronBack,
  chevronForward,
  sparkles,
} from 'ionicons/icons'
import {
  TESTS_META,
} from '../data/tests'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'
import {
  fetchMyAssignments,
  fetchMyResults,
  fetchMyTest,
  startMyTest,
  submitMyTest,
  type MeAssignment,
  type MeQuestion,
  type MeResult,
} from '../utils/healthTestsApi'
import { TestWizard, type WizardExtras } from '../components/tests/TestWizard'
import {
  buildBackendSteps,
  buildDemoSteps,
  FALLBACK_THEME,
  themeFor,
  type TestTheme,
} from '../components/tests/model'

const EASE = [0.22, 1, 0.36, 1] as const
const MIN_REQUIRED_TESTS = 3

const CODE_TO_DEMO: Record<string, number> = {
  'historia-clinica': 1,
  temperamento: 2,
  nutricional: 3,
  movimiento: 4,
  sueno: 5,
  'iac-adresd': 6,
  orp: 7,
  ers: 8,
  'bateria-antares': 9,
}

const DEMO_SCORES: { label: string; value: number; color: string }[] = [
  { label: 'Metabolismo', value: 62, color: '#E87B2B' },
  { label: 'Nutrición', value: 74, color: '#1D9E75' },
  { label: 'Movimiento', value: 58, color: '#1B6CA8' },
  { label: 'Sueño', value: 51, color: '#7C3AED' },
  { label: 'Adherencia', value: 81, color: 'var(--cyan)' },
  { label: 'Estrés', value: 44, color: '#E24B4A' },
]

function stateLabel(status: MeAssignment['status']): string {
  if (status === 'completed') return 'Completado'
  if (status === 'in_progress') return 'En curso'
  return 'Pendiente'
}

export function TestsPage() {
  const { testsDone, markTest, skipTests, finishTests, showToast } = useApp()
  const t = useT()
  const reduce = useReducedMotion()

  const [assignments, setAssignments] = useState<MeAssignment[] | null>(null)
  const [openQuestions, setOpenQuestions] = useState<MeQuestion[] | null>(null)
  const [backendResults, setBackendResults] = useState<MeResult[] | null>(null)
  const [questionsLoading, setQuestionsLoading] = useState(false)

  const [openId, setOpenId] = useState<number | null>(null)
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null)
  const [openTitle, setOpenTitle] = useState('')
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [answers, setAnswers] = useState<
    Record<number, Record<number, number | number[] | string>>
  >({})
  const [chips, setChips] = useState<number[]>([])
  const [fam, setFam] = useState<number[]>([])
  const [flags, setFlags] = useState<number[]>([])
  const [priority, setPriority] = useState<number | null>(null)
  const [openNotes, setOpenNotes] = useState<string[]>(['', '', ''])
  const [showResult, setShowResult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sisSel, setSisSel] = useState<Record<number, number[]>>({})

  const totalTests = assignments ? assignments.length : 9
  const completed = assignments
    ? assignments.filter((a) => a.status === 'completed').length
    : testsDone.length
  const pct = Math.round((completed / Math.max(totalTests, 1)) * 100)

  useEffect(() => {
    let cancelled = false
    fetchMyAssignments()
      .then((list) => {
        if (!cancelled) setAssignments(list)
      })
      .catch(() => {})
    fetchMyResults()
      .then((results) => {
        if (!cancelled) setBackendResults(results)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const listItems = useMemo(() => {
    const nextDemo = (): number => {
      const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !testsDone.includes(n))
      return remaining.length === 0 ? -1 : remaining[0]
    }
    if (assignments) {
      return assignments.map((a, idx) => {
        const visual = themeFor(a.testCode ?? '')
        return {
          key: a.id,
          id: idx,
          assignmentId: a.id,
          title: a.testName ?? `Evaluación ${idx + 1}`,
          sub: visual.sub || stateLabel(a.status),
          emoji: visual.emoji,
          bg: visual.accentSoft,
          accent: visual.accent,
          mood: visual.mood,
          code: a.testCode,
          done: a.status === 'completed',
          activeNow: a.status === 'in_progress',
        }
      })
    }
    return TESTS_META.map((test) => {
      const visual = themeFor(null, test.id)
      return {
        key: String(test.id),
        id: test.id,
        assignmentId: null as string | null,
        title: test.title,
        sub: test.sub,
        emoji: test.emoji,
        bg: visual.accentSoft,
        accent: visual.accent,
        mood: visual.mood,
        code: null as string | null,
        done: testsDone.includes(test.id),
        activeNow: !testsDone.includes(test.id) && test.id === nextDemo(),
      }
    })
  }, [assignments, testsDone])

  const theme: TestTheme =
    openId !== null ? themeFor(openCode, assignments ? undefined : openId) : FALLBACK_THEME

  const openTest = async (item: (typeof listItems)[number]) => {
    setOpenId(item.id)
    setOpenAssignmentId(item.assignmentId)
    setOpenTitle(item.title)
    setOpenCode(item.code)
    setOpenQuestions(null)
    if (item.assignmentId) {
      setQuestionsLoading(true)
      try {
        const detail = await fetchMyTest(item.assignmentId)
        setOpenQuestions(detail.questions)
      } catch {
        setOpenQuestions(null)
      } finally {
        setQuestionsLoading(false)
      }
    }
  }

  const closeTest = () => {
    setOpenId(null)
    setOpenAssignmentId(null)
    setOpenQuestions(null)
    setOpenCode(null)
  }

  const saveTest = async () => {
    if (openId === null) return

    if (openAssignmentId) {
      setLoading(true)
      try {
        const questions = openQuestions ?? []
        const answersPayload = questions.flatMap((q, qi) => {
          const value = answers[openId]?.[qi]
          if (q.type === 'multi') {
            const selected: number[] = Array.isArray(value) ? value : []
            return selected.map((vi) => ({
              questionId: q.id,
              answerOptionId: q.options[vi]?.id ?? null,
            }))
          }
          if (q.type === 'open') {
            return [
              {
                questionId: q.id,
                answerOptionId: null,
                valueText: String(value ?? ''),
              },
            ]
          }
          const option = value !== undefined ? q.options[value as number] : null
          return [
            {
              questionId: q.id,
              answerOptionId: option?.id ?? null,
            },
          ]
        })
        await startMyTest(openAssignmentId).catch(() => null)
        await submitMyTest(openAssignmentId, answersPayload)
        markTest(openId)
        const list = await fetchMyAssignments().catch(() => null)
        if (list) setAssignments(list)
        showToast(t('Evaluación guardada'), 'ok')
      } catch {
        showToast(t('No se pudo guardar la evaluación'), 'err')
      } finally {
        setLoading(false)
        closeTest()
      }
      return
    }

    markTest(openId)
    showToast(t('Evaluación guardada'), 'ok')
    closeTest()
  }

  const openIA = () => {
    setShowResult(true)
    setLoading(true)
    window.setTimeout(() => setLoading(false), 1600)
  }

  const steps = useMemo(() => {
    if (openId === null) return []
    if (openAssignmentId && openQuestions) {
      return buildBackendSteps(openQuestions, openTitle, theme)
    }
    if (openAssignmentId && questionsLoading) return []
    const demoId = openCode ? (CODE_TO_DEMO[openCode] ?? openId) : openId
    return buildDemoSteps(
      demoId,
      openTitle || TESTS_META.find((x) => x.id === demoId)?.title || '',
    )
  }, [openId, openAssignmentId, openQuestions, openTitle, theme, questionsLoading, openCode])

  const resultScores = useMemo(() => {
    if (backendResults && backendResults.length > 0) {
      return backendResults
        .filter((r) => r.resultType === 'subscale' || r.resultType === 'score')
        .slice(0, 6)
        .map((r) => ({
          label: r.label,
          value: Math.min(100, Math.round(r.value)),
          color: 'var(--cyan)',
        }))
    }
    return DEMO_SCORES
  }, [backendResults])

  const currentAnswers = openId !== null ? (answers[openId] ?? {}) : {}
  const canSkip = completed >= MIN_REQUIRED_TESTS

  const trySkip = () => {
    if (!canSkip) {
      showToast(
        t('Completa al menos {n} evaluaciones para poder omitir el resto', {
          n: String(MIN_REQUIRED_TESTS),
        }),
        'warn',
      )
      return
    }
    skipTests()
  }

  const extras: WizardExtras = {
    chips,
    fam,
    flags,
    sisSel,
    priority,
    openNotes,
    onToggleSis: (sys, symptom) => {
      const cur = sisSel[sys] ?? []
      const on = cur.includes(symptom)
      setSisSel({
        ...sisSel,
        [sys]: on ? cur.filter((x) => x !== symptom) : [...cur, symptom],
      })
    },
    onSetChips: setChips,
    onSetFam: setFam,
    onSetFlags: setFlags,
    onClearSis: (sys) => setSisSel((cur) => ({ ...cur, [sys]: [] })),
    onPriority: setPriority,
    onOpenNote: (i, value) => {
      setOpenNotes((prev) => {
        const next = [...prev]
        next[i] = value
        return next
      })
      if (openAssignmentId && openId !== null) {
        setAnswers((a) => ({
          ...a,
          [openId]: { ...(a[openId] ?? {}), [i]: value },
        }))
      }
    },
  }

  const heroClass = showResult ? 'hero-cosmos' : openId !== null ? theme.hero : 'hero-cosmos'

  return (
    <div className={`screen ht-page mood-${showResult ? 'cosmos' : openId !== null ? theme.mood : 'list'}`}>
      <div className={`hero ${heroClass} ht-hero`}>
        <div className="ht-hero-orbs" aria-hidden="true" />
        <div className="ht-hero-top">
          {(openId !== null || showResult) && (
            <IonButton
              fill="clear"
              className="ht-hero-back"
              aria-label={t('Volver')}
              onClick={() => {
                if (showResult) setShowResult(false)
                else closeTest()
              }}
            >
              <IonIcon slot="icon-only" icon={chevronBack} />
            </IonButton>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">{t('ANTARES · PERFIL DE SALUD')}</div>
            <div className="h2">
              {openId !== null && !showResult
                ? t(openTitle || theme.kicker)
                : t('Batería de evaluación inicial')}
            </div>
          </div>
          {!showResult && (
            <IonButton fill="solid" className="bt ht-skip" onClick={trySkip}>
              {t('Después')}
            </IonButton>
          )}
        </div>
        {openId === null && !showResult && (
          <>
            <div className="ht-hero-meta">
              <span>
                {t('{completed} de {total} evaluaciones', {
                  completed: String(completed),
                  total: String(totalTests),
                })}
              </span>
              <span>{pct}%</span>
            </div>
            <IonProgressBar
              className="pb"
              style={
                {
                  marginTop: 8,
                  '--background': 'rgba(255,255,255,.12)',
                  '--progress-background': 'linear-gradient(90deg,var(--teal),var(--cyan))',
                } as CSSProperties
              }
              value={pct / 100}
            />
          </>
        )}
      </div>

      {showResult ? (
        <HealthResult scores={resultScores} onEnter={finishTests} />
      ) : openId === null ? (
        <div className="screen-scroll no-nav ht-list">
          <p className="ht-lead">
            {t(
              'Completa al menos {n} evaluaciones para personalizar tu programa. El resto puedes hacerlo después.',
              { n: String(MIN_REQUIRED_TESTS) },
            )}
          </p>
          {listItems.map((test, i) => (
            <motion.button
              key={test.key}
              type="button"
              className={`ht-list-card ${test.done ? 'done' : ''} ${test.activeNow ? 'now' : ''}`}
              onClick={() => void openTest(test)}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: reduce ? 0 : i * 0.05, ease: EASE }}
            >
              <div className="ht-list-accent" style={{ background: test.accent }} />
              <div className="ht-list-ico" style={{ background: test.bg }}>
                {test.emoji}
              </div>
              <div className="ht-list-body">
                <div className="ht-list-title">
                  {i + 1}. {t(test.title)}
                </div>
                <div className="ht-list-sub">{t(test.sub)}</div>
              </div>
              <span className={`ht-list-badge ${test.done ? 'ok' : test.activeNow ? 'hot' : ''}`}>
                {test.done ? (
                  <>
                    <IonIcon icon={checkmarkCircle} />
                    {t('Hecho')}
                  </>
                ) : test.activeNow ? (
                  t('Ahora')
                ) : (
                  t('Pendiente')
                )}
              </span>
              <IonIcon icon={chevronForward} className="ht-list-chev" />
            </motion.button>
          ))}
          {canSkip && (
            <IonButton expand="block" className="bt bt-gold ht-cta" style={{ marginTop: 12 }} onClick={openIA}>
              {t('Ver mi perfil de salud ANTARES · IA')}
              <IonIcon icon={sparkles} slot="end" />
            </IonButton>
          )}
        </div>
      ) : questionsLoading ? (
        <div className="ht-loading">
          <IonSpinner name="crescent" />
          <p>{t('Preparando tu evaluación…')}</p>
        </div>
      ) : (
        <TestWizard
          theme={theme}
          steps={steps}
          answers={currentAnswers}
          extras={extras}
          onScale={(index, value) => {
            if (openId === null) return
            setAnswers((a) => ({
              ...a,
              [openId]: { ...(a[openId] ?? {}), [index]: value },
            }))
          }}
          onBackendMulti={(index, option) => {
            if (openId === null) return
            setAnswers((a) => {
              const cur = (a[openId]?.[index] as number[] | undefined) ?? []
              const next = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option]
              return { ...a, [openId]: { ...(a[openId] ?? {}), [index]: next } }
            })
          }}
          onComplete={() => void saveTest()}
        />
      )}

      <IonLoading className="app-loading" isOpen={loading} message={t('Analizando tu perfil…')} />
    </div>
  )
}

function HealthResult({
  scores,
  onEnter,
}: {
  scores: { label: string; value: number; color: string }[]
  onEnter: () => void
}) {
  const t = useT()
  const reduce = useReducedMotion()

  return (
    <div className="screen-scroll no-nav ht-result">
      <motion.div
        className="ht-scoreboard"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {scores.map((s, i) => (
          <div key={String(s.label)} className="ht-score-row">
            <span>{t(String(s.label))}</span>
            <div className="ht-score-track">
              <motion.div
                className="ht-score-fill"
                style={{ background: String(s.color) }}
                initial={{ width: 0 }}
                animate={{ width: `${Number(s.value)}%` }}
                transition={{ duration: reduce ? 0 : 0.9, delay: i * 0.08, ease: EASE }}
              />
            </div>
            <strong>{s.value}</strong>
          </div>
        ))}
      </motion.div>

      <motion.div
        className="ht-ai-card"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.35 }}
      >
        <div className="ht-ai-label">{t('🤖 ANTARES AI')}</div>
        <p>
          {t(
            'Perfil de riesgo bajo-moderado. Prediabetes (HbA1c 5.9%) con buena adherencia (81%) y temperamento mixto sanguíneo-flemático. Prioriza sueño, control glucémico y movimiento progresivo de 12 min/día.',
          )}
        </p>
      </motion.div>

      <div className="ht-split">
        <div className="ht-pill-card ok">
          <div className="ht-pill-h">{t('Fortalezas')}</div>
          <div>{t('Adherencia alta · Apoyo familiar · Motivación clara')}</div>
        </div>
        <div className="ht-pill-card risk">
          <div className="ht-pill-h">{t('Riesgos')}</div>
          <div>{t('Prediabetes · Sueño 6.8h · Antecedente familiar DM2')}</div>
        </div>
      </div>

      <IonButton expand="block" className="bt bt-gold ht-cta" onClick={onEnter}>
        {t('Entrar a mi programa ANTARES')}
      </IonButton>
    </div>
  )
}

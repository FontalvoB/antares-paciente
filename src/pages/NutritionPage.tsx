import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  IonActionSheet,
  IonButton,
  IonIcon,
  IonInput,
  IonModal,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/react'
import {
  cameraOutline,
  ellipsisHorizontal,
  flameOutline,
  refreshOutline,
} from 'ionicons/icons'
import { PageHeader } from '../components/PageHeader'
import { Screen, Scroll } from '../components/Screen'
import { CameraCapture } from '../components/CameraCapture'
import { useApp } from '../context/AppContext'
import { useI18n, useT } from '../i18n/I18nContext'
import { useNutritionLog } from '../hooks/useNutritionLog'
import { useProgram } from '../hooks/useProgram'
import type { MealCode, NutritionIntakePayload } from '../services/program/nutrition-service'
import type { NutritionIntakeLogDto } from '../services/program/types'
import { ApiError } from '../utils/apiClient'
import { mealTypeToCode } from '../utils/mealTypeToCode'
import { buildHydrationIntake, buildPlanTargets, prefillIntakeForm } from '../utils/nutritionForm'
import { deriveLoggedMeals } from '../utils/nutritionProgress'
import {
  analyzeFoodImage,
  displayName,
  FOOD_EMOJI,
  type DetectedFood,
  type FoodAnalysisResult,
} from '../utils/foodAiApi'

const MEAL_LABELS: Record<MealCode, string> = {
  des: 'Desayuno',
  alm: 'Almuerzo',
  mer: 'Merienda',
  cen: 'Cena',
  agua: 'Hidratación',
}

const MEAL_CODE_EMOJI: Record<MealCode, string> = {
  des: '🌅',
  alm: '☀️',
  mer: '🍎',
  cen: '🌙',
  agua: '💧',
}

const MACRO_COLORS = {
  carbs: 'var(--blue)',
  protein: 'var(--teal)',
  fat: 'var(--org)',
  fiber: 'var(--pur)',
} as const

type FoodRow = {
  emoji: string
  name: string
  note: string
  carbs: string
  protein: string
  fat: string
}

type DisplayMeal = {
  id: MealCode
  emoji: string
  name: string
  time: string
  kcal: number
  items: FoodRow[]
}

const defaultMeals: DisplayMeal[] = [
  {
    id: 'des',
    emoji: '🌅',
    name: 'Desayuno',
    time: '7:00 AM',
    kcal: 380,
    items: [
      { emoji: '🥣', name: 'Avena enrollada (½ taza)', note: 'β-glucanos · Bajo IG', carbs: '31g C', protein: '5g P', fat: '' },
      { emoji: '🍓', name: 'Frutos rojos mixtos', note: 'Antioxidantes · Vit. C', carbs: '10g C', protein: '', fat: '' },
      { emoji: '🥚', name: '2 claras de huevo', note: 'Proteína magra', carbs: '', protein: '7g P', fat: '' },
      { emoji: '🍵', name: 'Té verde sin azúcar', note: 'EGCG · 0 kcal', carbs: '0g', protein: '', fat: '' },
    ],
  },
  {
    id: 'alm',
    emoji: '☀️',
    name: 'Almuerzo',
    time: '12:00 PM',
    kcal: 620,
    items: [
      { emoji: '🍗', name: 'Pechuga de pollo 4 oz', note: 'Proteína magra · sin piel', carbs: '', protein: '26g P', fat: '3g G' },
      { emoji: '🍚', name: 'Arroz integral ½ taza', note: 'Grano entero · 2g fibra', carbs: '22g C', protein: '', fat: '' },
      { emoji: '🥗', name: 'Ensalada + EVOO y limón', note: 'Espinaca · Omega-9', carbs: '8g C', protein: '', fat: '7g G' },
    ],
  },
  {
    id: 'mer',
    emoji: '🍎',
    name: 'Merienda',
    time: '3:30 PM',
    kcal: 200,
    items: [
      { emoji: '🍎', name: 'Manzana mediana', note: 'Pectina · IG bajo 36', carbs: '25g C', protein: '', fat: '' },
      { emoji: '🥜', name: 'Almendras 1 oz', note: 'Vit. E · Mg', carbs: '', protein: '6g P', fat: '14g G' },
    ],
  },
  {
    id: 'cen',
    emoji: '🌙',
    name: 'Cena',
    time: '7:00 PM',
    kcal: 450,
    items: [
      { emoji: '🍲', name: 'Sopa de lentejas 1½ taza', note: '18g proteína vegetal', carbs: '40g C', protein: '18g P', fat: '' },
      { emoji: '🍞', name: 'Pan integral 1 rebanada', note: 'Grano entero · 3g fibra', carbs: '15g C', protein: '', fat: '' },
    ],
  },
]

const week = [
  ['Lu', 96],
  ['Ma', 88],
  ['Mi', 74],
  ['Ju', 91],
  ['Vi', 85],
  ['Sa', 68],
  ['Do', 93],
] as const

const RING_R = 38
const RING_CIRC = 2 * Math.PI * RING_R

function sumIntake(logs: NutritionIntakeLogDto[] | null | undefined) {
  const acc = { kcal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0 }
  for (const log of logs ?? []) {
    if (log.mealCode === 'agua') continue
    acc.kcal += log.calories ?? 0
    acc.carbs += log.carbsG ?? 0
    acc.protein += log.proteinG ?? 0
    acc.fat += log.fatG ?? 0
    acc.fiber += log.fiberG ?? 0
  }
  return acc
}

function formatQty(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

export function NutritionPage() {
  const { hydration, setHydration, logMeal, showToast } = useApp()
  const { snapshot } = useProgram()
  const t = useT()
  const { lang } = useI18n()
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const nutritionMutation = useNutritionLog()
  const [tab, setTab] = useState<'hoy' | 'semana' | 'indicaciones' | 'historial'>('hoy')
  const [openDay, setOpenDay] = useState(1)
  const [selectedMealId, setSelectedMealId] = useState<MealCode>('des')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickGallery, setPickGallery] = useState(false)

  const [registerTarget, setRegisterTarget] = useState<MealCode | null>(null)
  const [intakeForm, setIntakeForm] = useState({
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
  })

  const nutContent = snapshot?.todayTasks?.find((task) => task.taskCode === 'nut')?.content
  const planTitle = nutContent?.nutritionPlanName || t('Ana Torres, RDN · plan asignado')
  const calorieTarget = nutContent?.dailyCalorieTarget || 1800
  const carbsGoal = nutContent?.dailyCarbsTarget || 168
  const proteinGoal = nutContent?.dailyProteinTarget || 90
  const fatGoal = nutContent?.dailyFatTarget || 50
  const fiberGoal = nutContent?.dailyFiberTarget || 28

  const planTargets = useMemo(
    () => buildPlanTargets(nutContent?.nutritionMeals),
    [nutContent],
  )

  const loggedSet = useMemo(() => new Set(deriveLoggedMeals(snapshot)), [snapshot])

  const displayMeals = useMemo(() => {
    if (nutContent?.nutritionMeals && nutContent.nutritionMeals.length > 0) {
      const byId = new Map<MealCode, DisplayMeal>()
      for (const meal of nutContent.nutritionMeals) {
        const id = mealTypeToCode(meal.mealType) ?? 'cen'
        const row: FoodRow = {
          emoji: '🍽️',
          name: meal.description || meal.foods || meal.mealType,
          note: meal.notes || 'Recomendación del plan clínico',
          carbs: meal.carbsG ? `${meal.carbsG}g C` : '',
          protein: meal.proteinG ? `${meal.proteinG}g P` : '',
          fat: meal.fatG ? `${meal.fatG}g G` : '',
        }
        const existing = byId.get(id)
        if (existing) {
          existing.items.push(row)
          existing.kcal += meal.calories || 0
        } else {
          byId.set(id, {
            id,
            emoji: MEAL_CODE_EMOJI[id],
            name: MEAL_LABELS[id],
            time: '',
            kcal: meal.calories || 0,
            items: [row],
          })
        }
      }
      return [...byId.values()]
    }
    return defaultMeals
  }, [nutContent])

  useEffect(() => {
    if (!displayMeals.some((meal) => meal.id === selectedMealId) && displayMeals[0]) {
      setSelectedMealId(displayMeals[0].id)
    }
  }, [displayMeals, selectedMealId])

  const selectedMeal = displayMeals.find((meal) => meal.id === selectedMealId) ?? displayMeals[0]
  const selectedLogged = selectedMeal ? loggedSet.has(selectedMeal.id) : false

  const consumed = useMemo(() => {
    const fromLogs = sumIntake(nutContent?.nutritionIntakeLogs)
    if (snapshot) return fromLogs
    return { kcal: 1650, carbs: 158, protein: 79, fat: 42, fiber: 22 }
  }, [nutContent, snapshot])

  const kcalPct = calorieTarget > 0 ? Math.min(1, consumed.kcal / calorieTarget) : 0

  type AnalysisState = 'idle' | 'camera' | 'analyzing' | 'success' | 'error'
  const [analysis, setAnalysis] = useState<AnalysisState>('idle')
  const [photo, setPhoto] = useState<string | null>(null)
  const [result, setResult] = useState<FoodAnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  const steps = [
    t('Foto tomada'),
    t('Analizando tu comida…'),
    t('Identificando alimentos…'),
    t('Calculando información nutricional…'),
  ]
  useEffect(() => {
    if (analysis !== 'analyzing') return
    setStep(1)
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 800)
    return () => clearInterval(id)
  }, [analysis, steps.length])

  useEffect(() => {
    if (analysis !== 'camera' || !pickGallery) return
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]')?.click()
      setPickGallery(false)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [analysis, pickGallery])

  async function runAnalysis(blob: Blob, fileName: string) {
    setPhoto(URL.createObjectURL(blob))
    setAnalysis('analyzing')
    setAnalysisError(null)
    setResult(null)
    try {
      const data = await analyzeFoodImage(blob, fileName)
      setResult(data)
      setAnalysis(data.foods.length > 0 ? 'success' : 'error')
      if (data.foods.length === 0) {
        setAnalysisError(t('No se identificaron alimentos con suficiente confianza.'))
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : t('Ocurrió un error al analizar la imagen.'))
      setAnalysis('error')
    }
  }

  function resetAnalysis() {
    if (photo) URL.revokeObjectURL(photo)
    setPhoto(null)
    setResult(null)
    setAnalysisError(null)
    setAnalysis('idle')
    setStep(0)
    setPickGallery(false)
  }

  const openRegister = (id: MealCode) => {
    setIntakeForm(prefillIntakeForm(planTargets.get(id)))
    setRegisterTarget(id)
  }

  const submitRegister = () => {
    if (!registerTarget) return
    const num = (s: string): number | undefined => {
      if (s.trim() === '') return undefined
      const value = Number(s)
      return Number.isNaN(value) ? undefined : value
    }
    const intake: NutritionIntakePayload = {
      calories: num(intakeForm.calories),
      proteinG: num(intakeForm.proteinG),
      carbsG: num(intakeForm.carbsG),
      fatG: num(intakeForm.fatG),
      fiberG: num(intakeForm.fiberG),
      source: 'manual',
    }
    if (!snapshot) logMeal(registerTarget)
    nutritionMutation.mutate(
      { mealCode: registerTarget, intake },
      {
        onSuccess: () => {
          showToast(t('Comida registrada'), 'ok')
          setRegisterTarget(null)
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setRegisterTarget(null)
            return
          }
          if (error instanceof ApiError && error.errors?.missingMealCodes?.length) {
            showToast(
              t('Faltan comidas del plan: {meals}', {
                meals: error.errors.missingMealCodes.join(', '),
              }),
              'err',
            )
            return
          }
          showToast(error.message || t('No se pudo registrar la comida'), 'err')
        },
      },
    )
  }

  const logAnalysis = (id: MealCode) => {
    const summary = result?.summary
    const intake: NutritionIntakePayload = summary
      ? {
          calories: Math.round(summary.calories),
          proteinG: summary.protein,
          carbsG: summary.carbohydrates,
          fatG: summary.fat,
          fiberG: summary.fiber,
          source: 'ai_photo',
          foodAnalysisId: result?.analysisId,
        }
      : { source: 'ai_photo', foodAnalysisId: result?.analysisId }
    if (!snapshot) logMeal(id)
    nutritionMutation.mutate(
      { mealCode: id, intake },
      {
        onSuccess: () => {
          showToast(t('Comida registrada con foto'), 'ok')
          resetAnalysis()
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            resetAnalysis()
            return
          }
          if (error instanceof ApiError && error.errors?.missingMealCodes?.length) {
            showToast(
              t('Faltan comidas del plan: {meals}', {
                meals: error.errors.missingMealCodes.join(', '),
              }),
              'err',
            )
            return
          }
          showToast(error.message || t('No se pudo registrar la comida'), 'err')
        },
      },
    )
  }

  const tapGlass = (n: number) => {
    setHydration(n)
    if (n > hydration) {
      nutritionMutation.mutate(
        {
          mealCode: 'agua',
          intake: buildHydrationIntake(n),
        },
        {
          onError: (error) => {
            if (error instanceof ApiError && error.status === 409) return
            showToast(error.message || t('No se pudo registrar la comida'), 'err')
          },
        },
      )
    }
  }

  const openCamera = () => {
    setPickGallery(false)
    setAnalysis('camera')
  }

  const openGallery = () => {
    setPickGallery(true)
    setAnalysis('camera')
  }

  const macros = [
    { key: 'Carbohidratos', value: consumed.carbs, goal: carbsGoal, color: MACRO_COLORS.carbs },
    { key: 'Proteínas', value: consumed.protein, goal: proteinGoal, color: MACRO_COLORS.protein },
    { key: 'Grasas', value: consumed.fat, goal: fatGoal, color: MACRO_COLORS.fat },
    { key: 'Fibra', value: consumed.fiber, goal: fiberGoal, color: MACRO_COLORS.fiber },
  ]

  return (
    <Screen>
      <PageHeader title={t('Nutrición')} sub={t(planTitle)} />

      <div className="nut-dash">
        <div className="nut-macros">
          {macros.map((macro) => (
            <div key={macro.key} className="nut-macro">
              <span className="nut-macro-label">{t(macro.key)}</span>
              <IonProgressBar
                className="nut-macro-bar"
                style={{ '--progress-background': macro.color } as CSSProperties}
                value={macro.goal > 0 ? Math.min(1, macro.value / macro.goal) : 0}
              />
              <span className="nut-macro-val">{t('{n}g', { n: String(Math.round(macro.value)) })}</span>
            </div>
          ))}
        </div>
        <div
          className="nut-ring"
          role="img"
          aria-label={t('{kcal} de {target} kcal', {
            kcal: formatQty(consumed.kcal, locale),
            target: formatQty(calorieTarget, locale),
          })}
        >
          <svg width="108" height="108" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={RING_R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r={RING_R}
              fill="none"
              stroke="var(--teal)"
              strokeWidth="9"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_CIRC * (1 - kcalPct)}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="nut-ring-label" aria-hidden="true">
            <strong>{formatQty(consumed.kcal, locale)}</strong>
            <span>/{formatQty(calorieTarget, locale)}</span>
          </div>
        </div>
      </div>

      {tab === 'hoy' && (
        <div className="nut-meals" role="tablist" aria-label={t('Comidas')}>
          {displayMeals.map((meal) => (
            <button
              key={meal.id}
              type="button"
              role="tab"
              aria-selected={meal.id === selectedMeal?.id}
              className={`nut-meal-tab${meal.id === selectedMeal?.id ? ' on' : ''}`}
              onClick={() => setSelectedMealId(meal.id)}
            >
              <span className="nut-meal-tab-name">{t(meal.name)}</span>
              {meal.time ? <span className="nut-meal-tab-time">({meal.time})</span> : null}
            </button>
          ))}
        </div>
      )}

      <IonSegment
        className="plan-seg nut-period"
        value={tab}
        onIonChange={(e) => setTab((e.detail.value as typeof tab) ?? 'hoy')}
      >
        <IonSegmentButton value="hoy">{t('Hoy')}</IonSegmentButton>
        <IonSegmentButton value="semana">{t('Semana')}</IonSegmentButton>
        <IonSegmentButton value="indicaciones">{t('Plan')}</IonSegmentButton>
        <IonSegmentButton value="historial">{t('Historial')}</IonSegmentButton>
      </IonSegment>

      <Scroll>
        {tab === 'hoy' && selectedMeal && (
          <>
            <div className="nut-hyd">
              <div className="nut-hyd-title">{t('💧 Hidratación · 8 vasos (2L)')}</div>
              <div className="nut-hyd-row">
                {Array.from({ length: 8 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`nut-glass${i < hydration ? ' full' : ''}`}
                    aria-label={t('Vaso {n} de 8', { n: String(i + 1) })}
                    onClick={() => tapGlass(i + 1)}
                  >
                    <HydrationGlass filled={i < hydration} />
                  </button>
                ))}
              </div>
            </div>

            <div className="nut-meal-sum">
              <div className="nut-thumb" aria-hidden="true">{selectedMeal.emoji}</div>
              <div className="nut-meal-sum-txt">
                <strong>
                  {t(selectedMeal.name)}
                  {selectedMeal.time ? ` · ${selectedMeal.time}` : ''}
                </strong>
                <span>
                  <IonIcon icon={flameOutline} />
                  {t('{n} kcal', { n: formatQty(selectedMeal.kcal, locale) })}
                </span>
              </div>
              <IonButton
                fill="clear"
                className="nut-menu-btn"
                aria-label={t('Menú de la comida')}
                onClick={() => setMenuOpen(true)}
              >
                <IonIcon icon={ellipsisHorizontal} slot="icon-only" />
              </IonButton>
            </div>

            <div className="nut-foods">
              {selectedMeal.items.map((item) => (
                <div key={item.name} className="nut-food">
                  <span className="nut-food-ico" aria-hidden="true">{item.emoji}</span>
                  <div className="nut-food-txt">
                    <strong>{t(item.name)}</strong>
                    {item.note ? <span>{t(item.note)}</span> : null}
                  </div>
                  <div className="nut-food-macros">
                    {item.carbs && <span className="fm fm-c">{item.carbs}</span>}
                    {item.protein && <span className="fm fm-p">{item.protein}</span>}
                    {item.fat && <span className="fm fm-g">{item.fat}</span>}
                  </div>
                </div>
              ))}
            </div>

            {selectedLogged ? (
              <div className="nut-logged">{t('✓ Registrado con foto · IA 92% adherencia')}</div>
            ) : (
              <IonButton expand="block" className="nut-cta" onClick={openCamera}>
                <IonIcon icon={cameraOutline} slot="start" />
                <span className="nut-cta-copy">
                  <strong>{t('Registrar lo que comí')}</strong>
                  <em>{t('IA analiza gramos · kcal · adherencia')}</em>
                </span>
              </IonButton>
            )}
          </>
        )}

        {tab === 'semana' && (
          <div className="nut-stack">
            <div className="nut-card">
              <div className="nut-card-title">{t('📊 Adherencia semanal')}</div>
              <div className="nut-chart">
                {week.map(([day, pct]) => (
                  <div key={day} className="nut-bar">
                    <span className="nut-bar-pct">{pct}%</span>
                    <div className="nut-bar-track">
                      <div className="nut-bar-fill" style={{ height: `${pct}%` }} />
                    </div>
                    <span className="nut-bar-day">{t(day)}</span>
                  </div>
                ))}
              </div>
            </div>
            {[
              ['04/08/2026', '1,720 kcal · 96%', 0, false],
              ['05/08/2026', '1,650 kcal · 88%', 1, true],
              ['06/08/2026', t('Plan 1,760 kcal'), 2, false],
            ].map(([date, meta, idx, isToday]) => (
              <button
                key={String(date)}
                type="button"
                className={`nut-day${isToday ? ' today' : ''}${openDay === idx ? ' open' : ''}`}
                onClick={() => setOpenDay(Number(idx))}
              >
                <div className="nut-day-row">
                  <strong>
                    {date}
                    {isToday ? ` · ${t('HOY')}` : ''}
                  </strong>
                  <span>{meta}</span>
                </div>
                {openDay === idx && (
                  <p>{t('Desayuno · Almuerzo · Merienda · Cena según plan mediterráneo.')}</p>
                )}
              </button>
            ))}
          </div>
        )}

        {tab === 'indicaciones' && (
          <div className="nut-card nut-goals">
            {[
              ['🔥', 'Calorías diarias', t('{n} kcal', { n: formatQty(calorieTarget, locale) })],
              ['🍎', 'Carbohidratos', t('{n}g/día', { n: String(nutContent?.dailyCarbsTarget || 200) })],
              ['🥩', 'Proteínas', t('{n}g/día', { n: String(proteinGoal) })],
              ['🧂', 'Sodio (AHA)', t('≤ 2,300mg')],
              ['🍬', 'Azúcar añadida', t('≤ 25g/día')],
              ['💧', 'Agua (USDA)', t('≥ 2L/día')],
            ].map(([ico, label, value]) => (
              <div key={String(label)} className="nut-goal">
                <span className="nut-goal-ico" aria-hidden="true">{ico}</span>
                <span className="nut-goal-label">{t(String(label))}</span>
                <span className="nut-goal-val">{value}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'historial' && (
          <div className="nut-card nut-hist">
            <div className="nut-hist-head">{t('📉 Evolución de peso')}</div>
            {[
              ['1 may', '71.7 kg', 'IMC 27.6 · Inicio', ''],
              ['01/06/2026', '70.2 kg', 'IMC 27.0', '↓ 1.5 kg'],
              ['05/08/2026', '68.5 kg', 'IMC 26.4 · HbA1c 5.9%', '↓ 0.8 kg'],
            ].map(([d, k, s, ch]) => (
              <div key={d} className="nut-hist-row">
                <div className="nut-hist-date">{d}</div>
                <div className="nut-hist-txt">
                  <strong>{k}</strong>
                  <span>{t(String(s))}</span>
                </div>
                <em>{ch}</em>
              </div>
            ))}
            <div className="nut-hist-goal">
              <span>{t('Meta semana 24')}</span>
              <strong>{t('65 kg · IMC≤25 · HbA1c<5.7%')}</strong>
              <IonProgressBar
                className="nut-goal-bar"
                style={{ '--progress-background': 'var(--teal)' } as CSSProperties}
                value={0.5}
              />
            </div>
          </div>
        )}
      </Scroll>

      <IonActionSheet
        isOpen={menuOpen}
        header={t('Opciones de registro')}
        onDidDismiss={() => setMenuOpen(false)}
        buttons={[
          { text: t('Usar cámara'), handler: openCamera },
          { text: t('Seleccionar imagen'), handler: openGallery },
          {
            text: t('Registro manual'),
            handler: () => {
              if (selectedMeal) openRegister(selectedMeal.id)
            },
          },
          { text: t('Cancelar'), role: 'cancel' },
        ]}
      />

      <IonModal isOpen={analysis !== 'idle'} onDidDismiss={resetAnalysis} className="nut-ai-modal">
        <div className="nut-ai">
          {analysis === 'camera' && (
            <>
              <div className="nut-ai-title">📷 {t('Apunta a tu comida')}</div>
              <CameraCapture
                onCapture={(blob, fileName) => runAnalysis(blob, fileName)}
                onCancel={resetAnalysis}
              />
            </>
          )}

          {analysis === 'analyzing' && photo && (
            <div className="nut-ai-photo">
              <img src={photo} alt={t('Fotografía de la comida')} />
              <div className="nut-ai-overlay">
                <IonSpinner name="crescent" />
                <div className="nut-ai-title">{t('Analizando tu comida…')}</div>
                {steps.map((label, i) => (
                  <div key={label} className={`nut-ai-step${i <= step ? ' on' : ''}`}>
                    {i < step ? '✓ ' : i === step ? '▸ ' : ''}
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis === 'success' && result && photo && (
            <>
              <img className="nut-ai-preview" src={photo} alt={t('Fotografía de la comida')} />
              <div className="nut-ai-title">
                {t('Alimentos detectados')} ({result.foods.length})
              </div>
              {result.foods.map((food, i) => (
                <FoodResultCard key={`${food.name}-${i}`} food={food} />
              ))}
              {result.summary && result.foods.some((f) => f.nutritionStatus === 'available') && (
                <div className="nut-ai-total">
                  <span>{t('TOTAL')}</span>
                  <strong>{Math.round(result.summary.calories)} kcal</strong>
                </div>
              )}
              <div className="nut-ai-register">
                <div className="nut-ai-hint">{t('Registrar en…')}</div>
                <div className="nut-ai-grid">
                  {(['des', 'alm', 'mer', 'cen'] as MealCode[]).map((id) => (
                    <IonButton key={id} size="small" fill="outline" onClick={() => logAnalysis(id)}>
                      {t('Registrar en {meal}', { meal: t(MEAL_LABELS[id]) })}
                    </IonButton>
                  ))}
                </div>
              </div>
              <IonButton className="bt-teal" expand="block" onClick={resetAnalysis}>
                <IonIcon icon={refreshOutline} slot="start" />
                {t('Analizar otra comida')}
              </IonButton>
            </>
          )}

          {analysis === 'error' && (
            <>
              {photo && <img className="nut-ai-preview" src={photo} alt={t('Fotografía de la comida')} />}
              <div className="nut-ai-error">⚠️ {analysisError}</div>
              <div className="nut-ai-actions">
                <IonButton style={{ flex: 1 }} fill="outline" onClick={resetAnalysis}>
                  {t('Intentar de nuevo')}
                </IonButton>
                <IonButton style={{ flex: 1 }} fill="clear" onClick={resetAnalysis}>
                  {t('Cancelar')}
                </IonButton>
              </div>
            </>
          )}
        </div>
      </IonModal>

      <IonModal isOpen={registerTarget !== null} onDidDismiss={() => setRegisterTarget(null)}>
        <div className="nut-reg">
          <div className="nut-ai-title">{t('Registrar comida')}</div>
          {registerTarget && (
            <div className="nut-ai-hint">
              {t(MEAL_LABELS[registerTarget])}
              {planTargets.has(registerTarget) && ` · ${t('Valores del plan de hoy · editables')}`}
            </div>
          )}
          <IonInput
            label={t('Calorías (kcal)')}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="numeric"
            value={intakeForm.calories}
            onIonInput={(e) => setIntakeForm((f) => ({ ...f, calories: String(e.target.value ?? '') }))}
          />
          <IonInput
            label={t('Proteínas (g)')}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.proteinG}
            onIonInput={(e) => setIntakeForm((f) => ({ ...f, proteinG: String(e.target.value ?? '') }))}
          />
          <IonInput
            label={t('Carbohidratos (g)')}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.carbsG}
            onIonInput={(e) => setIntakeForm((f) => ({ ...f, carbsG: String(e.target.value ?? '') }))}
          />
          <IonInput
            label={t('Grasas (g)')}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.fatG}
            onIonInput={(e) => setIntakeForm((f) => ({ ...f, fatG: String(e.target.value ?? '') }))}
          />
          <IonInput
            label={t('Fibra (g)')}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.fiberG}
            onIonInput={(e) => setIntakeForm((f) => ({ ...f, fiberG: String(e.target.value ?? '') }))}
          />
          <IonButton expand="block" className="bt-teal" style={{ marginTop: 16 }} onClick={submitRegister}>
            {t('Guardar')}
          </IonButton>
          <IonButton expand="block" fill="clear" onClick={() => setRegisterTarget(null)}>
            {t('Cancelar')}
          </IonButton>
        </div>
      </IonModal>
    </Screen>
  )
}

/** Vaso de hidratación: Ionic no tiene un ícono de vaso de agua. */
function HydrationGlass({ filled }: { filled: boolean }) {
  return (
    <svg className="nut-glass-ico" viewBox="0 0 24 32" aria-hidden="true">
      <path
        className="nut-glass-outline"
        d="M5 2.4h14l-1.55 22.6A3.4 3.4 0 0 1 14.1 28.6H9.9A3.4 3.4 0 0 1 6.55 25L5 2.4Z"
      />
      {filled ? (
        <path
          className="nut-glass-water"
          d="M7.15 11.2h9.7l-1.05 13.6a1.85 1.85 0 0 1-1.83 1.7H10.03a1.85 1.85 0 0 1-1.83-1.7L7.15 11.2Z"
        />
      ) : null}
    </svg>
  )
}

function FoodResultCard({ food }: { food: DetectedFood }) {
  const t = useT()
  const name = displayName(food.name)
  const emoji = FOOD_EMOJI[food.name] ?? '🍽️'
  const available = food.nutritionStatus === 'available' && food.nutrition

  return (
    <div className="nut-ai-food">
      <div className="nut-ai-food-top">
        <span>{emoji}</span>
        <strong>{name}</strong>
        {food.portion && (
          <em>
            {Math.round(food.portion.estimatedGrams)} g
            {food.portion.minGrams != null && food.portion.maxGrams != null
              ? ` (${Math.round(food.portion.minGrams)}–${Math.round(food.portion.maxGrams)} g)`
              : ''}
          </em>
        )}
      </div>

      {available && food.nutrition ? (
        <>
          <div className="nut-ai-kcal">
            <b>{Math.round(food.nutrition.calories)}</b>
            <span>kcal</span>
          </div>
          <div className="nut-ai-chips">
            <span>{t('Proteínas')} {Math.round(food.nutrition.protein)}g</span>
            <span>{t('Carbohidratos')} {Math.round(food.nutrition.carbohydrates)}g</span>
            <span>{t('Grasas')} {Math.round(food.nutrition.fat)}g</span>
          </div>
          {food.source && <div className="nut-ai-src">{food.source}</div>}
        </>
      ) : (
        <div className="nut-ai-hint">
          {food.nutritionStatus === 'portion_unavailable'
            ? t('Identificamos este alimento, pero no pudimos estimar una porción.')
            : t('Identificamos este alimento, pero no tenemos información nutricional disponible.')}
        </div>
      )}
    </div>
  )
}

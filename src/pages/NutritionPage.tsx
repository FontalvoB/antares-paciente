import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  IonButton,
  IonIcon,
  IonInput,
  IonModal,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/react'
import { cameraOutline, imageOutline, refreshOutline } from 'ionicons/icons'
import { PageHeader } from '../components/PageHeader'
import { Screen, Scroll } from '../components/Screen'
import { CameraCapture } from '../components/CameraCapture'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'
import { useNutritionLog } from '../hooks/useNutritionLog'
import { useProgram } from '../hooks/useProgram'
import type { MealCode, NutritionIntakePayload } from '../services/program/nutrition-service'
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

// Emoji por MealCode (B3): derivado del código canónico, nunca por
// fallthrough de prefijos del mealType (Snack → mer, no cen).
const MEAL_CODE_EMOJI: Record<MealCode, string> = {
  des: '🌅',
  alm: '☀️',
  mer: '🍎',
  cen: '🌙',
  agua: '💧',
}

const defaultMeals = [
  {
    id: 'des',
    emoji: '🌅',
    title: 'Desayuno · 7:00 AM',
    kcal: 380,
    items: [
      ['🥣', 'Avena enrollada (½ taza)', 'β-glucanos · Bajo IG', '31g C', '5g P', ''],
      ['🍓', 'Frutos rojos mixtos', 'Antioxidantes · Vit. C', '10g C', '', ''],
      ['🥚', '2 claras de huevo', 'Proteína magra', '', '7g P', ''],
      ['🍵', 'Té verde sin azúcar', 'EGCG · 0 kcal', '0g', '', ''],
    ],
  },
  {
    id: 'alm',
    emoji: '☀️',
    title: 'Almuerzo · 12:00 PM',
    kcal: 620,
    items: [
      ['🍗', 'Pechuga de pollo 4 oz', 'Proteína magra · sin piel', '', '26g P', '3g G'],
      ['🍚', 'Arroz integral ½ taza', 'Grano entero · 2g fibra', '22g C', '', ''],
      ['🥗', 'Ensalada + EVOO y limón', 'Espinaca · Omega-9', '8g C', '', '7g G'],
    ],
  },
  {
    id: 'mer',
    emoji: '🍎',
    title: 'Merienda · 3:30 PM',
    kcal: 200,
    items: [
      ['🍎', 'Manzana mediana', 'Pectina · IG bajo 36', '25g C', '', ''],
      ['🥜', 'Almendras 1 oz', 'Vit. E · Mg', '', '6g P', '14g G'],
    ],
  },
  {
    id: 'cen',
    emoji: '🌙',
    title: 'Cena · 7:00 PM',
    kcal: 450,
    items: [
      ['🍲', 'Sopa de lentejas 1½ taza', '18g proteína vegetal', '40g C', '18g P', ''],
      ['🍞', 'Pan integral 1 rebanada', 'Grano entero · 3g fibra', '15g C', '', ''],
    ],
  },
]

const week = [
  ['Lun', 96, 'var(--teal)'],
  ['Mar', 88, 'var(--teal)'],
  ['Mié', 74, 'var(--org)'],
  ['Jue', 91, 'var(--teal)'],
  ['Vie', 85, 'var(--teal)'],
  ['Sáb', 68, 'var(--org)'],
  ['Dom', 93, 'var(--teal)'],
]

export function NutritionPage() {
  const { hydration, setHydration, logMeal, showToast } = useApp()
  const { snapshot } = useProgram()
  const t = useT()
  const nutritionMutation = useNutritionLog()
  const [tab, setTab] = useState<'hoy' | 'semana' | 'indicaciones' | 'historial'>('hoy')
  const [openDay, setOpenDay] = useState(1)

  // ── Registro manual prefilled (SPEC nutrition-intake-adherence) ──
  const [registerTarget, setRegisterTarget] = useState<MealCode | null>(null)
  const [intakeForm, setIntakeForm] = useState({
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
  })

  const nutContent = snapshot?.todayTasks?.find((t) => t.taskCode === 'nut')?.content
  const planTitle = nutContent?.nutritionPlanName || t('Ana Torres, RDN · plan asignado')
  const calorieTarget = nutContent?.dailyCalorieTarget || 1800
  const carbsTarget = nutContent?.dailyCarbsTarget ? `${nutContent.dailyCarbsTarget}g` : '168g'
  const proteinTarget = nutContent?.dailyProteinTarget ? `${nutContent.dailyProteinTarget}g` : '90g'
  const fatTarget = nutContent?.dailyFatTarget ? `${nutContent.dailyFatTarget}g` : '50g'
  const fiberTarget = nutContent?.dailyFiberTarget ? `${nutContent.dailyFiberTarget}g` : '28g'

  // Metas del plan por código de comida (D4 vía mealTypeToCode): alimentan el
  // prefill del modal de registro. Sin plan → mapa vacío → formulario en blanco.
  const planTargets = useMemo(
    () => buildPlanTargets(nutContent?.nutritionMeals),
    [nutContent],
  )

  // Verdad server-side de lo registrado hoy (S4): deriveLoggedMeals unifica a
  // todos los consumidores sobre nutritionIntakeLogs (+ capa optimista del
  // cache) — agua excluida (hidratación nunca cuenta como comida del plan).
  const loggedSet = useMemo(() => new Set(deriveLoggedMeals(snapshot)), [snapshot])

  const displayMeals = useMemo(() => {
    if (nutContent?.nutritionMeals && nutContent.nutritionMeals.length > 0) {
      return nutContent.nutritionMeals.map((m) => {
        // B3: el id se deriva del mapa canónico mealTypeToCode (D4) — Snack →
        // 'mer', NO el fallthrough por prefijo que lo mandaba a 'cen' (bug
        // vivo en el código de registro Y en el prefill). Solo tipos
        // genuinamente desconocidos caen en 'cen'.
        const id = mealTypeToCode(m.mealType) ?? 'cen'
        const emoji = MEAL_CODE_EMOJI[id]
        return {
          id,
          emoji,
          title: `${m.mealType}${m.calories ? ` · ${m.calories} kcal` : ''}`,
          kcal: m.calories || 0,
          items: [
            ['🍽️', m.description || m.foods || m.mealType, m.notes || 'Recomendación del plan clínico', m.carbsG ? `${m.carbsG}g C` : '', m.proteinG ? `${m.proteinG}g P` : '', m.fatG ? `${m.fatG}g G` : '']
          ],
        }
      })
    }
    return defaultMeals
  }, [nutContent, t])

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
  }

  // Abre el modal de registro con el prefill del plan (o vacío sin plan).
  const openRegister = (id: MealCode) => {
    setIntakeForm(prefillIntakeForm(planTargets.get(id)))
    setRegisterTarget(id)
  }

  // Guarda el registro manual (source manual). Sin snapshot (demo) se conserva
  // el doble write del AppContext como fallback; con snapshot solo la API.
  // B7: el toast de éxito solo se muestra en onSuccess; errores de negocio
  // (p.ej. 400 intake inválido) se muestran con el mensaje del servidor y el
  // formulario queda abierto para corregir; 409 → silencioso (keep-state).
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
          // 422 NUTRITION_EVIDENCE_REQUIRED (D3): el gate lista las comidas
          // del plan sin evidencia — se muestran al paciente (B7 contract).
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

  // Confirma un análisis de foto en una comida: persiste con source ai_photo
  // + analysisId (reemplaza el descarte anterior) y los macros del summary.
  // B7: mismo contrato de toasts que submitRegister.
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

  // Hidratación: registra en la API con mealCode 'agua' + waterMl (250 ml por
  // vaso) y actualiza el contador optimista. Error-surfacing B7 (residual del
  // re-gate Batch 1): 409 silencioso (ya logueado), resto → toast err con el
  // mensaje del servidor.
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

  return (
    <Screen>
      <PageHeader title={t('Nutrición')} sub={t(planTitle)} />

      {/* ── Analizador de comida con IA (flujo real) ── */}
      <div className="card" style={{ margin: '10px 14px 0', background: 'var(--navy)', borderColor: 'transparent', color: '#fff' }}>
        {analysis === 'idle' && (
          <>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>📸 {t('Analiza tu comida con IA')}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
              {t('Toma una foto y recibe calorías, macros y porción reales.')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <IonButton
                style={{ flex: 1, '--background': 'var(--teal)' } as CSSProperties}
                onClick={() => setAnalysis('camera')}
              >
                <IonIcon icon={cameraOutline} slot="start" />
                {t('Usar cámara')}
              </IonButton>
              <IonButton
                style={{ flex: 1 }}
                fill="outline"
                onClick={() => {
                  setAnalysis('camera')
                  setTimeout(() => {
                    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]')
                    input?.click()
                  }, 50)
                }}
              >
                <IonIcon icon={imageOutline} slot="start" />
                {t('Seleccionar imagen')}
              </IonButton>
            </div>
          </>
        )}

        {analysis === 'camera' && (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📷 {t('Apunta a tu comida')}</div>
            <CameraCapture
              onCapture={(blob, fileName) => runAnalysis(blob, fileName)}
              onCancel={resetAnalysis}
            />
          </>
        )}

        {analysis === 'analyzing' && photo && (
          <>
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
              <img src={photo} alt={t('Fotografía de la comida')} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', filter: 'brightness(0.55)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: 16 }}>
                <IonSpinner name="crescent" style={{ color: '#fff', width: 34, height: 34 }} />
                <div style={{ fontWeight: 800, fontSize: 15 }}>{t('Analizando tu comida…')}</div>
                {steps.map((s, i) => (
                  <div key={s} style={{ fontSize: 12, opacity: i <= step ? 1 : 0.35, color: '#fff' }}>
                    {i < step ? '✓ ' : i === step ? '▸ ' : ''}
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {analysis === 'success' && result && photo && (
          <>
            <img src={photo} alt={t('Fotografía de la comida')} style={{ width: '100%', borderRadius: 14, aspectRatio: '4/3', objectFit: 'cover', marginBottom: 12 }} />
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
              {t('Alimentos detectados')} ({result.foods.length})
            </div>
            {result.foods.map((food, i) => (
              <FoodResultCard key={`${food.name}-${i}`} food={food} />
            ))}
            {result.summary && result.foods.some((f) => f.nutritionStatus === 'available') && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,.25)' }}>
                <span style={{ fontWeight: 700 }}>{t('TOTAL')}</span>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{Math.round(result.summary.calories)} kcal</span>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{t('Registrar en…')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['des', 'alm', 'mer', 'cen'] as MealCode[]).map((id) => (
                  <IonButton key={id} size="small" fill="outline" onClick={() => logAnalysis(id)}>
                    {t('Registrar en {meal}', { meal: t(MEAL_LABELS[id]) })}
                  </IonButton>
                ))}
              </div>
            </div>
            <IonButton style={{ marginTop: 12, '--background': 'var(--teal)' } as CSSProperties} expand="block" onClick={resetAnalysis}>
              <IonIcon icon={refreshOutline} slot="start" />
              {t('Analizar otra comida')}
            </IonButton>
          </>
        )}

        {analysis === 'error' && (
          <>
            {photo && <img src={photo} alt={t('Fotografía de la comida')} style={{ width: '100%', borderRadius: 14, aspectRatio: '4/3', objectFit: 'cover', marginBottom: 12 }} />}
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>⚠️ {analysisError}</div>
            <div style={{ display: 'flex', gap: 8 }}>
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

      <div className="kcal-strip">
        <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
          <svg width="92" height="92" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#E8EEF4" strokeWidth="10" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#1D9E75" strokeWidth="10" strokeDasharray="239" strokeDashoffset="36" strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="display" style={{ fontSize: 16, fontWeight: 800 }}>1,650</div>
            <div style={{ fontSize: 9, color: 'var(--mu)' }}>/{calorieTarget}</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {[
            ['Carbohidratos', carbsTarget, 75, '#1B6CA8'],
            ['Proteínas', proteinTarget, 88, '#1D9E75'],
            ['Grasas', fatTarget, 60, '#E87B2B'],
            ['Fibra', fiberTarget, 80, '#7C3AED'],
          ].map(([n, v, w, c]) => (
            <div key={String(n)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--mu)', width: 78 }}>{t(String(n))}</span>
              <IonProgressBar
                className="pb"
                style={{ flex: 1, '--progress-background': String(c) } as CSSProperties}
                value={Number(w) / 100}
              />
              <span style={{ fontSize: 11, fontWeight: 700, width: 36, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <IonSegment
        className="plan-seg"
        value={tab}
        onIonChange={(e) => setTab((e.detail.value as typeof tab) ?? 'hoy')}
      >
        <IonSegmentButton value="hoy">{t('Hoy')}</IonSegmentButton>
        <IonSegmentButton value="semana">{t('Semana')}</IonSegmentButton>
        <IonSegmentButton value="indicaciones">{t('Plan')}</IonSegmentButton>
        <IonSegmentButton value="historial">{t('Historial')}</IonSegmentButton>
      </IonSegment>

      <Scroll>
        {tab === 'hoy' && (
          <>
            <div className="card" style={{ margin: '10px 14px', background: 'var(--blue-l)', borderColor: '#B5D4F4' }}>
              <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 10, fontSize: 13 }}>{t('💧 Hidratación · 8 vasos (2L)')}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <button key={i} className={`hyd-glass ${i < hydration ? 'full' : ''}`} onClick={() => tapGlass(i + 1)}>
                    🥛
                  </button>
                ))}
              </div>
            </div>
            {displayMeals.map((m) => (
              <div key={m.id} className="meal-card">
                <div className="meal-hdr">
                  <span>{m.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 700 }}>{t(m.title)}</span>
                  <span style={{ opacity: 0.75, fontSize: 12 }}>{m.kcal} kcal</span>
                </div>
                {m.items.map((it) => (
                  <div key={it[1]} className="food-item">
                    <span>{it[0]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t(it[1])}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)' }}>{t(it[2])}</div>
                    </div>
                    <div>
                      {it[3] && <span className="fm fm-c">{it[3]}</span>}
                      {it[4] && <span className="fm fm-p">{it[4]}</span>}
                      {it[5] && <span className="fm fm-g">{it[5]}</span>}
                    </div>
                  </div>
                ))}
                {loggedSet.has(m.id) ? (
                  <div style={{ margin: 12, background: 'var(--teal-l)', borderRadius: 12, padding: 12, color: '#0F6E56', fontWeight: 700, fontSize: 13 }}>
                    {t('✓ Registrado con foto · IA 92% adherencia')}
                  </div>
                ) : (
                  <button
                    onClick={() => openRegister(m.id as MealCode)}
                    style={{
                      margin: 12,
                      width: 'calc(100% - 24px)',
                      background: 'linear-gradient(145deg,#102a50,#173c73)',
                      border: '1.5px dashed rgba(32,200,255,.4)',
                      borderRadius: 12,
                      padding: 12,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>📸</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{t('Registrar lo que comí')}</div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>{t('IA analiza gramos · kcal · adherencia')}</div>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'semana' && (
          <div style={{ padding: '12px 0' }}>
            <div className="card" style={{ margin: '0 14px 12px' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('📊 Adherencia semanal')}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
                {week.map(([d, h, c]) => (
                  <div key={String(d)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{h}%</span>
                    <div style={{ width: '100%', height: Number(h) * 0.7, background: String(c), borderRadius: '4px 4px 0 0' }} />
                    <span style={{ fontSize: 10, color: 'var(--mu)' }}>{t(String(d))}</span>
                  </div>
                ))}
              </div>
            </div>
            {[
              ['04/08/2026', '1,720 kcal · 96%', 0],
              ['05/08/2026 · HOY', '1,650 kcal · 88%', 1],
              ['06/08/2026', 'Plan 1,760 kcal', 2],
            ].map(([n, k, i]) => (
              <button
                key={String(n)}
                className="card"
                style={{ margin: '0 14px 8px', textAlign: 'left' }}
                onClick={() => setOpenDay(Number(i))}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  {n}
                  <span className="chip chip-teal">{k}</span>
                </div>
                {openDay === i && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--mu)', lineHeight: 1.7 }}>
                    {t('Desayuno · Almuerzo · Merienda · Cena según plan mediterráneo.')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {tab === 'indicaciones' && (
          <div className="card" style={{ margin: 14 }}>
            {[
              ['🔥', 'Calorías diarias', '1,800 kcal'],
              ['🍚', 'Carbohidratos', '≤ 200g/día'],
              ['🥩', 'Proteínas', '≥ 90g/día'],
              ['🧂', 'Sodio (AHA)', '≤ 2,300mg'],
              ['🍬', 'Azúcar añadida', '≤ 25g/día'],
              ['💧', 'Agua (USDA)', '≥ 2L/día'],
            ].map(([e, n, v]) => (
              <div key={String(n)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--g1)' }}>
                <span>{e}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{t(String(n))}</span>
                <span style={{ fontWeight: 800, color: 'var(--teal)' }}>{t(String(v))}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'historial' && (
          <div className="card" style={{ margin: 14, padding: 0 }}>
            <div style={{ background: 'var(--navy)', color: '#fff', padding: 12, fontWeight: 700 }}>{t('📉 Evolución de peso')}</div>
            {[
              ['1 may', '71.7 kg', 'IMC 27.6 · Inicio', ''],
              ['01/06/2026', '70.2 kg', 'IMC 27.0', '↓ 1.5 kg'],
              ['05/08/2026', '68.5 kg', 'IMC 26.4 · HbA1c 5.9%', '↓ 0.8 kg'],
            ].map(([d, k, s, ch]) => (
              <div key={d} style={{ display: 'flex', gap: 10, padding: 12, borderBottom: '1px solid var(--g1)', alignItems: 'center' }}>
                <div style={{ width: 48, fontSize: 11, color: 'var(--mu)' }}>{d}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{k}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)' }}>{t(String(s))}</div>
                </div>
                <span style={{ color: 'var(--teal)', fontWeight: 700, fontSize: 12 }}>{ch}</span>
              </div>
            ))}
            <div style={{ padding: 12, background: '#F8FBF8' }}>
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>{t('Meta semana 24')}</div>
              <div style={{ fontWeight: 800 }}>{t('65 kg · IMC≤25 · HbA1c<5.7%')}</div>
              <IonProgressBar className="pb" style={{ marginTop: 8, '--progress-background': 'var(--teal)' } as CSSProperties} value={0.5} />
            </div>
          </div>
        )}
      </Scroll>

      {/* ── Registro manual de comida (prefill del plan, editable) ── */}
      <IonModal isOpen={registerTarget !== null} onDidDismiss={() => setRegisterTarget(null)}>
        <div style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{t('Registrar comida')}</div>
          {registerTarget && (
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 14 }}>
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
          <IonButton
            expand="block"
            style={{ marginTop: 16, '--background': 'var(--teal)' } as CSSProperties}
            onClick={submitRegister}
          >
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

function FoodResultCard({ food }: { food: DetectedFood }) {
  const t = useT()
  const name = displayName(food.name)
  const emoji = FOOD_EMOJI[food.name] ?? '🍽️'
  const available = food.nutritionStatus === 'available' && food.nutrition

  return (
    <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <span style={{ fontWeight: 800, fontSize: 14, textTransform: 'capitalize' }}>{name}</span>
        {food.portion && (
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.75 }}>
            {Math.round(food.portion.estimatedGrams)} g
            {food.portion.minGrams != null && food.portion.maxGrams != null
              ? ` (${Math.round(food.portion.minGrams)}–${Math.round(food.portion.maxGrams)} g)`
              : ''}
          </span>
        )}
      </div>

      {available && food.nutrition ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 20 }}>{Math.round(food.nutrition.calories)}</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>kcal</span>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
            <span style={{ background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: '3px 8px' }}>
              {t('Proteínas')} {Math.round(food.nutrition.protein)}g
            </span>
            <span style={{ background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: '3px 8px' }}>
              {t('Carbohidratos')} {Math.round(food.nutrition.carbohydrates)}g
            </span>
            <span style={{ background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: '3px 8px' }}>
              {t('Grasas')} {Math.round(food.nutrition.fat)}g
            </span>
          </div>
          {food.source && <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6 }}>{food.source}</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {food.nutritionStatus === 'portion_unavailable'
            ? t('Identificamos este alimento, pero no pudimos estimar una porción.')
            : t('Identificamos este alimento, pero no tenemos información nutricional disponible.')}
        </div>
      )}
    </div>
  )
}

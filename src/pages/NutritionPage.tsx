import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  IonActionSheet,
  IonButton,
  IonIcon,
  IonModal,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from "@ionic/react";
import { cameraOutline, imageOutline } from "ionicons/icons";
import { PageHeader } from "../components/PageHeader";
import { Screen, Scroll } from "../components/Screen";
import { MealFoodFlow } from "../components/MealFoodFlow";
import { MealIntakeForm } from "../components/MealIntakeForm";
import { MealLoggedPanel } from "../components/nutrition/MealLoggedPanel";
import { useApp } from "../context/AppContext";
import { useWearable } from "../context/WearableContext";
import { useI18n } from "../i18n/I18nContext";
import { useNutritionLog } from "../hooks/useNutritionLog";
import { useMyNutritionPlan } from "../hooks/useMyNutritionPlan";
import { NutritionPlanTab } from "../components/nutrition/NutritionPlanTab";
import { useProgram } from "../hooks/useProgram";
import { useProgramScores } from "../hooks/useProgramScores";
import { useMetricsHistory } from "../hooks/useMetricsHistory";
import type {
  MealCode,
  NutritionIntakePayload,
} from "../services/program/nutrition-service";
import { ApiError } from "../utils/apiClient";
import { mealTypeToCode } from "../utils/mealTypeToCode";
import {
  buildHydrationIntake,
  buildPlanTargets,
  EMPTY_INTAKE_FORM,
  type IntakeFormState,
} from "../utils/nutritionForm";
import { deriveLoggedMeals } from "../utils/nutritionProgress";
import {
  deriveIntakeTotals,
  deriveMealSource,
  derivePlanTargets,
  deriveTrend,
  deriveWaterGlasses,
  findMealLog,
} from "../utils/nutritionIntake";
import { formatMetricTarget, formatMetricValue } from "../data/metrics";
import { formatDateForDisplay } from "../utils/dates";

const MEAL_LABELS: Record<MealCode, string> = {
  des: "Desayuno",
  alm: "Almuerzo",
  mer: "Merienda",
  cen: "Cena",
  agua: "Hidratación",
};

// Emoji por MealCode (B3): derivado del código canónico, nunca por
// fallthrough de prefijos del mealType (Snack → mer, no cen).
const MEAL_CODE_EMOJI: Record<MealCode, string> = {
  des: "🌅",
  alm: "☀️",
  mer: "🍎",
  cen: "🌙",
  agua: "💧",
};

export function NutritionPage() {
  const { showToast } = useApp();
  // Sin snapshot → sin contenido fabricado: la pantalla entera deriva de la
  // verdad del servidor. isLoading distingue carga inicial de estados
  // terminales honestos; productMessage (estados paused/withdrawn/
  // no-template/recoverable) se muestra crudo, como en ProgramPage.
  const { snapshot, isLoading, isMockFallback, productMessage } = useProgram();
  const { t, lang } = useI18n();
  const nutritionMutation = useNutritionLog();
  // Verdad del servidor para Semana (dimensions.nutrition) e Historial
  // (serie weight/bmi/hba1c). Queries compartidas con ProgramPage/Home —
  // TanStack deduplica por queryKey; errores degradan a estados vacíos
  // honestos (R5.2), nunca a toasts.
  const { scores, isLoading: scoresLoading } = useProgramScores();
  const { history: metricsHistory, isLoading: metricsLoading } =
    useMetricsHistory();
  const { today: deviceToday } = useWearable();
  // Plan alimentario asignado (self-service, sin inscripción): metas clínicas
  // reales del profesional. 404 sin plan → null (vacío honesto en Indicaciones)
  // y las tarjetas del día conservan la referencia del snapshot del programa.
  const {
    plan: nutritionPlan,
    isLoading: planLoading,
    error: planError,
    refetch: refetchPlan,
  } = useMyNutritionPlan();
  const [tab, setTab] = useState<
    "hoy" | "semana" | "indicaciones" | "historial"
  >("hoy");

  // S3: locale activo para números (es-ES coma decimal / en-US punto).
  const locale = lang === "en" ? "en-US" : "es-ES";

  // Gasto activo del día: anillo en vivo o la serie persistida de
  // activity_kcal (device-metrics). Sin dato no se muestra la línea.
  const kcalSeries = metricsHistory?.metrics.find(
    (m) => m.code.toLowerCase() === "activity_kcal",
  );
  const persistedKcal = kcalSeries?.points.at(-1)?.value ?? null;
  const activeKcal = deviceToday.activityKcal ?? persistedKcal;

  // ── Registro manual (formulario vacío; el plan es REFERENCIA, no consumo) ──
  const [registerTarget, setRegisterTarget] = useState<MealCode | null>(null);

  // ── Flujo por comida (máquina local): pending → capturing → analyzing →
  // review → registered (+ editing/error). El contexto (meal) nunca se pierde.
  interface MealFlow {
    meal: Exclude<MealCode, "agua">;
    mode: "register" | "detail";
    startAt?: "detail" | "edit";
    autoSource?: "camera" | "gallery";
  }
  const [flow, setFlow] = useState<MealFlow | null>(null);
  // La tarjeta IA global pide primero la comida y luego abre el flujo.
  const [mealPickerSource, setMealPickerSource] = useState<
    "camera" | "gallery" | null
  >(null);

  const nutContent = snapshot?.todayTasks?.find(
    (t) => t.taskCode === "nut",
  )?.content;
  // Nombre real del plan o estado vacío honesto (sin 'Ana Torres' inventado).
  const planTitle =
    nutContent?.nutritionPlanName || t("Sin plan nutricional asignado");

  // El fallback R5.2 (transport error sin cache) NO es verdad de servidor: la
  // UI puede derivar estados vacíos del snapshot mock, pero las MUTACIONES
  // (registro manual, foto, hidratación) no deben encolar writes reales sobre
  // un estado sin verdad — botones deshabilitados, handlers con guard.
  const canMutate = snapshot != null && !isMockFallback;

  // Verdad server-side de los intake totals, targets y fuente por comida
  // (resolvers puros en src/utils/nutritionIntake.ts — de-mock).
  const intakeTotals = useMemo(() => deriveIntakeTotals(snapshot), [snapshot]);
  const serverTargets = useMemo(() => derivePlanTargets(snapshot), [snapshot]);
  const serverGlasses = useMemo(() => deriveWaterGlasses(snapshot), [snapshot]);
  // Referencia diaria del plan asignado: manda sobre el snapshot del programa
  // en el anillo de kcal y la meta de hidratación de «Hoy».
  const calorieTarget =
    nutritionPlan?.dailyCalorieTarget ?? serverTargets.calories;
  const planWaterMl = useMemo(() => {
    if (!nutritionPlan) return null;
    if (nutritionPlan.dailyWaterMl != null) return nutritionPlan.dailyWaterMl;
    for (const day of nutritionPlan.days ?? []) {
      if (day.dailyWaterMl != null) return day.dailyWaterMl;
    }
    return null;
  }, [nutritionPlan]);
  // Vasos de 250 ml; sin plan rige el estándar histórico 8 vasos (2 L).
  const waterGoalGlasses =
    planWaterMl != null ? Math.max(1, Math.round(planWaterMl / 250)) : 8;
  const mealSources = useMemo(() => {
    const map = new Map<MealCode, "manual" | "ai_photo" | null>();
    for (const code of ["des", "alm", "mer", "cen"] as MealCode[]) {
      map.set(code, deriveMealSource(snapshot, code));
    }
    return map;
  }, [snapshot]);

  // Hidratación (server): optimismo local de vasos. Al tocar vaso n >
  // display → pendingGlasses(n) + mutate agua; displayed = max(server, pending).
  // El useEffect converge el optimismo cuando el refetch trae serverGlasses
  // >= pendingGlasses; onError NO-409 revierte + toast, 409 revierte silencioso.
  const [pendingGlasses, setPendingGlasses] = useState<number | null>(null);
  const displayedGlasses = Math.max(serverGlasses, pendingGlasses ?? 0);
  useEffect(() => {
    if (pendingGlasses != null && pendingGlasses <= serverGlasses) {
      setPendingGlasses(null);
    }
  }, [pendingGlasses, serverGlasses]);

  // Semana (server): KPIs reales de adherencia nutricional con tendencia.
  const hs = scores?.health_score ?? scores?.healthScore;
  const weekNutrition = hs?.dimensions?.nutrition ?? null;
  const weekPrevious = hs?.dimensions_previous?.nutrition ?? null;
  const weekTrend = deriveTrend(weekNutrition, weekPrevious);
  const weekTrendColor =
    weekTrend === "up"
      ? "var(--teal)"
      : weekTrend === "down"
        ? "var(--org)"
        : "var(--mu)";

  // Historial (server): serie de peso real + subtítulos bmi/hba1c por fecha.
  const weightSeries = metricsHistory?.metrics.find(
    (m) => m.code.toLowerCase() === "weight",
  );
  const bmiSeries = metricsHistory?.metrics.find(
    (m) => m.code.toLowerCase() === "bmi",
  );
  const hba1cSeries = metricsHistory?.metrics.find(
    (m) => m.code.toLowerCase() === "hba1c",
  );
  const weightUnit = weightSeries?.unit ?? "kg";
  const weightTarget = useMemo(
    () =>
      formatMetricTarget(weightSeries?.target ?? null, weightUnit, 1, locale),
    [weightSeries, weightUnit, locale],
  );
  const bmiByDate = useMemo(
    () => new Map((bmiSeries?.points ?? []).map((p) => [p.date, p.value])),
    [bmiSeries],
  );
  const hba1cByDate = useMemo(
    () => new Map((hba1cSeries?.points ?? []).map((p) => [p.date, p.value])),
    [hba1cSeries],
  );
  const hba1cUnit = hba1cSeries?.unit ?? "%";

  // Metas del plan por código de comida (D4 vía mealTypeToCode): alimentan el
  // prefill del modal de registro. Sin plan → mapa vacío → formulario en blanco.
  const planTargets = useMemo(
    () => buildPlanTargets(nutContent?.nutritionMeals),
    [nutContent],
  );

  // Verdad server-side de lo registrado hoy (S4): deriveLoggedMeals unifica a
  // todos los consumidores sobre nutritionIntakeLogs (+ capa optimista del
  // cache) — agua excluida (hidratación nunca cuenta como comida del plan).
  const loggedSet = useMemo(
    () => new Set(deriveLoggedMeals(snapshot)),
    [snapshot],
  );

  interface DisplayMeal {
    id: string;
    emoji: string;
    title: string;
    kcal: number | null;
    items: string[][];
  }

  const displayMeals = useMemo<DisplayMeal[]>(() => {
    if (nutContent?.nutritionMeals && nutContent.nutritionMeals.length > 0) {
      return nutContent.nutritionMeals.map((m) => {
        // B3: el id se deriva del mapa canónico mealTypeToCode (D4) — Snack →
        // 'mer', NO el fallthrough por prefijo que lo mandaba a 'cen' (bug
        // vivo en el código de registro Y en el prefill). Solo tipos
        // genuinamente desconocidos caen en 'cen'.
        const id = mealTypeToCode(m.mealType) ?? "cen";
        const emoji = MEAL_CODE_EMOJI[id];
        return {
          id,
          emoji,
          title: `${m.mealType}${m.calories ? ` · ${m.calories} kcal` : ""}`,
          kcal: m.calories || 0,
          items: [
            [
              "🍽️",
              m.description || m.foods || m.mealType,
              m.notes || "Recomendación del plan clínico",
              m.carbsG ? `${m.carbsG}g C` : "",
              m.proteinG ? `${m.proteinG}g P` : "",
              m.fatG ? `${m.fatG}g G` : "",
            ],
          ],
        };
      });
    }
    // Con snapshot pero sin comidas del plan: tarjetas estructurales honestas
    // (4 slots con MEAL_LABELS) — sin tiempos, kcal ni alimentos falsos.
    return (["des", "alm", "mer", "cen"] as MealCode[]).map((code) => ({
      id: code,
      emoji: MEAL_CODE_EMOJI[code],
      title: MEAL_LABELS[code],
      kcal: null,
      items: [],
    }));
  }, [nutContent]);

  // Filas del tab Plan/indicaciones (server): targets REALES del content,
  // solo las filas cuyo target exista (sin sodio/azúcar/agua fabricados).
  const planRows = useMemo(() => {
    const rows: { emoji: string; label: string; value: string }[] = [];
    if (serverTargets.calories != null) {
      rows.push({
        emoji: "🔥",
        label: "Calorías diarias",
        value: `${formatMetricValue(serverTargets.calories, 0, locale)} kcal`,
      });
    }
    if (serverTargets.carbsG != null) {
      rows.push({
        emoji: "🍚",
        label: "Carbohidratos",
        value: `${formatMetricValue(serverTargets.carbsG, 0, locale)}g`,
      });
    }
    if (serverTargets.proteinG != null) {
      rows.push({
        emoji: "🥩",
        label: "Proteínas",
        value: `${formatMetricValue(serverTargets.proteinG, 0, locale)}g`,
      });
    }
    if (serverTargets.fatG != null) {
      rows.push({
        emoji: "🥑",
        label: "Grasas",
        value: `${formatMetricValue(serverTargets.fatG, 0, locale)}g`,
      });
    }
    if (serverTargets.fiberG != null) {
      rows.push({
        emoji: "🥦",
        label: "Fibra",
        value: `${formatMetricValue(serverTargets.fiberG, 0, locale)}g`,
      });
    }
    return rows;
  }, [serverTargets, locale]);

  // Anillo de metas (server): anillo = kcal reales derivadas; ratio vs la
  // referencia del plan asignado (fallback al snapshot); sin target → suma
  // sin denominador. Barras de macros solo con target real, progreso =
  // real/target clamp 0..1 (sin % fijos).
  const kcalRatio =
    calorieTarget != null && calorieTarget > 0
      ? Math.min(1, Math.max(0, intakeTotals.calories / calorieTarget))
      : null;
  const ringOffset = kcalRatio != null ? 239 * (1 - kcalRatio) : 239;
  const macroBars = [
    {
      key: "Carbohidratos",
      value: intakeTotals.carbsG,
      target: serverTargets.carbsG,
      color: "#1B6CA8",
    },
    {
      key: "Proteínas",
      value: intakeTotals.proteinG,
      target: serverTargets.proteinG,
      color: "#1D9E75",
    },
    {
      key: "Grasas",
      value: intakeTotals.fatG,
      target: serverTargets.fatG,
      color: "#E87B2B",
    },
    {
      key: "Fibra",
      value: intakeTotals.fiberG,
      target: serverTargets.fiberG,
      color: "#7C3AED",
    },
  ].filter((b) => b.target != null && b.target > 0);

  // Abre el modal de registro manual con el formulario VACÍO. Los valores
  // del plan se muestran como referencia ("Objetivo"), nunca como consumo.
  const openRegister = (id: MealCode) => {
    setRegisterTarget(id);
  };

  // Referencia del plan para el registro manual ("Objetivo del plan: …").
  // Null sin meta → el formulario no muestra referencia (honesto).
  const planReferenceFor = (id: MealCode): string | null => {
    const target = planTargets.get(id);
    if (!target || target.calories == null) return null;
    const parts = [`${target.calories} kcal`];
    if (target.proteinG != null)
      parts.push(`${t("Proteínas")} ${target.proteinG}g`);
    if (target.carbsG != null)
      parts.push(`${t("Carbohidratos")} ${target.carbsG}g`);
    if (target.fatG != null) parts.push(`${t("Grasas")} ${target.fatG}g`);
    return `${t("Objetivo del plan")}: ${parts.join(" · ")}`;
  };

  // Guarda el registro manual (source manual). Solo API — sin fallback demo.
  // B7: el toast de éxito solo se muestra en onSuccess; errores de negocio
  // (p.ej. 400 intake inválido) se muestran con el mensaje del servidor y el
  // formulario queda abierto para corregir; 409 → silencioso (keep-state).
  const submitRegister = (form: IntakeFormState) => {
    if (!canMutate || !registerTarget) return;
    const num = (s: string): number | undefined => {
      if (s.trim() === "") return undefined;
      const value = Number(s);
      return Number.isNaN(value) ? undefined : value;
    };
    const intake: NutritionIntakePayload = {
      calories: num(form.calories),
      proteinG: num(form.proteinG),
      carbsG: num(form.carbsG),
      fatG: num(form.fatG),
      fiberG: num(form.fiberG),
      source: "manual",
    };
    nutritionMutation.mutate(
      { mealCode: registerTarget, intake },
      {
        onSuccess: () => {
          showToast(t("Comida registrada"), "ok");
          setRegisterTarget(null);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setRegisterTarget(null);
            return;
          }
          // 422 NUTRITION_EVIDENCE_REQUIRED (D3): el gate lista las comidas
          // del plan sin evidencia — se muestran al paciente (B7 contract).
          if (
            error instanceof ApiError &&
            error.errors?.missingMealCodes?.length
          ) {
            showToast(
              t("Faltan comidas del plan: {meals}", {
                meals: error.errors.missingMealCodes.join(", "),
              }),
              "err",
            );
            return;
          }
          showToast(
            error.message || t("No se pudo registrar la comida"),
            "err",
          );
        },
      },
    );
  };

  // Hidratación: registra en la API con mealCode 'agua' + waterMl (250 ml por
  // vaso) y actualiza el contador optimista. Error-surfacing B7 (residual del
  // re-gate Batch 1): 409 silencioso (ya logueado), resto → toast err con el
  // mensaje del servidor.
  // Optimismo local `pendingGlasses` POR ENCIMA de la verdad server-side
  // (displayed = max(serverGlasses, pending)); el useEffect de convergencia lo
  // limpia cuando el refetch trae serverGlasses >= pending. Nota wire
  // (09/2026): repetir AGUA el mismo día ya NO devuelve 409 — el backend hace
  // upsert acumulativo (200, xp 0) dejando el waterMl MAYOR; el guard
  // `n <= displayedGlasses` evita que un tap repetido con valor menor rompa
  // displayed y el refetch reconcilia el upsert. Los 409 de comidas siguen igual.
  const tapGlass = (n: number) => {
    if (!canMutate || n <= displayedGlasses) return;
    setPendingGlasses(n);
    nutritionMutation.mutate(
      {
        mealCode: "agua",
        intake: buildHydrationIntake(n),
      },
      {
        onError: (error) => {
          // 409 → silencioso (el log ya existe server-side): el refetch
          // reconciliará; el optimismo se descarta igual.
          if (error instanceof ApiError && error.status === 409) {
            setPendingGlasses(null);
            return;
          }
          setPendingGlasses(null);
          showToast(
            error.message || t("No se pudo registrar la comida"),
            "err",
          );
        },
      },
    );
  };

  // ── Estados sin verdad del servidor (de-mock) ──
  // Carga inicial: placeholder de IonSpinner centrado, sin contenido.
  if (!snapshot && isLoading) {
    return (
      <Screen>
        <PageHeader title={t("Nutrición")} />
        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}
        >
          <IonSpinner name="crescent" style={{ width: 34, height: 34 }} />
        </div>
      </Screen>
    );
  }
  // Sin snapshot en estado terminal (paused/withdrawn/no-template/
  // recoverable): contenido honesto mínimo — encabezado + tarjeta vacía.
  // productMessage (crudo, como en ProgramPage) aporta el contexto del
  // estado; el fallback mock del hook es NO-null con todayTasks vacío y cae
  // en el render normal con estados vacíos derivados (nunca fabricación).
  if (!snapshot) {
    return (
      <Screen>
        <PageHeader
          title={t("Nutrición")}
          sub={t("Sin plan nutricional asignado")}
        />
        <div className="card" style={{ margin: "10px 14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26 }}>🥗</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {t("Sin programa activo")}
              </div>
              {productMessage && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--mu)",
                    lineHeight: 1.5,
                    marginTop: 4,
                  }}
                >
                  {productMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t("Nutrición")} sub={t(planTitle)} />

      <IonSegment
        className="plan-seg"
        value={tab}
        onIonChange={(e) => setTab((e.detail.value as typeof tab) ?? "hoy")}
      >
        <IonSegmentButton value="hoy">{t("Hoy")}</IonSegmentButton>
        <IonSegmentButton value="semana">{t("Semana")}</IonSegmentButton>
        <IonSegmentButton value="indicaciones">{t("Plan")}</IonSegmentButton>
        <IonSegmentButton value="historial">{t("Historial")}</IonSegmentButton>
      </IonSegment>

      {/* Todo lo demás hace scroll: analizador + resumen + contenido del tab. */}
      <Scroll>
        {/* ── Analizador de comida con IA (flujo real) ── */}
        <div
          className="card nut-ai-card"
          style={{
            margin: "10px 14px 0",
            background: "var(--navy)",
            borderColor: "transparent",
            color: "#fff",
          }}
        >
          {flow === null && (
            <>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                📸 {t("Analiza tu comida con IA")}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                {t("Toma una foto y recibe calorías, macros y porción reales.")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <IonButton
                  style={
                    { flex: 1, "--background": "var(--teal)" } as CSSProperties
                  }
                  disabled={!canMutate}
                  onClick={() => setMealPickerSource("camera")}
                >
                  <IonIcon icon={cameraOutline} slot="start" />
                  {t("Usar cámara")}
                </IonButton>
                <IonButton
                  style={{ flex: 1 }}
                  fill="outline"
                  disabled={!canMutate}
                  onClick={() => setMealPickerSource("gallery")}
                >
                  <IonIcon icon={imageOutline} slot="start" />
                  {t("Seleccionar imagen")}
                </IonButton>
              </div>
            </>
          )}
        </div>

        <div className="nut-goals-card">
          <div className="nut-goals-head">
            <div className="nut-kicker">{t("Tu progreso de hoy")}</div>
            {kcalRatio != null && (
              <span className="nut-goals-pct">
                {Math.round(kcalRatio * 100)} %
              </span>
            )}
          </div>
          <div className="nut-goals-body">
            <div className="nut-ring">
              <svg
                width="104"
                height="104"
                viewBox="0 0 100 100"
                style={{ transform: "rotate(-90deg)" }}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="nutRingGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" style={{ stopColor: "var(--teal)" }} />
                    <stop offset="1" style={{ stopColor: "var(--blue)" }} />
                  </linearGradient>
                </defs>
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="var(--g1)"
                  strokeWidth="10"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="url(#nutRingGrad)"
                  strokeWidth="10"
                  strokeDasharray="239"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 239 }}
                  animate={{ strokeDashoffset: ringOffset }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="nut-ring-center">
                <div className="display nut-ring-value">
                  {formatMetricValue(intakeTotals.calories, 0, locale)}
                </div>
                {kcalRatio != null && calorieTarget != null && (
                  <div className="nut-ring-target">
                    /{formatMetricValue(calorieTarget, 0, locale)}
                  </div>
                )}
                <div className="nut-ring-unit">kcal</div>
              </div>
            </div>
            <div className="nut-macro-list">
              {macroBars.length > 0 ? (
                macroBars.map((b, i) => (
                  <div
                    key={b.key}
                    className="nut-macro-row"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="nut-macro-top">
                      <span className="nut-macro-label">{t(b.key)}</span>
                      <span className="nut-macro-val">
                        {formatMetricValue(b.value, 0, locale)}/
                        {formatMetricValue(b.target as number, 0, locale)}g
                      </span>
                    </div>
                    <IonProgressBar
                      className="pb nut-macro-bar"
                      style={
                        {
                          "--background": "var(--g1)",
                          "--progress-background": b.color,
                        } as CSSProperties
                      }
                      value={Math.min(
                        1,
                        Math.max(0, b.value / (b.target as number)),
                      )}
                    />
                  </div>
                ))
              ) : (
                <div className="nut-macro-empty">
                  <span style={{ fontSize: 18 }}>🍽️</span>
                  <span>{t("Registra tus comidas para ver tu progreso")}</span>
                </div>
              )}
            </div>
          </div>
          {activeKcal != null && (
            <div className="nut-spent">
              <span aria-hidden="true" className="nut-spent-ico">
                🔥
              </span>
              <span>
                {t("Gasto activo del día: {kcal} kcal", {
                  kcal: formatMetricValue(activeKcal, 0, locale),
                })}
              </span>
            </div>
          )}
        </div>

        {tab === "hoy" && (
          <>
            <div
              className="card nut-hyd-card"
              style={{
                background: "var(--blue-l)",
                borderColor: "#B5D4F4",
              }}
            >
              <div className="nut-hyd-head">
                <div className="nut-hyd-title">
                  {planWaterMl != null && planWaterMl !== 2000
                    ? t(
                        "💧 Hidratación · {glasses} vasos · meta {goal} vasos ({liters} L)",
                        {
                          glasses: String(displayedGlasses),
                          goal: String(waterGoalGlasses),
                          liters: formatMetricValue(
                            planWaterMl / 1000,
                            1,
                            locale,
                          ),
                        },
                      )
                    : t(
                        "💧 Hidratación · {glasses} vasos · meta 8 vasos (2L)",
                        {
                          glasses: String(displayedGlasses),
                        },
                      )}
                </div>
                <span className="nut-hyd-badge" aria-hidden="true">
                  {displayedGlasses}/{waterGoalGlasses}
                </span>
              </div>
              <div className="nut-hyd-sub">
                {t("{current} / {goal} ml", {
                  current: formatMetricValue(displayedGlasses * 250, 0, locale),
                  goal: formatMetricValue(waterGoalGlasses * 250, 0, locale),
                })}
              </div>
              <IonProgressBar
                className="nut-hyd-bar"
                aria-hidden="true"
                value={Math.min(
                  1,
                  Math.max(0, displayedGlasses / waterGoalGlasses),
                )}
              />
              <div className="nut-hyd-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.button
                    key={i}
                    type="button"
                    className={`hyd-glass ${i < displayedGlasses ? "full" : ""}`}
                    disabled={!canMutate}
                    aria-pressed={i < displayedGlasses}
                    aria-label={t("Vaso {n} de {goal}", {
                      n: String(i + 1),
                      goal: String(8),
                    })}
                    onClick={() => tapGlass(i + 1)}
                    whileTap={canMutate ? { scale: 0.9 } : undefined}
                  >
                    {i < displayedGlasses ? "💧" : "🥛"}
                  </motion.button>
                ))}
              </div>
            </div>
            {displayMeals.map((m, idx) => (
              <motion.article
                key={m.id}
                className="meal-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-32px" }}
                transition={{
                  duration: 0.38,
                  delay: Math.min(idx * 0.06, 0.18),
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className="meal-hdr">
                  <span className="meal-ico" aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className="meal-title">{t(m.title)}</span>
                  {m.kcal != null && (
                    <span className="meal-kcal">{m.kcal} kcal</span>
                  )}
                </div>
                {m.items.length > 0 ? (
                  m.items.map((it) => (
                    <div key={it[1]} className="food-item">
                      <span className="food-ico" aria-hidden="true">
                        {it[0]}
                      </span>
                      <div className="food-main">
                        <div className="food-name">{t(it[1])}</div>
                        <div className="food-desc">{t(it[2])}</div>
                      </div>
                      <div className="food-macros">
                        {it[3] && <span className="fm fm-c">{it[3]}</span>}
                        {it[4] && <span className="fm fm-p">{it[4]}</span>}
                        {it[5] && <span className="fm fm-g">{it[5]}</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="meal-empty">
                    <span aria-hidden="true" className="meal-empty-ico">
                      🍽️
                    </span>
                    <span>{t("Sin comidas del plan para este momento")}</span>
                  </div>
                )}
                {loggedSet.has(m.id) ? (
                  <MealLoggedPanel
                    source={mealSources.get(m.id as MealCode) ?? null}
                    createdAt={
                      findMealLog(snapshot, m.id as MealCode)?.createdAt ?? null
                    }
                    onDetail={() =>
                      setFlow({
                        meal: m.id as Exclude<MealCode, "agua">,
                        mode: "detail",
                        startAt: "detail",
                      })
                    }
                    onEdit={() =>
                      setFlow({
                        meal: m.id as Exclude<MealCode, "agua">,
                        mode: "detail",
                        startAt: "edit",
                      })
                    }
                  />
                ) : (
                  <div className="meal-actions">
                    <motion.button
                      type="button"
                      className="meal-btn meal-btn-reg"
                      onClick={() =>
                        canMutate &&
                        openRegister(m.id as Exclude<MealCode, "agua">)
                      }
                      disabled={!canMutate}
                      whileTap={canMutate ? { scale: 0.97 } : undefined}
                    >
                      {t("Registrar")}
                    </motion.button>
                    <motion.button
                      type="button"
                      className="meal-btn meal-btn-ia"
                      onClick={() =>
                        canMutate &&
                        setFlow({
                          meal: m.id as Exclude<MealCode, "agua">,
                          mode: "register",
                          autoSource: "camera",
                        })
                      }
                      disabled={!canMutate}
                      whileTap={canMutate ? { scale: 0.97 } : undefined}
                    >
                      📸 {t("Foto IA")}
                    </motion.button>
                  </div>
                )}
              </motion.article>
            ))}
          </>
        )}

        {tab === "semana" && (
          <div style={{ padding: "12px 0" }}>
            <div className="card" style={{ margin: "0 14px 12px" }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>
                {t("📊 Adherencia semanal")}
              </div>
              {weekNutrition == null ? (
                scoresLoading ? null : (
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--mu)",
                      lineHeight: 1.6,
                    }}
                  >
                    {t("Sin datos de adherencia esta semana todavía")}
                  </div>
                )
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      background: "var(--blue-l)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--mu)" }}>
                      {t("Esta semana")}
                    </div>
                    <div
                      className="display"
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "var(--blue)",
                      }}
                    >
                      {formatMetricValue(weekNutrition, 0, locale)}%
                      {weekPrevious != null && (
                        <span
                          style={{
                            fontSize: 16,
                            marginLeft: 6,
                            color: weekTrendColor,
                          }}
                        >
                          {weekTrend === "up"
                            ? "↑"
                            : weekTrend === "down"
                              ? "↓"
                              : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                  {weekPrevious != null && (
                    <div
                      style={{
                        flex: 1,
                        background: "var(--g0)",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--mu)" }}>
                        {t("Semana anterior")}
                      </div>
                      <div
                        className="display"
                        style={{ fontSize: 22, fontWeight: 800 }}
                      >
                        {formatMetricValue(weekPrevious, 0, locale)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "indicaciones" && (
          <NutritionPlanTab
            plan={nutritionPlan}
            isLoading={planLoading}
            error={planError}
            fallbackRows={planRows}
            locale={locale}
            onRetry={() => void refetchPlan()}
          />
        )}

        {tab === "historial" && (
          <div className="card" style={{ margin: 14, padding: 0 }}>
            <div
              style={{
                background: "var(--navy)",
                color: "#fff",
                padding: 12,
                fontWeight: 700,
              }}
            >
              {t("📉 Evolución de peso")}
            </div>
            {weightSeries && weightSeries.points.length > 0 ? (
              <>
                {[...weightSeries.points].reverse().map((row, i) => {
                  const prev =
                    weightSeries.points[weightSeries.points.length - 2 - i];
                  const delta = prev ? row.value - prev.value : 0;
                  const bmiVal = bmiByDate.get(row.date);
                  const hba1cVal = hba1cByDate.get(row.date);
                  const subtitle = [
                    bmiVal != null
                      ? `IMC ${formatMetricValue(bmiVal, 1, locale)}`
                      : "",
                    hba1cVal != null
                      ? `HbA1c ${formatMetricValue(hba1cVal, 1, locale)} ${hba1cUnit}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div
                      key={`${row.date}-${i}`}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: 12,
                        borderBottom: "1px solid var(--g1)",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{ width: 48, fontSize: 11, color: "var(--mu)" }}
                      >
                        {formatDateForDisplay(row.date)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800 }}>
                          {formatMetricValue(row.value, 1, locale)} {weightUnit}
                        </div>
                        {subtitle && (
                          <div style={{ fontSize: 11, color: "var(--mu)" }}>
                            {subtitle}
                          </div>
                        )}
                      </div>
                      {prev ? (
                        <span
                          style={{
                            color:
                              delta < 0
                                ? "var(--teal)"
                                : delta > 0
                                  ? "var(--org)"
                                  : "var(--mu)",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {delta < 0 ? "↓" : delta > 0 ? "↑" : "—"}{" "}
                          {delta !== 0
                            ? `${formatMetricValue(Math.abs(delta), 1, locale)} ${weightUnit}`
                            : ""}
                        </span>
                      ) : (
                        <span style={{ color: "var(--mu)", fontSize: 12 }}>
                          {t("Inicio")}
                        </span>
                      )}
                    </div>
                  );
                })}
                {weightTarget && (
                  <div style={{ padding: 12, background: "#F8FBF8" }}>
                    <div style={{ fontSize: 11, color: "var(--mu)" }}>
                      {t("Meta")}
                    </div>
                    <div style={{ fontWeight: 800 }}>{weightTarget}</div>
                  </div>
                )}
              </>
            ) : metricsLoading ? null : (
              <div
                style={{
                  padding: 16,
                  fontSize: 13,
                  color: "var(--mu)",
                  lineHeight: 1.6,
                }}
              >
                {t("Aún no hay mediciones registradas")}
              </div>
            )}
          </div>
        )}
      </Scroll>

      {/* ── Registro manual de comida (prefill del plan, editable) ── */}
      <IonModal
        isOpen={registerTarget !== null}
        onDidDismiss={() => setRegisterTarget(null)}
      >
        <motion.div
          style={{ padding: 20 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="nut-reg-title">{t("Registrar comida")}</div>
          {registerTarget && (
            <MealIntakeForm
              initial={EMPTY_INTAKE_FORM}
              submitLabel={t("Guardar")}
              pending={nutritionMutation.isPending}
              planReference={planReferenceFor(registerTarget)}
              onSubmit={submitRegister}
            />
          )}
          <IonButton
            expand="block"
            fill="clear"
            onClick={() => setRegisterTarget(null)}
          >
            {t("Cancelar")}
          </IonButton>
        </motion.div>
      </IonModal>

      {/* ── La tarjeta IA global pide primero la comida ── */}
      <IonActionSheet
        isOpen={mealPickerSource !== null}
        onDidDismiss={() => setMealPickerSource(null)}
        header={t("¿Qué comida vas a registrar?")}
        buttons={[
          ...(["des", "alm", "mer", "cen"] as Exclude<MealCode, "agua">[])
            .filter((code) => !loggedSet.has(code))
            .map((code) => ({
              text: t(MEAL_LABELS[code]),
              handler: () => {
                if (mealPickerSource)
                  setFlow({
                    meal: code,
                    mode: "register",
                    autoSource: mealPickerSource,
                  });
              },
            })),
          { text: t("Cancelar"), role: "cancel" as const },
        ]}
      />

      {/* ── Flujo por comida (captura → revisión → detalle/edición) ── */}
      <IonModal isOpen={flow !== null} onDidDismiss={() => setFlow(null)}>
        <div style={{ padding: 20 }}>
          {flow && (
            <MealFoodFlow
              meal={flow.meal}
              mode={flow.mode}
              autoSource={flow.autoSource}
              startAt={flow.startAt}
              log={findMealLog(snapshot, flow.meal)}
              onClose={() => setFlow(null)}
              onManual={(meal) => {
                setFlow(null);
                openRegister(meal);
              }}
            />
          )}
        </div>
      </IonModal>
    </Screen>
  );
}

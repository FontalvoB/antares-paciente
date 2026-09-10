import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  IonButton,
  IonIcon,
  IonInput,
  IonModal,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from "@ionic/react";
import {
  alertCircleOutline,
  cameraOutline,
  imageOutline,
  refreshOutline,
} from "ionicons/icons";
import { PageHeader } from "../components/PageHeader";
import { Screen, Scroll } from "../components/Screen";
import { CameraCapture } from "../components/CameraCapture";
import { useApp } from "../context/AppContext";
import { useI18n } from "../i18n/I18nContext";
import { useNutritionLog } from "../hooks/useNutritionLog";
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
  prefillIntakeForm,
} from "../utils/nutritionForm";
import { deriveLoggedMeals } from "../utils/nutritionProgress";
import {
  deriveIntakeTotals,
  deriveMealSource,
  derivePlanTargets,
  deriveTrend,
  deriveWaterGlasses,
} from "../utils/nutritionIntake";
import { formatMetricTarget, formatMetricValue } from "../data/metrics";
import { formatDateForDisplay } from "../utils/dates";
import {
  analyzeFoodImage,
  displayName,
  FOOD_EMOJI,
  type DetectedFood,
  type FoodAnalysisResult,
} from "../utils/foodAiApi";

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
  const [tab, setTab] = useState<
    "hoy" | "semana" | "indicaciones" | "historial"
  >("hoy");

  // S3: locale activo para números (es-ES coma decimal / en-US punto).
  const locale = lang === "en" ? "en-US" : "es-ES";

  // ── Registro manual prefilled (SPEC nutrition-intake-adherence) ──
  const [registerTarget, setRegisterTarget] = useState<MealCode | null>(null);
  const [intakeForm, setIntakeForm] = useState({
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    fiberG: "",
  });

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

  // kcal-strip (server): anillo = kcal reales derivadas; ratio vs target real
  // (clamp 0..1); sin target → suma sin denominador. Barras de macros solo
  // con target real, progreso = real/target clamp 0..1 (sin % fijos).
  const kcalRatio =
    serverTargets.calories != null && serverTargets.calories > 0
      ? Math.min(1, Math.max(0, intakeTotals.calories / serverTargets.calories))
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

  type AnalysisState = "idle" | "camera" | "analyzing" | "success" | "error";
  const [analysis, setAnalysis] = useState<AnalysisState>("idle");
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const steps = [
    t("Foto tomada"),
    t("Analizando tu comida…"),
    t("Identificando alimentos…"),
    t("Calculando información nutricional…"),
  ];
  useEffect(() => {
    if (analysis !== "analyzing") return;
    setStep(1);
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, steps.length - 1)),
      800,
    );
    return () => clearInterval(id);
  }, [analysis, steps.length]);

  async function runAnalysis(blob: Blob, fileName: string) {
    setPhoto(URL.createObjectURL(blob));
    setAnalysis("analyzing");
    setAnalysisError(null);
    setResult(null);
    try {
      const data = await analyzeFoodImage(blob, fileName);
      setResult(data);
      setAnalysis(data.foods.length > 0 ? "success" : "error");
      if (data.foods.length === 0) {
        setAnalysisError(
          t("No se identificaron alimentos con suficiente confianza."),
        );
      }
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : t("Ocurrió un error al analizar la imagen."),
      );
      setAnalysis("error");
    }
  }

  function resetAnalysis() {
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(null);
    setResult(null);
    setAnalysisError(null);
    setAnalysis("idle");
    setStep(0);
  }

  // Abre el modal de registro con el prefill del plan (o vacío sin plan).
  const openRegister = (id: MealCode) => {
    setIntakeForm(prefillIntakeForm(planTargets.get(id)));
    setRegisterTarget(id);
  };

  // Guarda el registro manual (source manual). Solo API — sin fallback demo.
  // B7: el toast de éxito solo se muestra en onSuccess; errores de negocio
  // (p.ej. 400 intake inválido) se muestran con el mensaje del servidor y el
  // formulario queda abierto para corregir; 409 → silencioso (keep-state).
  const submitRegister = () => {
    if (!canMutate || !registerTarget) return;
    const num = (s: string): number | undefined => {
      if (s.trim() === "") return undefined;
      const value = Number(s);
      return Number.isNaN(value) ? undefined : value;
    };
    const intake: NutritionIntakePayload = {
      calories: num(intakeForm.calories),
      proteinG: num(intakeForm.proteinG),
      carbsG: num(intakeForm.carbsG),
      fatG: num(intakeForm.fatG),
      fiberG: num(intakeForm.fiberG),
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

  // Confirma un análisis de foto en una comida: persiste con source ai_photo
  // + analysisId (reemplaza el descarte anterior) y los macros del summary.
  // B7: mismo contrato de toasts que submitRegister.
  const logAnalysis = (id: MealCode) => {
    if (!canMutate) return;
    const summary = result?.summary;
    const intake: NutritionIntakePayload = summary
      ? {
          calories: Math.round(summary.calories),
          proteinG: summary.protein,
          carbsG: summary.carbohydrates,
          fatG: summary.fat,
          fiberG: summary.fiber,
          source: "ai_photo",
          foodAnalysisId: result?.analysisId,
        }
      : { source: "ai_photo", foodAnalysisId: result?.analysisId };
    nutritionMutation.mutate(
      { mealCode: id, intake },
      {
        onSuccess: () => {
          showToast(t("Comida registrada con foto"), "ok");
          resetAnalysis();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            resetAnalysis();
            return;
          }
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

      {/* ── Analizador de comida con IA (flujo real) ── */}
      <div
        className="card"
        style={{
          margin: "10px 14px 0",
          background: "var(--navy)",
          borderColor: "transparent",
          color: "#fff",
        }}
      >
        {analysis === "idle" && (
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
                onClick={() => setAnalysis("camera")}
              >
                <IonIcon icon={cameraOutline} slot="start" />
                {t("Usar cámara")}
              </IonButton>
              <IonButton
                style={{ flex: 1 }}
                fill="outline"
                onClick={() => {
                  setAnalysis("camera");
                  setTimeout(() => {
                    const input = document.querySelector<HTMLInputElement>(
                      'input[type="file"][accept="image/*"]',
                    );
                    input?.click();
                  }, 50);
                }}
              >
                <IonIcon icon={imageOutline} slot="start" />
                {t("Seleccionar imagen")}
              </IonButton>
            </div>
          </>
        )}

        {analysis === "camera" && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
              📷 {t("Apunta a tu comida")}
            </div>
            <CameraCapture
              onCapture={(blob, fileName) => runAnalysis(blob, fileName)}
              onCancel={resetAnalysis}
            />
          </motion.div>
        )}

        {analysis === "analyzing" && photo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: 14,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <img
                src={photo}
                alt={t("Fotografía de la comida")}
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  filter: "brightness(0.55)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  textAlign: "center",
                  padding: 16,
                }}
              >
                <IonSpinner
                  name="crescent"
                  style={{ color: "#fff", width: 34, height: 34 }}
                />
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {t("Analizando tu comida…")}
                </div>
                {steps.map((s, i) => (
                  <div
                    key={s}
                    style={{
                      fontSize: 12,
                      opacity: i <= step ? 1 : 0.35,
                      color: "#fff",
                    }}
                  >
                    {i < step ? "✓ " : i === step ? "▸ " : ""}
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {analysis === "success" && result && photo && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={photo}
              alt={t("Fotografía de la comida")}
              style={{
                width: "100%",
                borderRadius: 14,
                aspectRatio: "4/3",
                objectFit: "cover",
                marginBottom: 12,
              }}
            />
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
              {t("Alimentos detectados")} ({result.foods.length})
            </div>
            {result.foods.map((food, i) => (
              <FoodResultCard key={`${food.name}-${i}`} food={food} />
            ))}
            {result.summary &&
              result.foods.some((f) => f.nutritionStatus === "available") && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px dashed rgba(255,255,255,.25)",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{t("TOTAL")}</span>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>
                    {Math.round(result.summary.calories)} kcal
                  </span>
                </div>
              )}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                {t("Registrar en…")}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {(["des", "alm", "mer", "cen"] as MealCode[]).map((id) => (
                  <IonButton
                    key={id}
                    size="small"
                    fill="outline"
                    onClick={() => logAnalysis(id)}
                  >
                    {t("Registrar en {meal}", { meal: t(MEAL_LABELS[id]) })}
                  </IonButton>
                ))}
              </div>
            </div>
            <IonButton
              style={
                {
                  marginTop: 12,
                  "--background": "var(--teal)",
                } as CSSProperties
              }
              expand="block"
              onClick={resetAnalysis}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              {t("Analizar otra comida")}
            </IonButton>
          </motion.div>
        )}

        {analysis === "error" && (
          <motion.div
            className="nut-ai-result"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {photo && (
              <img
                src={photo}
                alt={t("Fotografía de la comida")}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  marginBottom: 12,
                }}
              />
            )}
            <div className="nut-ai-error" role="alert">
              <IonIcon icon={alertCircleOutline} aria-hidden="true" />
              <span>{analysisError}</span>
            </div>
            <IonButton expand="block" onClick={() => setAnalysis("camera")}>
              <IonIcon icon={cameraOutline} slot="start" />
              {t("Intentar de nuevo")}
            </IonButton>
            <IonButton expand="block" fill="clear" onClick={resetAnalysis}>
              {t("Cancelar")}
            </IonButton>
          </motion.div>
        )}
      </div>

      <div className="kcal-strip">
        <div
          style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}
        >
          <svg
            width="92"
            height="92"
            viewBox="0 0 100 100"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="#E8EEF4"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="#1D9E75"
              strokeWidth="10"
              strokeDasharray="239"
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="display" style={{ fontSize: 16, fontWeight: 800 }}>
              {formatMetricValue(intakeTotals.calories, 0, locale)}
            </div>
            {kcalRatio != null && (
              <div style={{ fontSize: 9, color: "var(--mu)" }}>
                /
                {formatMetricValue(serverTargets.calories as number, 0, locale)}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {macroBars.length > 0 ? (
            macroBars.map((b) => (
              <div
                key={b.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 10, color: "var(--mu)", width: 78 }}>
                  {t(b.key)}
                </span>
                <IonProgressBar
                  className="pb"
                  style={
                    {
                      flex: 1,
                      "--progress-background": b.color,
                    } as CSSProperties
                  }
                  value={Math.min(
                    1,
                    Math.max(0, b.value / (b.target as number)),
                  )}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    width: 36,
                    textAlign: "right",
                  }}
                >
                  {Math.round(b.value)}g
                </span>
              </div>
            ))
          ) : (
            <div
              style={{
                fontSize: 11,
                color: "var(--mu)",
                lineHeight: 1.5,
                paddingTop: 4,
              }}
            >
              {t("Registra tus comidas para ver tu progreso")}
            </div>
          )}
        </div>
      </div>

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

      <Scroll>
        {tab === "hoy" && (
          <>
            <div
              className="card"
              style={{
                margin: "10px 14px",
                background: "var(--blue-l)",
                borderColor: "#B5D4F4",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "var(--blue)",
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                {t("💧 Hidratación · {glasses} vasos · meta 8 vasos (2L)", {
                  glasses: String(displayedGlasses),
                })}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <button
                    key={i}
                    className={`hyd-glass ${i < displayedGlasses ? "full" : ""}`}
                    disabled={!canMutate}
                    onClick={() => tapGlass(i + 1)}
                  >
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
                  {m.kcal != null && (
                    <span style={{ opacity: 0.75, fontSize: 12 }}>
                      {m.kcal} kcal
                    </span>
                  )}
                </div>
                {m.items.length > 0 ? (
                  m.items.map((it) => (
                    <div key={it[1]} className="food-item">
                      <span>{it[0]}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {t(it[1])}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--mu)" }}>
                          {t(it[2])}
                        </div>
                      </div>
                      <div>
                        {it[3] && <span className="fm fm-c">{it[3]}</span>}
                        {it[4] && <span className="fm fm-p">{it[4]}</span>}
                        {it[5] && <span className="fm fm-g">{it[5]}</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{ padding: 12, fontSize: 12, color: "var(--mu)" }}
                  >
                    {t("Sin comidas del plan para este momento")}
                  </div>
                )}
                {loggedSet.has(m.id) ? (
                  <div
                    style={{
                      margin: 12,
                      background: "var(--teal-l)",
                      borderRadius: 12,
                      padding: 12,
                      color: "#0F6E56",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {mealSources.get(m.id as MealCode) === "ai_photo"
                      ? t("✓ Registrado con foto · análisis IA")
                      : mealSources.get(m.id as MealCode) === "manual"
                        ? t("✓ Registrado manualmente")
                        : t("✓ Registrado")}
                  </div>
                ) : (
                  <button
                    onClick={() => openRegister(m.id as MealCode)}
                    disabled={!canMutate}
                    style={{
                      margin: 12,
                      width: "calc(100% - 24px)",
                      background: "linear-gradient(145deg,#102a50,#173c73)",
                      border: "1.5px dashed rgba(32,200,255,.4)",
                      borderRadius: 12,
                      padding: 12,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>📸</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {t("Registrar lo que comí")}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>
                        {t("IA analiza gramos · kcal · adherencia")}
                      </div>
                    </div>
                  </button>
                )}
              </div>
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
                      <div style={{ fontSize: 22, fontWeight: 800 }}>
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
          <div className="card" style={{ margin: 14 }}>
            {planRows.length > 0 ? (
              planRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--g1)",
                  }}
                >
                  <span>{row.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>
                    {t(row.label)}
                  </span>
                  <span style={{ fontWeight: 800, color: "var(--teal)" }}>
                    {row.value}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: "6px 0",
                  fontSize: 13,
                  color: "var(--mu)",
                  lineHeight: 1.6,
                }}
              >
                {t("Sin plan nutricional asignado")}
              </div>
            )}
          </div>
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
        <div style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>
            {t("Registrar comida")}
          </div>
          {registerTarget && (
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 14 }}>
              {t(MEAL_LABELS[registerTarget])}
              {planTargets.has(registerTarget) &&
                ` · ${t("Valores del plan de hoy · editables")}`}
            </div>
          )}
          <IonInput
            label={t("Calorías (kcal)")}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="numeric"
            value={intakeForm.calories}
            onIonInput={(e) =>
              setIntakeForm((f) => ({
                ...f,
                calories: String(e.target.value ?? ""),
              }))
            }
          />
          <IonInput
            label={t("Proteínas (g)")}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.proteinG}
            onIonInput={(e) =>
              setIntakeForm((f) => ({
                ...f,
                proteinG: String(e.target.value ?? ""),
              }))
            }
          />
          <IonInput
            label={t("Carbohidratos (g)")}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.carbsG}
            onIonInput={(e) =>
              setIntakeForm((f) => ({
                ...f,
                carbsG: String(e.target.value ?? ""),
              }))
            }
          />
          <IonInput
            label={t("Grasas (g)")}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.fatG}
            onIonInput={(e) =>
              setIntakeForm((f) => ({
                ...f,
                fatG: String(e.target.value ?? ""),
              }))
            }
          />
          <IonInput
            label={t("Fibra (g)")}
            labelPlacement="stacked"
            fill="outline"
            type="number"
            inputmode="decimal"
            value={intakeForm.fiberG}
            onIonInput={(e) =>
              setIntakeForm((f) => ({
                ...f,
                fiberG: String(e.target.value ?? ""),
              }))
            }
          />
          <IonButton
            expand="block"
            style={
              { marginTop: 16, "--background": "var(--teal)" } as CSSProperties
            }
            onClick={submitRegister}
          >
            {t("Guardar")}
          </IonButton>
          <IonButton
            expand="block"
            fill="clear"
            onClick={() => setRegisterTarget(null)}
          >
            {t("Cancelar")}
          </IonButton>
        </div>
      </IonModal>
    </Screen>
  );
}

function FoodResultCard({ food }: { food: DetectedFood }) {
  const { t } = useI18n();
  const name = displayName(food.name);
  const emoji = FOOD_EMOJI[food.name] ?? "🍽️";
  const available = food.nutritionStatus === "available" && food.nutrition;

  return (
    <div
      style={{
        background: "rgba(255,255,255,.08)",
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <span
          style={{ fontWeight: 800, fontSize: 14, textTransform: "capitalize" }}
        >
          {name}
        </span>
        {food.portion && (
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75 }}>
            {Math.round(food.portion.estimatedGrams)} g
            {food.portion.minGrams != null && food.portion.maxGrams != null
              ? ` (${Math.round(food.portion.minGrams)}–${Math.round(food.portion.maxGrams)} g)`
              : ""}
          </span>
        )}
      </div>

      {available && food.nutrition ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 20 }}>
              {Math.round(food.nutrition.calories)}
            </span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>kcal</span>
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
            <span
              style={{
                background: "rgba(255,255,255,.1)",
                borderRadius: 8,
                padding: "3px 8px",
              }}
            >
              {t("Proteínas")} {Math.round(food.nutrition.protein)}g
            </span>
            <span
              style={{
                background: "rgba(255,255,255,.1)",
                borderRadius: 8,
                padding: "3px 8px",
              }}
            >
              {t("Carbohidratos")} {Math.round(food.nutrition.carbohydrates)}g
            </span>
            <span
              style={{
                background: "rgba(255,255,255,.1)",
                borderRadius: 8,
                padding: "3px 8px",
              }}
            >
              {t("Grasas")} {Math.round(food.nutrition.fat)}g
            </span>
          </div>
          {food.source && (
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6 }}>
              {food.source}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {food.nutritionStatus === "portion_unavailable"
            ? t(
                "Identificamos este alimento, pero no pudimos estimar una porción.",
              )
            : t(
                "Identificamos este alimento, pero no tenemos información nutricional disponible.",
              )}
        </div>
      )}
    </div>
  );
}

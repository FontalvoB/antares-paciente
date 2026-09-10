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
  const [tab, setTab] = useState<
    "hoy" | "semana" | "indicaciones" | "historial"
  >("hoy");

  // S3: locale activo para números (es-ES coma decimal / en-US punto).
  const locale = lang === "en" ? "en-US" : "es-ES";

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
  // Hoja de opciones al pedir registrar (foto/galería/manual).
  const [sheetMeal, setSheetMeal] = useState<Exclude<MealCode, "agua"> | null>(
    null,
  );
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

  // Abre el modal de registro manual con el formulario VACÍO. Los valores
  // del plan se muestran como referencia ("Objetivo"), nunca como consumo.
  const openRegister = (id: MealCode) => {
    setSheetMeal(null);
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

        <div className="kcal-strip">
          <div
            style={{
              position: "relative",
              width: 92,
              height: 92,
              flexShrink: 0,
            }}
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
              <div
                className="display"
                style={{ fontSize: 16, fontWeight: 800 }}
              >
                {formatMetricValue(intakeTotals.calories, 0, locale)}
              </div>
              {kcalRatio != null && (
                <div style={{ fontSize: 9, color: "var(--mu)" }}>
                  /
                  {formatMetricValue(
                    serverTargets.calories as number,
                    0,
                    locale,
                  )}
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
                    <div style={{ marginBottom: 8 }}>
                      {mealSources.get(m.id as MealCode) === "ai_photo"
                        ? t("✓ Registrado con foto · análisis IA")
                        : mealSources.get(m.id as MealCode) === "manual"
                          ? t("✓ Registrado manualmente")
                          : t("✓ Registrado")}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <IonButton
                        size="small"
                        fill="outline"
                        style={{ flex: 1 }}
                        onClick={() =>
                          setFlow({
                            meal: m.id as Exclude<MealCode, "agua">,
                            mode: "detail",
                            startAt: "detail",
                          })
                        }
                      >
                        {t("Ver detalle")}
                      </IonButton>
                      <IonButton
                        size="small"
                        fill="outline"
                        style={{ flex: 1 }}
                        onClick={() =>
                          setFlow({
                            meal: m.id as Exclude<MealCode, "agua">,
                            mode: "detail",
                            startAt: "edit",
                          })
                        }
                      >
                        {t("Editar comida")}
                      </IonButton>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      canMutate &&
                      setSheetMeal(m.id as Exclude<MealCode, "agua">)
                    }
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

      {/* ── Hoja por comida: foto / galería / manual (contexto preservado) ── */}
      <IonActionSheet
        isOpen={sheetMeal !== null}
        onDidDismiss={() => setSheetMeal(null)}
        header={
          sheetMeal
            ? t("Registrar {meal}", { meal: t(MEAL_LABELS[sheetMeal]) })
            : ""
        }
        buttons={[
          {
            text: t("Tomar foto"),
            handler: () => {
              if (sheetMeal)
                setFlow({
                  meal: sheetMeal,
                  mode: "register",
                  autoSource: "camera",
                });
            },
          },
          {
            text: t("Seleccionar imagen"),
            handler: () => {
              if (sheetMeal)
                setFlow({
                  meal: sheetMeal,
                  mode: "register",
                  autoSource: "gallery",
                });
            },
          },
          {
            text: t("Registro manual"),
            handler: () => {
              if (sheetMeal) openRegister(sheetMeal);
            },
          },
          { text: t("Cancelar"), role: "cancel" },
        ]}
      />

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

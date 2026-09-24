import { useMemo } from "react";
import { IonButton, IonSkeletonText } from "@ionic/react";
import { useT } from "../../i18n/I18nContext";
import { formatMetricValue } from "../../data/metrics";
import { mealTypeToCode } from "../../utils/mealTypeToCode";
import type { MealCode } from "../../services/program/nutrition-service";
import type { MyNutritionPlanDto } from "../../services/nutrition/my-nutrition-plan-service";
import type { ApiError } from "../../utils/apiClient";

/** Fila de meta con el formato de «Indicaciones» (emoji + label + valor). */
export interface PlanGoalRow {
  emoji: string;
  label: string;
  value: string;
}

export interface NutritionPlanTabProps {
  /** Plan asignado (`null` sin plan: 404 absorbido por el servicio). */
  plan: MyNutritionPlanDto | null;
  /** Carga inicial sin verdad previa que mostrar. */
  isLoading: boolean;
  /** Error real (nunca 404) para estado error + reintento. */
  error: ApiError | null;
  /** Filas del snapshot del programa (fallback cuando no hay plan). */
  fallbackRows: PlanGoalRow[];
  /** Locale activo para números (fechas y números nunca pasan por t()). */
  locale: string;
  onRetry: () => void;
}

/** Meta fija por código de comida del plan (clave t() + emoji). */
const PLAN_MEAL_META: Record<string, { label: string; emoji: string }> = {
  des: { label: "Desayuno", emoji: "🌅" },
  alm: { label: "Almuerzo", emoji: "☀️" },
  mer: { label: "Merienda", emoji: "🍎" },
  cen: { label: "Cena", emoji: "🌙" },
};

interface AssignedMealCard {
  key: string;
  label: string;
  labelIsKey: boolean;
  emoji: string;
  kcal: number | null;
  foods: string | null;
  notes: string | null;
  schedule: string | null;
  macroLine: string;
}

/**
 * Pestaña «Indicaciones»: plan alimentario asignado por el profesional con
 * metas reales y comidas configuradas. Sin plan muestra el vacío honesto;
 * con targets del snapshot (sin plan) conserva las filas previas.
 */
export function NutritionPlanTab({
  plan,
  isLoading,
  error,
  fallbackRows,
  locale,
  onRetry,
}: NutritionPlanTabProps) {
  const t = useT();

  const waterMl = useMemo(() => {
    if (!plan) return null;
    if (plan.dailyWaterMl != null) return plan.dailyWaterMl;
    for (const day of plan.days ?? []) {
      if (day.dailyWaterMl != null) return day.dailyWaterMl;
    }
    return null;
  }, [plan]);

  // Metas del plan: mismo formato que las filas del snapshot más el agua
  // diaria. Solo filas con meta persistida (sin fabricados).
  const goalRows = useMemo<PlanGoalRow[]>(() => {
    if (!plan) return [];
    const rows: PlanGoalRow[] = [];
    const grams = (v: number | null | undefined) =>
      v != null ? `${formatMetricValue(v, 0, locale)}g` : null;
    const push = (emoji: string, label: string, value: string | null) => {
      if (value != null) rows.push({ emoji, label, value });
    };
    push(
      "🔥",
      "Calorías diarias",
      plan.dailyCalorieTarget != null
        ? `${formatMetricValue(plan.dailyCalorieTarget, 0, locale)} kcal`
        : null,
    );
    push("🍚", "Carbohidratos", grams(plan.dailyCarbsTarget));
    push("🥩", "Proteínas", grams(plan.dailyProteinTarget));
    push("🥑", "Grasas", grams(plan.dailyFatTarget));
    push("🥦", "Fibra", grams(plan.dailyFiberTarget));
    return rows;
  }, [plan, locale]);

  // Comidas configuradas (plano `meals` o primer día con comidas). Tipos
  // desconocidos se muestran con su nombre crudo, nunca se descartan.
  const mealCards = useMemo<AssignedMealCard[]>(() => {
    if (!plan) return [];
    const raw =
      plan.meals?.length != null && plan.meals.length > 0
        ? plan.meals
        : ((plan.days ?? []).find((d) => (d.meals?.length ?? 0) > 0)?.meals ??
          []);
    return [...raw]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((m, i) => {
        const code: MealCode | null = m.mealType
          ? (mealTypeToCode(m.mealType) ?? null)
          : null;
        const meta = code ? PLAN_MEAL_META[code] : undefined;
        const macros = [
          m.carbsG != null
            ? `${formatMetricValue(m.carbsG, 0, locale)}g C`
            : "",
          m.proteinG != null
            ? `${formatMetricValue(m.proteinG, 0, locale)}g P`
            : "",
          m.fatG != null ? `${formatMetricValue(m.fatG, 0, locale)}g G` : "",
          m.fiberG != null
            ? `${formatMetricValue(m.fiberG, 0, locale)}g F`
            : "",
        ].filter(Boolean);
        return {
          key: `${code ?? "plan"}-${i}`,
          label: meta ? meta.label : (m.mealType ?? ""),
          labelIsKey: meta != null,
          emoji: meta ? meta.emoji : "🍽️",
          kcal: m.calories ?? null,
          foods: m.foods ?? null,
          notes: m.notes ?? null,
          schedule: m.suggestedTime ?? plan.mealTiming ?? null,
          macroLine: macros.join(" · "),
        };
      });
  }, [plan, locale]);

  if (isLoading && fallbackRows.length === 0 && !plan) {
    return (
      <div
        className="card"
        style={{ margin: 14 }}
        aria-busy="true"
        role="status"
      >
        <IonSkeletonText animated style={{ width: "60%" }} />
        <IonSkeletonText animated style={{ width: "100%" }} />
        <IonSkeletonText animated style={{ width: "100%" }} />
        <IonSkeletonText animated style={{ width: "80%" }} />
      </div>
    );
  }

  if (plan) {
    return (
      <>
        <div className="card" style={{ margin: 14 }}>
          {plan.name && (
            <div style={{ fontWeight: 800, fontSize: 15 }}>{plan.name}</div>
          )}
          {plan.targetCondition && (
            <div
              style={{
                fontSize: 12,
                color: "var(--mu)",
                marginTop: 2,
                marginBottom: 6,
              }}
            >
              {t("Condición objetivo")}: {plan.targetCondition}
            </div>
          )}
          {plan.description && (
            <div
              style={{
                fontSize: 12,
                color: "var(--mu)",
                lineHeight: 1.5,
                marginBottom: 6,
              }}
            >
              {plan.description}
            </div>
          )}
          {goalRows.map((row) => (
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
              <span style={{ flex: 1, fontWeight: 600 }}>{t(row.label)}</span>
              <span style={{ fontWeight: 800, color: "var(--teal)" }}>
                {row.value}
              </span>
            </div>
          ))}
          {waterMl != null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid var(--g1)",
              }}
            >
              <span>💧</span>
              <span style={{ flex: 1, fontWeight: 600 }}>
                {t("Agua diaria")}
              </span>
              <span style={{ fontWeight: 800, color: "var(--teal)" }}>
                {formatMetricValue(waterMl, 0, locale)} ml
              </span>
            </div>
          )}
        </div>
        {mealCards.map((m) => (
          <div key={m.key} className="meal-card">
            <div className="meal-hdr">
              <span>{m.emoji}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>
                {m.labelIsKey ? t(m.label) : m.label}
              </span>
              {m.kcal != null && (
                <span style={{ opacity: 0.75, fontSize: 12 }}>
                  {formatMetricValue(m.kcal, 0, locale)} kcal
                </span>
              )}
            </div>
            <div
              style={{
                padding: 12,
                fontSize: 12,
                color: "var(--mu)",
                display: "grid",
                gap: 6,
                lineHeight: 1.5,
              }}
            >
              {m.foods && (
                <div>
                  <strong>{t("Alimentos recomendados")}: </strong>
                  {m.foods}
                </div>
              )}
              {m.schedule && (
                <div>
                  <strong>{t("Horario sugerido")}: </strong>
                  {m.schedule}
                </div>
              )}
              {m.notes && (
                <div>
                  <strong>{t("Notas del nutricionista")}: </strong>
                  {m.notes}
                </div>
              )}
              {m.macroLine && (
                <div>
                  <span className="fm fm-c">{m.macroLine}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </>
    );
  }

  if (fallbackRows.length > 0) {
    return (
      <div className="card" style={{ margin: 14 }}>
        {fallbackRows.map((row) => (
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
            <span style={{ flex: 1, fontWeight: 600 }}>{t(row.label)}</span>
            <span style={{ fontWeight: 800, color: "var(--teal)" }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: 14 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--mu)",
            lineHeight: 1.6,
            marginBottom: 10,
          }}
          role="alert"
        >
          {error.message || t("No se pudo cargar el plan alimentario")}
        </div>
        <IonButton
          expand="block"
          fill="outline"
          style={{ minHeight: 44 }}
          onClick={onRetry}
        >
          {t("Reintentar")}
        </IonButton>
      </div>
    );
  }

  return (
    <div className="card" style={{ margin: 14 }}>
      <div
        style={{
          padding: "6px 0",
          fontSize: 13,
          color: "var(--mu)",
          lineHeight: 1.6,
        }}
      >
        {t(
          "Tu nutricionista aún no ha asignado un plan alimentario personalizado.",
        )}
      </div>
    </div>
  );
}

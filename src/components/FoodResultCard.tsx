import { useI18n } from "../i18n/I18nContext";
import { displayName, FOOD_EMOJI, type DetectedFood } from "../utils/foodAiApi";

/**
 * Tarjeta de un alimento detectado (extraída verbatim de NutritionPage para
 * reutilizarla en el flujo por comida sin duplicar UI).
 */
export function FoodResultCard({ food }: { food: DetectedFood }) {
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

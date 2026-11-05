import { IonChip, IonIcon } from "@ionic/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  alertCircle, barbellOutline, checkmarkCircle, leafOutline,
  nutritionOutline, restaurantOutline, scaleOutline, waterOutline, warningOutline,
} from "ionicons/icons";
import { FOOD_SPRING } from "./nutrition/foodMotion";
import { useI18n } from "../i18n/I18nContext";
import { displayName, FOOD_EMOJI, type DetectedFood } from "../utils/foodAiApi";

/** Tarjeta de dominio compartida por revisión y detalle; Ionic conserva los chips. */
export function FoodResultCard({ food, index = 0 }: { food: DetectedFood; index?: number }) {
  const reduced = useReducedMotion();
  const { t, lang } = useI18n();
  const name = lang === "en" && food.nameEn?.trim() ? food.nameEn : displayName(food.name);
  const emoji = FOOD_EMOJI[food.name];
  const available = food.nutritionStatus === "available" && food.nutrition;
  const estimated = food.nutritionSource === "llm_estimate" || food.source === "llm_estimate";
  const confidence = food.confidence >= 0.8
    ? { label: t("Confianza alta"), tone: "high", icon: checkmarkCircle }
    : food.confidence >= 0.5
      ? { label: t("Confianza media"), tone: "medium", icon: alertCircle }
      : { label: t("Confianza baja"), tone: "low", icon: alertCircle };
  const verified = food.nutritionSource === "usda" || food.source?.toLowerCase().includes("usda");
  const macros = food.nutrition ? [
    { label: t("Proteínas"), value: food.nutrition.protein, icon: barbellOutline, tone: "protein" },
    { label: t("Carbohidratos"), value: food.nutrition.carbohydrates, icon: restaurantOutline, tone: "carbs" },
    { label: t("Grasas"), value: food.nutrition.fat, icon: waterOutline, tone: "fat" },
    ...(food.nutrition.fiber != null ? [{ label: t("Fibra"), value: food.nutrition.fiber, icon: leafOutline, tone: "fiber" }] : []),
  ] : [];

  return (
    <motion.div
      className="food-result-card"
      initial={{ opacity: 0, ...(reduced ? {} : { y: 16 }) }}
      animate={{ opacity: 1, ...(reduced ? {} : { y: 0 }) }}
      transition={reduced ? { duration: 0.18 } : { ...FOOD_SPRING, delay: index * 0.06 }}
    >
      <div className="food-result-top">
        <span className="food-result-avatar" aria-hidden="true">
          {emoji && emoji !== "🍽️" ? emoji : <IonIcon icon={nutritionOutline} />}
        </span>
        <strong className="food-result-name" style={{ overflowWrap: "anywhere" }}>{name}</strong>
        {available && food.nutrition && (
          <div className="food-result-energy">
            <strong>{estimated ? "≈ " : ""}{Math.round(food.nutrition.calories)}</strong>
            <span>kcal</span>
          </div>
        )}
      </div>
      <div className="food-result-meta">
        {food.portion && (
          <IonChip className="food-result-portion">
            <IonIcon icon={scaleOutline} aria-hidden="true" />
            <span>{Math.round(food.portion.estimatedGrams)} g
              {food.portion.minGrams != null && food.portion.maxGrams != null
                ? ` (${Math.round(food.portion.minGrams)}–${Math.round(food.portion.maxGrams)} g)` : ""}
            </span>
          </IonChip>
        )}
        <IonChip className={`food-result-confidence ${confidence.tone}`}>
          <IonIcon icon={confidence.icon} aria-hidden="true" />
          <span>{confidence.label}</span>
        </IonChip>
      </div>
      {food.confidence < 0.5 && (
        <p className="nut-ai-hint">{t("Revisa este alimento o intenta con otra foto.")}</p>
      )}
      {estimated && available && (
        <IonChip className="food-result-estimate">
          {t("≈ Valores estimados por IA — ajústalos si puedes")}
        </IonChip>
      )}
      {available && food.nutrition ? (
        <>
          <div className="food-result-macros">
            {macros.map(macro => (
              <IonChip key={macro.tone} className={`food-result-macro ${macro.tone}`}>
                <IonIcon icon={macro.icon} aria-hidden="true" />
                <span>{macro.label} {Math.round(macro.value)}g</span>
              </IonChip>
            ))}
          </div>
          {(estimated || verified) && (
            <p className="food-result-source">
              {estimated ? t("≈ Estimación de IA") : t("Datos verificados · USDA")}
            </p>
          )}
        </>
      ) : (
        <div className="nut-missing" role="note">
          <IonIcon icon={warningOutline} aria-hidden="true" />
          <div>
            <strong>{t("Información nutricional no disponible")}</strong>
            <small>
              {food.nutritionStatus === "portion_unavailable"
                ? t(
                    "Identificamos este alimento, pero no pudimos estimar una porción.",
                  )
                : t(
                    "Identificamos este alimento, pero no tenemos información nutricional disponible.",
                  )}
            </small>
          </div>
        </div>
      )}
    </motion.div>
  );
}

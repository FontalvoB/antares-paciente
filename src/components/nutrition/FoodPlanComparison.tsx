import { useState } from "react";
import { IonButton, IonIcon, IonSelect, IonSelectOption, IonSkeletonText } from "@ionic/react";
import { leafOutline } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import type { FoodAnalysisResult } from "../../utils/foodAiApi";
import type { MyNutritionPlanDto } from "../../services/nutrition/my-nutrition-plan-service";
import type { MealCode } from "../../services/program/nutrition-service";
import { mealTypeToCode } from "../../utils/mealTypeToCode";
import { compareFoodToMeal } from "../../utils/foodPlanComparison";

/** Tarjeta de dominio: mantiene los valores del profesional junto a la estimación de Food AI. */
export function FoodPlanComparison({
  result,
  mealCode,
  plan,
  loading,
  failed,
  onRetry,
}: {
  result: FoodAnalysisResult;
  mealCode: MealCode;
  plan?: MyNutritionPlanDto | null;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const { t, lang } = useI18n();
  const [selectedDay, setSelectedDay] = useState<string>("");
  const days = plan?.days ?? [];
  // Un ciclo de varios días no identifica el día de hoy: el paciente lo elige explícitamente.
  const needsDay = !plan?.meals?.length && days.length > 1;
  const meals = plan?.meals?.length
    ? plan.meals
    : days[needsDay ? Number(selectedDay || -1) : 0]?.meals;
  const matches =
    meals?.filter(
      (m) => m.mealType && mealTypeToCode(m.mealType) === mealCode,
    ) ?? [];
  const meal = matches.length === 1 ? matches[0] : null;
  const rows = meal ? compareFoodToMeal(result, meal) : [];
  const mealNotes = lang === "en" && meal?.notesEn?.trim() ? meal.notesEn : meal?.notes;
  const labels = {
    calories: t("Calorías"),
    proteinG: t("Proteínas"),
    carbsG: t("Carbohidratos"),
    fatG: t("Grasas"),
    fiberG: t("Fibra"),
  };
  return (
    <section className="food-plan-check" aria-label={t("Tu comida y tu plan")}>
      <div className="food-plan-heading">
        <IonIcon icon={leafOutline} />
        <div>
          <small>{t("FOOD AI · TU PLAN")}</small>
          <h3>{t("Tu comida y tu plan")}</h3>
        </div>
      </div>
      {loading ? (
        <div role="status" aria-busy="true"><p>{t("Cargando tu plan…")}</p><IonSkeletonText animated style={{ height: 60 }} /></div>
      ) : failed ? (
        <div role="alert"><p>
          {t(
            "No pudimos consultar tu plan. No se puede evaluar la coincidencia.",
          )}
        </p>{onRetry && <IonButton fill="outline" onClick={onRetry}>{t("Reintentar")}</IonButton>}</div>
      ) : !plan ? (
        <p>
          {t(
            "No tienes un plan nutricional asignado para comparar esta comida.",
          )}
        </p>
      ) : (
        <>
          <p className="food-plan-name">{plan.name}</p>
          {needsDay && (
            <IonSelect
              className="fld"
              interface="popover"
              labelPlacement="stacked"
              label={t("Día del plan")}
              placeholder={t("Selecciona el día que estás siguiendo")}
              value={selectedDay}
              onIonChange={(e) => setSelectedDay(String(e.detail.value))}
            >
              {days.map((day, i) => (
                <IonSelectOption key={i} value={String(i)}>
                  {t("Día {day}", { day: String(day.dayNumber ?? i + 1) })}
                </IonSelectOption>
              ))}
            </IonSelect>
          )}
          {rows.length > 0 ? (
            <>
              <div className="food-plan-columns">
                <span>{t("Nutriente")}</span>
                <span>{t("Tu foto")}</span><span>{t("Tu plan")}</span>
              </div>
              {rows.map((row) => (
                <div className="food-plan-row" key={row.key}>
                  <div>
                    <strong>{labels[row.key]}</strong>
                    <small>
                      {row.delta === 0
                        ? t("Coincide con la meta")
                        : row.delta > 0
                          ? t("{value} por encima", {
                              value: `${row.delta} ${row.key === "calories" ? "kcal" : "g"}`,
                            })
                          : t("{value} por debajo", {
                              value: `${Math.abs(row.delta)} ${row.key === "calories" ? "kcal" : "g"}`,
                            })}
                    </small>
                  </div>
                  <b className="food-plan-estimated">{Math.round(row.estimated * 10) / 10}<small>{row.key === "calories" ? "kcal" : "g"}</small></b>
                  <b className="food-plan-target">{row.target}<small>{row.key === "calories" ? "kcal" : "g"}</small></b>
                </div>
              ))}
              <p className="food-plan-note">
                {t(
                  "Comparación estimada de porciones y macros. Estar por debajo no siempre es mejor; revisa las cantidades indicadas en tu plan.",
                )}
              </p>
            </>
          ) : (
            (!needsDay || selectedDay !== "") && (
              <p>
                {t(
                  "No hay metas comparables para esta comida o el análisis está incompleto. No podemos confirmar la adherencia.",
                )}
              </p>
            )
          )}
          {meal?.foods && (
            <p>
              <strong>{t("Alimentos de tu plan")}: </strong>
              {meal.foods}
            </p>
          )}
          {mealNotes && <p>{mealNotes}</p>}
          {plan.allergens && (
            <p>
              <strong>{t("Restricciones del plan")}: </strong>
              {plan.allergens}
            </p>
          )}
          <small>
            {t(
              "La foto no permite verificar ingredientes ocultos, alergias ni todas las indicaciones de tu profesional.",
            )}
          </small>
        </>
      )}
    </section>
  );
}

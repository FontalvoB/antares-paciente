import { useState } from "react";
import { IonIcon, IonSelect, IonSelectOption } from "@ionic/react";
import { leafOutline } from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
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
}: {
  result: FoodAnalysisResult;
  mealCode: MealCode;
  plan?: MyNutritionPlanDto | null;
  loading?: boolean;
  failed?: boolean;
}) {
  const t = useT();
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
        <p role="status">{t("Cargando tu plan…")}</p>
      ) : failed ? (
        <p>
          {t(
            "No pudimos consultar tu plan. No se puede evaluar la coincidencia.",
          )}
        </p>
      ) : !plan ? (
        <p>
          {t(
            "No tienes un plan nutricional asignado para comparar esta comida.",
          )}
        </p>
      ) : (
        <>
          <p>{plan.name}</p>
          {needsDay && (
            <IonSelect
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
                <span>{t("Foto / plan")}</span>
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
                  <b>
                    {Math.round(row.estimated * 10) / 10} / {row.target}{" "}
                    <small>{row.key === "calories" ? "kcal" : "g"}</small>
                  </b>
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
          {meal?.notes && <p>{meal.notes}</p>}
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

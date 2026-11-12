import { useState } from "react";
import { IonAccordion, IonAccordionGroup, IonButton, IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonSkeletonText } from "@ionic/react";
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
  const calories = rows.find(row => row.key === "calories");
  const locale = lang === "en" ? "en-US" : "es-ES";
  const format = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
  const summary = failed ? t("No disponible") : !plan ? t("Sin plan")
    : needsDay && selectedDay === "" ? t("Elegir día")
    : calories ? t("{value} de {target} kcal", { value: format(calories.estimated), target: format(calories.target) })
    : rows.length ? t("Ver detalle") : t("Sin comparación");
  return (
    <section className="food-plan-check" aria-label={t("Tu comida y tu plan")}>
      <IonAccordionGroup>
        <IonAccordion value="meal-plan-comparison">
          <IonItem slot="header" lines="none" className="food-plan-summary">
            <IonIcon slot="start" icon={leafOutline} aria-hidden="true" />
            <IonLabel>{t("Frente a tu plan")}</IonLabel>
            <span slot="end" className="food-plan-summary-value" aria-busy={loading}>
              {loading ? <IonSkeletonText animated /> : summary}
            </span>
          </IonItem>
          <div slot="content" className="food-plan-details">
            {loading ? <div role="status" aria-busy="true"><IonSkeletonText animated style={{ height: 48 }} /></div>
              : failed ? <div role="alert"><p>{t("No pudimos cargar tu plan.")}</p>{onRetry && <IonButton fill="outline" size="small" onClick={onRetry}>{t("Reintentar")}</IonButton>}</div>
              : !plan ? <p>{t("Sin plan para comparar.")}</p> : <>
                {plan.name && <p className="food-plan-name">{plan.name}</p>}
                {needsDay && <IonSelect
                  className="fld"
                  interface="popover"
                  labelPlacement="stacked"
                  label={t("Día del plan")}
                  placeholder={t("Selecciona el día")}
                  value={selectedDay}
                  onIonChange={e => setSelectedDay(String(e.detail.value))}
                >
                  {days.map((day, i) => <IonSelectOption key={i} value={String(i)}>{t("Día {day}", { day: String(day.dayNumber ?? i + 1) })}</IonSelectOption>)}
                </IonSelect>}
                {rows.length ? <>
                  <div className="food-plan-columns"><span>{t("Nutriente")}</span><span>{t("Tu foto")}</span><span>{t("Tu plan")}</span></div>
                  {rows.map(row => <div className="food-plan-row" key={row.key}>
                    <strong>{labels[row.key]}</strong>
                    <b className="food-plan-estimated">{format(row.estimated)}<small>{row.key === "calories" ? "kcal" : "g"}</small></b>
                    <b className="food-plan-target">{format(row.target)}<small>{row.key === "calories" ? "kcal" : "g"}</small></b>
                  </div>)}
                </> : (!needsDay || selectedDay !== "") && <p>{t("Sin datos para comparar.")}</p>}
                {meal?.foods && <p><strong>{t("Alimentos de tu plan")}: </strong>{meal.foods}</p>}
                {mealNotes && <p>{mealNotes}</p>}
                {plan.allergens && <p><strong>{t("Restricciones del plan")}: </strong>{plan.allergens}</p>}
              </>}
          </div>
        </IonAccordion>
      </IonAccordionGroup>
    </section>
  );
}

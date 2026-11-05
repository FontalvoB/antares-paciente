import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { IonButton, IonSkeletonText, IonIcon, IonSelect, IonSelectOption } from "@ionic/react";
import { leafOutline, waterOutline, restaurantOutline, timeOutline, checkmarkCircleOutline, analyticsOutline, shieldCheckmarkOutline, calendarOutline, refreshOutline } from "ionicons/icons";
import { RingProgress } from "../RingProgress";
import { useT } from "../../i18n/I18nContext";
import { formatMetricValue } from "../../data/metrics";
import { mealTypeToCode } from "../../utils/mealTypeToCode";
import type { MealCode } from "../../services/program/nutrition-service";
import type { MyNutritionPlanDto } from "../../services/nutrition/my-nutrition-plan-service";
import type { NutritionPlanStatusDto } from "../../services/nutrition/my-nutrition-plan-service";
import { formatDateForDisplay } from "../../utils/dates";
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
  status?: NutritionPlanStatusDto | null;
  onOpenAssessments?: () => void;
  onOpenProgram?: () => void;
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
  macros: Array<{ text: string; tone: string }>;
  description?: string | null;
  missing?: boolean;
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
  status,
  onOpenAssessments,
  onOpenProgram,
}: NutritionPlanTabProps) {
  const t = useT();
  const [chosenDay, setChosenDay] = useState<number | null>(null);
  const days = [...(plan?.days ?? [])].filter(day => Number.isInteger(day.dayNumber) && (day.dayNumber ?? 0) > 0).sort((a, b) => a.dayNumber! - b.dayNumber!);
  const defaultDay = status?.currentDay ?? plan?.currentDay ?? days[0]?.dayNumber ?? 1;
  const shownDay = (chosenDay != null ? days.find(day => day.dayNumber === chosenDay) : days.find(day => day.dayNumber === defaultDay) ?? days[(Math.max(1, defaultDay) - 1) % days.length]) ?? days[0];
  const duration = status?.durationDays ?? plan?.durationDays;
  const currentDay = status?.currentDay ?? plan?.currentDay;
  const startDate = status?.startDate ?? plan?.startDate;
  const endDate = status?.endDate ?? plan?.endDate;

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
        : (shownDay?.meals ??
          []);
    const configured: AssignedMealCard[] = [...raw]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((m, i) => {
        const code: MealCode | null = m.mealType
          ? (mealTypeToCode(m.mealType) ?? null)
          : null;
        const meta = code ? PLAN_MEAL_META[code] : undefined;
        const macros: Array<{ text: string; tone: string }> = [
          m.carbsG != null
            ? {
                text: `${formatMetricValue(m.carbsG, 0, locale)}g C`,
                tone: "fm-c",
              }
            : null,
          m.proteinG != null
            ? {
                text: `${formatMetricValue(m.proteinG, 0, locale)}g P`,
                tone: "fm-p",
              }
            : null,
          m.fatG != null
            ? {
                text: `${formatMetricValue(m.fatG, 0, locale)}g G`,
                tone: "fm-g",
              }
            : null,
          m.fiberG != null
            ? {
                text: `${formatMetricValue(m.fiberG, 0, locale)}g F`,
                tone: "fm-f",
              }
            : null,
        ].filter((x): x is { text: string; tone: string } => x !== null);
        return {
          key: `${code ?? "plan"}-${i}`,
          label: meta ? meta.label : (m.mealType ?? ""),
          labelIsKey: meta != null,
          emoji: meta ? meta.emoji : "🍽️",
          kcal: m.calories ?? null,
          foods: m.foods ?? null,
          description: m.description ?? null,
          notes: m.notes ?? null,
          schedule: m.suggestedTime ?? plan.mealTiming ?? null,
          macros,
        };
      });
    // La merienda siempre tiene su lugar, sin inventar una prescripción.
    const ordered = Object.entries(PLAN_MEAL_META).flatMap<AssignedMealCard>(([code, meta]) => {
      const matches = configured.filter(card => card.key.startsWith(`${code}-`));
      return matches.length ? matches : [{ key: `${code}-missing`, label: meta.label, labelIsKey: true, emoji: meta.emoji, kcal: null, foods: null, notes: null, schedule: null, macros: [], missing: true }];
    });
    return [...ordered, ...configured.filter(card => !Object.keys(PLAN_MEAL_META).some(code => card.key.startsWith(`${code}-`)))];
  }, [plan, locale, shownDay]);

  if (status && status.status !== 'active') {
    const message = {
      no_plan: 'Tu plan aún no está disponible. Consulta con tu equipo de atención.',
      no_assessment_assignment: 'Tu equipo te asignará las baterías iniciales para preparar tu plan.',
      assessments_pending: 'Completa tus baterías para preparar tu plan personalizado.',
      generating: 'Estamos preparando tu plan con los resultados de tus baterías.',
      pending_review: 'Tu nutricionista está revisando tu plan. Lo verás aquí cuando lo apruebe.',
      expired: 'Tu ciclo nutricional terminó. Tu equipo revisará tu siguiente plan.',
      generation_failed: 'Tu equipo está revisando la preparación de tu plan. No necesitas repetir las baterías.',
    }[status.status] ?? 'Tu plan aún no está disponible. Consulta con tu equipo de atención.';
    const batteriesReady = !['no_assessment_assignment', 'assessments_pending'].includes(status.status);
    const draftReady = status.status === 'pending_review';
    const currentStep = !batteriesReady ? 0 : draftReady ? 2 : 1;
    const steps = [
      { title: batteriesReady ? 'Baterías completadas' : 'Tus baterías iniciales', detail: 'Tus respuestas son el punto de partida.', icon: analyticsOutline },
      { title: 'Borrador con tus resultados', detail: 'La IA propone un menú a partir de tu perfil.', icon: leafOutline },
      { title: 'Revisión de tu nutricionista', detail: 'Tu profesional puede ajustar las comidas antes de aprobarlas.', icon: shieldCheckmarkOutline },
      { title: 'Tu plan de 30 días', detail: 'Verás el menú, la merienda y las fechas de tu ciclo.', icon: calendarOutline },
    ];
    return <div className="nutrition-preparation">
      <section className="ntr-card nutrition-plan-status" role="status">
        <div className="nutrition-preparation-intro"><span className="nutrition-preparation-mark"><IonIcon icon={leafOutline} aria-hidden="true" /></span><span className="ntr-eyebrow">{t('Tu plan personalizado')}</span></div>
        <h2>{t('Así estamos creando tu plan')}</h2><p>{t(message)}</p>
        <div className="nutrition-preparation-phase"><IonIcon icon={draftReady ? shieldCheckmarkOutline : timeOutline} aria-hidden="true" /><strong>{t(draftReady ? 'En revisión por nutrición' : status.status === 'generation_failed' ? 'Tu equipo revisará el borrador' : !batteriesReady ? 'Comienza con tus evaluaciones' : status.status === 'expired' ? 'Preparando tu próximo ciclo' : 'Cada paso parte de tus resultados')}</strong></div>
        <ol className="nutrition-preparation-steps" aria-label={t('Pasos de tu plan nutricional')}>
          {steps.map((step, index) => <li key={step.title} data-state={index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming'} aria-current={index === currentStep ? 'step' : undefined}>
            <span className="nutrition-step-icon"><IonIcon icon={index < currentStep ? checkmarkCircleOutline : step.icon} aria-hidden="true" /></span>
            <div><strong>{t(step.title)}</strong><p>{t(step.detail)}</p><small>{t(index < currentStep ? 'Completado' : index === currentStep ? 'Paso actual' : 'Después')}</small></div>
          </li>)}
        </ol>
      </section>
      <section className="ntr-card nutrition-preparation-review"><h3>{t('Qué cuidará tu nutricionista')}</h3><p>{t('Revisará tus resultados, las alergias y restricciones registradas, y las comidas del ciclo. La dieta se publica cuando aprueba el borrador.')}</p><div className="nutrition-preparation-duration"><IonIcon icon={calendarOutline} aria-hidden="true" /><span>{t('Cada plan aprobado te acompaña durante 30 días.')}</span></div></section>
      <section className="ntr-card nutrition-preparation-actions"><h3>{t('Mientras llega tu plan')}</h3><p>{t('Puedes revisar tus evaluaciones y continuar con las actividades disponibles de tu programa.')}</p>
        {onOpenAssessments && <IonButton expand="block" fill="outline" onClick={onOpenAssessments}>{t('Ver mis evaluaciones')}</IonButton>}
        {onOpenProgram && <IonButton expand="block" className="bt bt-primary" onClick={onOpenProgram}>{t('Abrir mi protocolo')}</IonButton>}
        <IonButton expand="block" fill="clear" onClick={onRetry}><IonIcon slot="start" icon={refreshOutline} />{t('Actualizar estado')}</IonButton>
      </section>
    </div>;
  }


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

  if (status?.status === 'active' && plan && ((status.planId && plan.id && status.planId !== plan.id) || (status.revision != null && plan.revision != null && status.revision !== plan.revision))) {
    return <section className="ntr-card" role="status" aria-busy={!error}><h2>{t('Actualizando tu plan aprobado')}</h2><p>{t('Cargando las indicaciones de tu nutricionista.')}</p>{error ? <IonButton onClick={onRetry}>{t('Reintentar')}</IonButton> : <IonSkeletonText animated style={{ height: 90 }} />}</section>;
  }

  if (plan) {
    return (
      <div className="ntr-plan-view">
        <div className="ntr-card ntr-plan-overview">
          <div className="ntr-section-title"><IonIcon icon={leafOutline} /><h2>{t("Tu plan nutricional")}</h2></div>
          {plan.name && <div className="nut-plan-name">{plan.name}</div>}
          {currentDay != null && duration != null && <div className="nutrition-cycle"><span>{t('Tu ciclo nutricional')}</span><strong>{t('Día {day} de {total}', { day: String(currentDay), total: String(duration) })}</strong>{startDate && endDate && <p>{t('Del {start} al {end}', { start: formatDateForDisplay(startDate), end: formatDateForDisplay(endDate) })}</p>}</div>}
          {plan.targetCondition && (
            <div className="nut-plan-cond">
              {t("Condición objetivo")}: {plan.targetCondition}
            </div>
          )}
          {plan.description && (
            <div className="nut-plan-desc">{plan.description}</div>
          )}
          <nav className="nutrition-meal-navigation" aria-label={t('Comidas de tu plan')}>
            <h3>{t('Tu menú de hoy')}</h3>
            <p>{t('Desayuno, almuerzo, merienda y cena: toca una comida para ver tus indicaciones.')}</p>
            <div className="nutrition-meal-shortcuts">
              {mealCards.map(meal => <IonButton key={meal.key} fill="clear" onClick={() => {
                const target = document.getElementById(`nutrition-meal-${meal.key}`);
                target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
                target?.focus({ preventScroll: true });
              }}><span aria-hidden="true">{meal.emoji}</span><span><strong>{meal.labelIsKey ? t(meal.label) : meal.label}</strong><small>{t(meal.missing ? 'Por indicar' : 'Ver mi comida')}</small></span></IonButton>)}
            </div>
          </nav>
          <div className="ntr-plan-targets">
          {plan.dailyCalorieTarget != null && <div className="ntr-calorie-target"><RingProgress value={1} size={132} stroke={11} trackColor="var(--blue-l)" gradient={['var(--blue)', 'var(--teal)']}><strong>{formatMetricValue(plan.dailyCalorieTarget, 0, locale)} kcal</strong></RingProgress><b>{t("Calorías diarias")}</b><span>{t("Objetivo del plan")}</span></div>}
          <div className="ntr-target-list">
          {goalRows.filter(row => row.label !== 'Calorías diarias').map((row) => (
            <div key={row.label} className="nut-plan-row">
              <span className="nut-plan-ico" aria-hidden="true">
                {row.emoji}
              </span>
              <span className="nut-plan-label">{t(row.label)}</span>
              <span className="nut-plan-val">{row.value}</span>
            </div>
          ))}
          </div>
          </div>
          <p className="ntr-plan-caption">{t("Metas diarias indicadas por tu nutricionista.")}</p>
        </div>
        {(waterMl != null || plan.mealTiming) && <section className="ntr-card">
          <div className="ntr-section-title"><IonIcon icon={restaurantOutline} /><h2>{t("Objetivos del día")}</h2></div>
          <div className="ntr-daily-goals">
          {waterMl != null && (
            <div className="ntr-daily-goal">
              <IonIcon icon={waterOutline} aria-hidden="true" />
              <span>{t("Agua diaria")}</span>
              <strong>
                {formatMetricValue(waterMl, 0, locale)} ml
              </strong>
            </div>
          )}
          {plan.mealTiming && <div className="ntr-daily-goal"><IonIcon icon={timeOutline} aria-hidden="true" /><span>{t("Horario sugerido")}</span><strong>{plan.mealTiming}</strong></div>}
          </div>
        </section>}
        {mealCards.length > 0 && <div className="ntr-meals-heading"><span className="ntr-eyebrow">{t("Recomendaciones personalizadas")}</span><h2>{t("Tu alimentación, paso a paso")}</h2></div>}
        {days.length > 1 && <IonSelect className="fld nutrition-day-select" interface="popover" label={t('Ver el menú de otro día')} labelPlacement="stacked" value={shownDay?.dayNumber} onIonChange={e => setChosenDay(Number(e.detail.value))}>{days.map(day => <IonSelectOption key={day.dayNumber} value={day.dayNumber}>{t('Día {day}', { day: String(day.dayNumber) })}</IonSelectOption>)}</IonSelect>}
        {mealCards.map((m, idx) => (
          <motion.article
            key={m.key}
            id={`nutrition-meal-${m.key}`}
            tabIndex={-1}
            className="meal-card ntr-prescribed-meal"
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
                <IonIcon icon={restaurantOutline} />
              </span>
              <span className="meal-title">
                {m.labelIsKey ? t(m.label) : m.label}
              </span>
              {m.kcal != null && (
                <span className="meal-kcal">
                  {formatMetricValue(m.kcal, 0, locale)} kcal
                </span>
              )}
            </div>
            <div className="nut-plan-details">
              {m.missing && <p className="nutrition-unconfigured">{t('Tu nutricionista aún no ha indicado esta comida para este día.')}</p>}
              {m.description && <p className="nutrition-meal-description">{m.description}</p>}
              {m.foods && (
                <div className="nut-plan-detail">
                  <strong>{t("Alimentos recomendados")}: </strong>
                  {m.foods}
                </div>
              )}
              {m.schedule && (
                <div className="nut-plan-detail">
                  <strong>{t("Horario sugerido")}: </strong>
                  {m.schedule}
                </div>
              )}
              {m.notes && (
                <div className="nut-plan-detail">
                  <strong>{t("Notas del nutricionista")}: </strong>
                  {m.notes}
                </div>
              )}
              {m.macros.length > 0 && (
                <div className="nut-plan-macros">
                  {m.macros.map((macro) => (
                    <span key={macro.text} className={`fm ${macro.tone}`}>
                      {macro.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.article>
        ))}
      </div>
    );
  }


  if (fallbackRows.length > 0) {
    return (
      <div className="card nut-plan-card">
        {fallbackRows.map((row) => (
          <div key={row.label} className="nut-plan-row">
            <span className="nut-plan-ico" aria-hidden="true">
              {row.emoji}
            </span>
            <span className="nut-plan-label">{t(row.label)}</span>
            <span className="nut-plan-val">{row.value}</span>
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

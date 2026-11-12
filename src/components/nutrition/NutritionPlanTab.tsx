import { useMemo, useState } from "react";
import { IonButton, IonSkeletonText, IonIcon, IonSelect, IonSelectOption, IonProgressBar } from "@ionic/react";
import { leafOutline, waterOutline, restaurantOutline, timeOutline, checkmarkCircleOutline, analyticsOutline, shieldCheckmarkOutline, calendarOutline, refreshOutline, cafeOutline, sunnyOutline, moonOutline, informationCircleOutline } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { localizedError } from "../../utils/localizedError";
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

/** Meta fija por código de comida del plan (clave t() + icono Ionic). */
const PLAN_MEAL_META: Record<string, { label: string; icon: string }> = {
  des: { label: "Desayuno", icon: cafeOutline },
  alm: { label: "Almuerzo", icon: sunnyOutline },
  mer: { label: "Merienda / snack", icon: leafOutline },
  cen: { label: "Cena", icon: moonOutline },
};

interface AssignedMealCard {
  key: string;
  label: string;
  labelIsKey: boolean;
  icon: string;
  code: MealCode | null;
  waterMl: number | null;
  kcal: number | null;
  foods: string | null;
  notes: string | null;
  schedule: string | null;
  macros: Array<{ text: string; tone: string; label: string }>;
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
  const { t, lang } = useI18n();
  const [selection, setSelection] = useState<{ plan: string; day: number } | null>(null);
  const planKey = `${plan?.id ?? ""}:${plan?.revision ?? ""}`;
  const chosenDay = selection?.plan === planKey ? selection.day : null;
  const days = [...(plan?.days ?? [])].filter(day => Number.isInteger(day.dayNumber) && (day.dayNumber ?? 0) > 0).sort((a, b) => a.dayNumber! - b.dayNumber!);
  const defaultDay = status?.currentDay ?? plan?.currentDay ?? days[0]?.dayNumber ?? 1;
  const shownDay = (chosenDay != null ? days.find(day => day.dayNumber === chosenDay) : days.find(day => day.dayNumber === defaultDay) ?? days[(Math.max(1, defaultDay) - 1) % days.length]) ?? days[0];
  const duration = status?.durationDays ?? plan?.durationDays;
  const currentDay = status?.currentDay ?? plan?.currentDay;
  const startDate = status?.startDate ?? plan?.startDate;
  const endDate = status?.endDate ?? plan?.endDate;

  const waterMl = shownDay?.dailyWaterMl ?? plan?.dailyWaterMl ?? null;

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

  // Comidas del día mostrado (o contrato plano legacy). Tipos
  // desconocidos se muestran con su nombre crudo, nunca se descartan.
  const mealCards = useMemo<AssignedMealCard[]>(() => {
    if (!plan) return [];
    const raw =
      shownDay ? shownDay.meals ?? [] : plan.meals ?? [];
    const configured: AssignedMealCard[] = [...raw]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((m, i) => {
        const code: MealCode | null = m.mealType
          ? (mealTypeToCode(m.mealType) ?? null)
          : null;
        const meta = code ? PLAN_MEAL_META[code] : undefined;
        const macros: Array<{ text: string; tone: string; label: string }> = [
          m.carbsG != null
            ? {
                text: `${formatMetricValue(m.carbsG, 0, locale)} g`,
                label: "Carbohidratos",
                tone: "fm-c",
              }
            : null,
          m.proteinG != null
            ? {
                text: `${formatMetricValue(m.proteinG, 0, locale)} g`,
                label: "Proteínas",
                tone: "fm-p",
              }
            : null,
          m.fatG != null
            ? {
                text: `${formatMetricValue(m.fatG, 0, locale)} g`,
                label: "Grasas",
                tone: "fm-g",
              }
            : null,
          m.fiberG != null
            ? {
                text: `${formatMetricValue(m.fiberG, 0, locale)} g`,
                label: "Fibra",
                tone: "fm-f",
              }
            : null,
        ].filter((x): x is { text: string; tone: string; label: string } => x !== null);
        return {
          key: `${code ?? "plan"}-${i}`,
          label: meta ? meta.label : (m.mealType ?? ""),
          labelIsKey: meta != null,
          icon: meta?.icon ?? restaurantOutline,
          code,
          waterMl: m.waterMl ?? null,
          kcal: m.calories ?? null,
          foods: m.foods ?? null,
          description: m.description ?? null,
          notes: lang === "en" && m.notesEn?.trim() ? m.notesEn : m.notes ?? null,
          schedule: m.suggestedTime ?? null,
          macros,
        };
      });
    // Conserva todas las filas y su orden prescrito, incluso varios snacks legacy.
    const ordered = [...configured];
    const codes = Object.keys(PLAN_MEAL_META);
    for (const [code, meta] of Object.entries(PLAN_MEAL_META)) {
      if (configured.some(card => card.code === code)) continue;
      const index = ordered.findIndex(card => card.code != null && codes.indexOf(card.code) > codes.indexOf(code));
      const missing: AssignedMealCard = { key: `${code}-missing`, code: code as MealCode, label: meta.label, labelIsKey: true, icon: meta.icon, waterMl: null, kcal: null, foods: null, notes: null, schedule: null, macros: [], missing: true };
      ordered.splice(index < 0 ? ordered.length : index, 0, missing);
    }
    return ordered;
  }, [plan, locale, lang, shownDay]);

  if (status && status.status !== 'active') {
    const message = {
      no_plan: 'Tu plan aún no está disponible. Consulta con tu equipo de atención.',
      no_assessment_assignment: 'Tu equipo te asignará las baterías iniciales para preparar tu plan.',
      assessments_pending: 'Completa tus baterías para preparar tu plan personalizado.',
      generating: 'Estamos preparando tu plan con los resultados de tus baterías.',
      pending_review: 'Estamos terminando de publicar tu plan automático. No necesitas esperar aprobación de un nutricionista.',
      expired: 'Tu ciclo nutricional terminó. Tu equipo revisará tu siguiente plan.',
      generation_failed: 'Tu equipo está revisando la preparación de tu plan. No necesitas repetir las baterías.',
    }[status.status] ?? 'Tu plan aún no está disponible. Consulta con tu equipo de atención.';
    const batteriesReady = !['no_assessment_assignment', 'assessments_pending'].includes(status.status);
    const draftReady = status.status === 'pending_review';
    const currentStep = !batteriesReady ? 0 : draftReady ? 2 : 1;
    const steps = [
      { title: batteriesReady ? 'Baterías completadas' : 'Tus baterías iniciales', detail: 'Tus respuestas son el punto de partida.', icon: analyticsOutline },
      { title: 'Borrador con tus resultados', detail: 'La IA propone un menú a partir de tu perfil.', icon: leafOutline },
      { title: 'Publicación automática', detail: 'Tu plan estará disponible al terminar su generación.', icon: shieldCheckmarkOutline },
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
      <section className="ntr-card nutrition-preparation-review"><h3>{t('Sobre tu plan automático')}</h3><p>{t('El programa usa tus evaluaciones y la información registrada para preparar el menú. Consulta las recomendaciones y el aviso antes de comenzar.')}</p><div className="nutrition-preparation-duration"><IonIcon icon={calendarOutline} aria-hidden="true" /><span>{t('Cada plan te acompaña durante 30 días.')}</span></div></section>
      <section className="ntr-card nutrition-preparation-actions"><h3>{t('Mientras llega tu plan')}</h3><p>{t('Puedes revisar tus evaluaciones y continuar con las actividades disponibles de tu programa.')}</p>
        {onOpenAssessments && <IonButton expand="block" fill="outline" onClick={onOpenAssessments}>{t('Ver mis evaluaciones')}</IonButton>}
        {onOpenProgram && <IonButton expand="block" className="bt bt-primary" onClick={onOpenProgram}>{t('Abrir mi protocolo')}</IonButton>}
        <IonButton expand="block" fill="clear" onClick={onRetry}><IonIcon slot="start" icon={refreshOutline} />{t('Actualizar estado')}</IonButton>
      </section>
    </div>;
  }


  if (isLoading && !plan) {
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
    return <section className="ntr-card" role="status" aria-busy={!error}><h2>{t('Actualizando tu plan')}</h2><p>{t('Cargando las indicaciones de tu plan.')}</p>{error ? <IonButton onClick={onRetry}>{t('Reintentar')}</IonButton> : <IonSkeletonText animated style={{ height: 90 }} />}</section>;
  }

  if (plan) {
    const menuTitle = chosenDay == null ? t('Tu menú de hoy') : t('Menú del día {day}', { day: String(shownDay?.dayNumber ?? chosenDay) });
    return (
      <div className="ntr-plan-view nutrition-plan-redesign">
        <header className="nutrition-plan-intro">
          <h2>{t('Tu plan nutricional')}</h2>
          {plan.name && <p className="nutrition-plan-name">{plan.name}</p>}
          {plan.description && <p className="nutrition-plan-description">{plan.description}</p>}
          {currentDay != null && duration != null && <div className="nutrition-plan-cycle">
            <div><span>{t('Tu ciclo nutricional')}</span><strong>{t('Día {day} de {total}', { day: String(currentDay), total: String(duration) })}</strong></div>
            <IonProgressBar value={Math.min(1, Math.max(0, currentDay / duration))} aria-label={t('Día {day} de {total}', { day: String(currentDay), total: String(duration) })} />
            {startDate && endDate && <p><IonIcon icon={calendarOutline} aria-hidden="true" />{t('Del {start} al {end}', { start: formatDateForDisplay(startDate), end: formatDateForDisplay(endDate) })}</p>}
          </div>}
        </header>
        {error && <div className="nutrition-plan-refresh-error" role="alert"><p>{t('No pudimos actualizar tu plan. Estas son las últimas indicaciones disponibles.')}</p><IonButton fill="clear" onClick={onRetry}>{t('Reintentar')}</IonButton></div>}
        <section className="nutrition-plan-menu" aria-labelledby="nutrition-menu-heading">
          <div className="nutrition-plan-menu-head"><h2 id="nutrition-menu-heading">{menuTitle}</h2><p>{t('Tus comidas, porciones y horarios en un solo lugar.')}</p></div>
          {days.length > 1 && <IonSelect className="nutrition-plan-day" interface="popover" label={t('Ver el menú de otro día')} labelPlacement="stacked" value={shownDay?.dayNumber} onIonChange={e => setSelection({ plan: planKey, day: Number(e.detail.value) })}>{days.map(day => <IonSelectOption key={day.dayNumber} value={day.dayNumber}>{t('Día {day}', { day: String(day.dayNumber) })}</IonSelectOption>)}</IonSelect>}
          {chosenDay != null && <IonButton className="nutrition-plan-today" fill="clear" onClick={() => setSelection(null)}>{t('Volver al menú de hoy')}</IonButton>}
          <nav className="nutrition-meal-navigation" aria-label={t('Comidas de tu plan')}>
            <div className="nutrition-meal-shortcuts">{Object.entries(PLAN_MEAL_META).map(([code, meta]) => {
              const matches = mealCards.filter(meal => meal.code === code);
              const meal = matches[0];
              return <IonButton key={code} fill="clear" onClick={() => {
                const target = document.getElementById(`nutrition-meal-${meal?.key}`);
                target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
                target?.focus({ preventScroll: true });
              }}><IonIcon icon={meta.icon} aria-hidden="true" /><span><strong>{t(code === 'mer' ? 'Meriendas y snacks' : meta.label)}</strong><small>{matches.every(m => m.missing) ? t('Por indicar') : matches.length > 1 ? t('{count} comidas', { count: String(matches.length) }) : meal?.schedule ?? t('Ver indicaciones')}</small></span></IonButton>;
            })}</div>
          </nav>
          <div className="nutrition-plan-meals">{mealCards.map(m => <article key={m.key} id={`nutrition-meal-${m.key}`} tabIndex={-1} className={`nutrition-plan-meal${m.code === 'mer' ? ' nutrition-plan-snack' : ''}${m.missing ? ' nutrition-plan-unconfigured' : ''}`}>
            <header className="nutrition-plan-meal-head"><span className="nutrition-plan-meal-icon"><IonIcon icon={m.icon} aria-hidden="true" /></span><div><h3>{m.labelIsKey ? t(m.label) : m.label}</h3>{m.schedule && <p><IonIcon icon={timeOutline} aria-hidden="true" />{m.schedule}</p>}</div>{m.kcal != null && <span className="nutrition-plan-kcal">{formatMetricValue(m.kcal, 0, locale)}<small>kcal</small></span>}</header>
            {m.missing ? <p className="nutrition-plan-missing">{t(m.code === 'mer' ? 'Tu nutricionista aún no ha indicado una merienda o snack para este día.' : 'Tu nutricionista aún no ha indicado esta comida para este día.')}</p> : <div className="nutrition-plan-meal-body">
              {m.description && <h4>{m.description}</h4>}
              {m.foods && <div className="nutrition-plan-foods"><strong>{t('Alimentos y porciones')}</strong><p>{m.foods.replace(/;\s*/g, "\n")}</p></div>}
              {!m.description && !m.foods && <p className="nutrition-plan-missing">{t('Consulta con tu nutricionista las porciones de esta comida.')}</p>}
              {m.macros.length > 0 && <div className="nutrition-plan-macros">{m.macros.map(macro => <span key={macro.tone}><small>{t(macro.label)}</small><strong>{macro.text}</strong></span>)}</div>}
              {m.waterMl != null && <p className="nutrition-plan-meal-water"><IonIcon icon={waterOutline} aria-hidden="true" />{t('Agua con esta comida: {amount} ml', { amount: formatMetricValue(m.waterMl, 0, locale) })}</p>}
              {m.notes && <div className="nutrition-plan-note"><IonIcon icon={informationCircleOutline} aria-hidden="true" /><div><strong>{t('Indicación de tu nutricionista')}</strong><p>{m.notes}</p></div></div>}
            </div>}
          </article>)}</div>
        </section>
        <section className="nutrition-plan-goals" aria-labelledby="nutrition-goals-heading"><h2 id="nutrition-goals-heading">{t('Tus metas diarias')}</h2><p>{t('Son objetivos de tu plan, no alimentos que ya registraste.')}</p><dl>{goalRows.map(row => <div key={row.label}><dt>{t(row.label)}</dt><dd>{row.value}</dd></div>)}{waterMl != null && <div><dt>{t('Agua diaria')}</dt><dd>{formatMetricValue(waterMl, 0, locale)} ml</dd></div>}</dl>{!goalRows.length && waterMl == null && <p>{t('Tu nutricionista aún no ha indicado metas diarias.')}</p>}</section>
        {(plan.allergens || plan.mealTiming || plan.targetCondition) && <section className="nutrition-plan-guidance"><h2>{t('Ten presente')}</h2>{plan.targetCondition && <div><h3>{t('Condición objetivo')}</h3><p>{plan.targetCondition}</p></div>}{plan.allergens && <div><h3>{t('Restricciones y alérgenos del plan')}</h3><p>{plan.allergens}</p></div>}{plan.mealTiming && <div><h3>{t('Horario general del plan')}</h3><p>{plan.mealTiming}</p></div>}</section>}
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
          {localizedError(error, { t, lang }, "No se pudo cargar el plan alimentario")}
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

import { WellnessGuidance } from "../WellnessGuidance";
import { useEffect, useRef, useState } from "react";
import { IonButton, IonChip, IonIcon, IonInput, IonModal, IonProgressBar, IonSpinner } from "@ionic/react";
import { arrowBackOutline, cameraOutline, checkmarkCircle, waterOutline } from "ionicons/icons";
import { CameraCapture } from "../../../components/CameraCapture";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { analyzeFoodImage } from "../../../utils/foodAiApi";
import type { FoodAnalysisResult } from "../../../utils/foodAiApi";
import { getWellnessHomeData, localISODate } from "../state/wellness-home-store";
import { checkinHistory, checkinOwner } from "../checkin/checkin-store";
import { dailyEffects, EFFECT_COPY } from "../checkin/close-day";
import { buildDietDay, nextDish, sumMacros } from "./diet-plan";
import type { DietMacros } from "./diet-plan";
import {
  addWaterServing, logDietMeal, readDietDay, readDietPlanDetails,
  saveDishChoice, savePhotoDraft, setDietSimplified,
} from "./diet-store";
import type { PhotoDraft, PhotoEstimate } from "./diet-store";
import { FOODS } from "./meal-catalog";
import type { MealId } from "./meal-catalog";
import "../wellness.css";
import "../protocol/wellness-protocol.css";
import "./wellness-diet.css";
import { VitaEntry } from "../vita";

const PHOTO_FIELDS = {
  grams: "Porción (g)",
  kcal: "Energía (kcal)",
  proteinG: "Proteína (g)",
  carbsG: "Carbohidratos (g)",
  fatG: "Grasas (g)",
  fiberG: "Fibra (g)",
} as const;

const EMPTY_PHOTO: PhotoDraft = { grams: "", kcal: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" };
const PHOTO_KEYS = Object.keys(PHOTO_FIELDS) as (keyof PhotoDraft)[];

function draftFromAnalysis(analysis: FoodAnalysisResult): PhotoDraft | null {
  const { intake, summary, foods } = analysis;
  if (!intake && !summary) return null;
  const values = {
    kcal: intake?.calories ?? summary?.calories,
    proteinG: intake?.proteinG ?? summary?.protein,
    carbsG: intake?.carbsG ?? summary?.carbohydrates,
    fatG: intake?.fatG ?? summary?.fat,
    fiberG: intake?.fiberG ?? summary?.fiber,
    grams: foods.length && foods.every((food) => Number.isFinite(food.portion?.estimatedGrams))
      ? foods.reduce((total, food) => total + (food.portion?.estimatedGrams ?? 0), 0)
      : undefined,
  };
  const draft = { ...EMPTY_PHOTO };
  for (const key of PHOTO_KEYS) {
    const value = values[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      draft[key] = String(Math.round(value * 10) / 10);
    }
  }
  return draft;
}

function parsePhoto(draft: PhotoDraft): PhotoEstimate | null {
  const entries = PHOTO_KEYS.map((key) => {
    const raw = draft[key].trim().replace(",", ".");
    return [key, raw ? Number(raw) : null] as const;
  });
  for (const [key, value] of entries) {
    if (value === null && (key === "grams" || key === "fiberG")) continue;
    if (value === null || !Number.isFinite(value) || value < 0 || (key === "kcal" && value === 0)) return null;
  }
  return Object.fromEntries(entries) as unknown as PhotoEstimate;
}

type PhotoPhase = "capture" | "loading" | "review";

export function WellnessDiet() {
  const [today, setToday] = useState(() => new Date());
  const date = localISODate(today);
  useEffect(() => {
    const refresh = () => setToday(new Date());
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(refresh, Math.max(1, next.getTime() - now.getTime()));
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [today]);

  return <WellnessDietDay key={date} today={today} />;
}

function WellnessDietDay({ today }: { today: Date }) {
  const { user, navigate } = useApp();
  const { t, lang } = useI18n();
  const home = getWellnessHomeData(user?.nombre ?? "", today);
  const prefs = readDietPlanDetails();
  const [log, setLog] = useState(() => readDietDay(today, home.plan.startDate));
  const [saveError, setSaveError] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealId | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [phase, setPhase] = useState<PhotoPhase>("capture");
  const request = useRef(0);
  const modalTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (phase !== "capture") modalTitle.current?.focus();
  }, [phase]);

  const { nutrition, messages } = dailyEffects(localISODate(today), checkinHistory(checkinOwner(user)), home.day);
  const autoSimple = log.autoSimple || nutrition.simpleMenu;
  const simplified = log.manualSimple || autoSimple;
  const plan = buildDietDay({ ...home.plan, weightKg: prefs.weightKg }, home.day, prefs, log.choices, simplified);
  const eaten = Object.values(log.eaten);
  const consumed = sumMacros(eaten.map((meal) => meal.values));
  const measuredFiber = eaten.flatMap(({ values }) =>
    "fiberG" in values && values.fiberG !== null ? [values.fiberG] : [],
  );
  const activeDish = plan.meals.find(({ id }) => id === activeMeal);
  const draft = activeMeal ? log.pending[activeMeal] ?? EMPTY_PHOTO : EMPTY_PHOTO;
  const photo = parsePhoto(draft);
  const numbers = new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CO", { maximumFractionDigits: 1 });
  const format = (value: number) => numbers.format(value);
  const energy = (value: number) => t("{value} kcal", { value: format(Math.round(value)) });
  const grams = (value: number) => t("{value} g", { value: format(value) });
  const macros = ({ proteinG, carbsG, fatG }: DietMacros) => t(
    "{protein} proteína · {carbs} carbohidratos · {fat} grasas",
    { protein: grams(proteinG), carbs: grams(carbsG), fat: grams(fatG) },
  );

  function update(action: () => void) {
    try {
      action();
      setLog(readDietDay(today, home.plan.startDate));
      setSaveError(false);
      return true;
    } catch {
      setSaveError(true);
      return false;
    }
  }

  function openPhoto(id: MealId) {
    setAnalysisError(false);
    setSaveError(false);
    setPhase(log.pending[id] ? "review" : "capture");
    setActiveMeal(id);
    setPhotoOpen(true);
  }

  function closePhoto() {
    request.current++;
    setPhotoOpen(false);
  }

  async function capture(id: MealId, blob: Blob, name: string) {
    const version = ++request.current;
    setPhase("loading");
    let estimate: PhotoDraft | null;
    try {
      estimate = draftFromAnalysis(await analyzeFoodImage(blob, name, lang));
    } catch {
      estimate = null;
    }
    if (version !== request.current) return;
    if (estimate) update(() => savePhotoDraft(today, id, estimate));
    setAnalysisError(!estimate);
    setPhase("review");
  }

  return (
    <Screen>
      <Scroll className="wp-scroll">
        <header className="wp-hero">
          <div className="wp-hero-top">
            <IonButton
              className="wl-diet-back"
              fill="outline"
              onClick={() => navigate("protocol")}
              aria-label={t("Volver al protocolo")}
            >
              <IonIcon icon={arrowBackOutline} slot="icon-only" aria-hidden="true" />
            </IonButton>
            <div>
              <p className="wp-eyebrow">{t("Día {day}", { day: format(home.day) })}</p>
              <h1 className="wp-title">{t("Dieta de hoy")}</h1>
            </div>
          </div>
          <WellnessGuidance kind="diet" className="wl-diet-notice" />
        </header>

        <div className="wl-diet-body">
          <section className="wp-card wl-diet-summary">
            <h2>{t("Resumen del día")}</h2>
            <p className="wl-diet-energy">{energy(plan.total.kcal)}</p>
            <p>{t("Meta diaria: {energy}", { energy: energy(home.plan.kcal) })}</p>
            <p>{macros(plan.total)}</p>
            <p>{t("Meta de fibra: {fiber}", { fiber: grams(plan.fiberG) })}</p>
            <div className="wl-diet-log" role="status">
              <strong>{t("{count} de 4 comidas registradas", { count: format(eaten.length) })}</strong>
              {eaten.length > 0 && <p>{energy(consumed.kcal)} · {macros(consumed)}</p>}
              {measuredFiber.length > 0 && (
                <p>{t("Fibra registrada: {fiber}", {
                  fiber: grams(measuredFiber.reduce((total, value) => total + value, 0)),
                })}</p>
              )}
            </div>
          </section>

          <section className="wp-card wl-diet-water">
            <h2><IonIcon icon={waterOutline} aria-hidden="true" /> {t("Agua de hoy")}</h2>
            <p role="status">{t("{amount} de {goal} ml", {
              amount: format(log.waterMl), goal: format(plan.waterMl),
            })}</p>
            <IonProgressBar
              aria-label={t("Progreso de agua")}
              value={plan.waterMl > 0 ? Math.min(1, log.waterMl / plan.waterMl) : 0}
            />
            <IonButton fill="outline" onClick={() => update(() => addWaterServing(today))}>
              {t("+250 ml")}
            </IonButton>
          </section>

          <section className="wp-card">
            <h2>{t("Preferencias de alimentación")}</h2>
            <div className="wl-diet-preferences">
              <IonChip outline={!prefs.vegetarian}>
                {prefs.vegetarian ? t("Vegetariana") : t("Vegetariana: no")}
              </IonChip>
              <IonChip outline={!prefs.dairyFree}>
                {prefs.dairyFree ? t("Sin lácteos") : t("Sin lácteos: no")}
              </IonChip>
            </div>
            <button
              type="button"
              className={`wl-chip${simplified ? " is-selected" : ""}`}
              aria-pressed={simplified}
              disabled={autoSimple}
              onClick={() => update(() => setDietSimplified(!log.manualSimple))}
            >
              {t("Modo simplificado")}
            </button>
            {simplified && (
              <p role="status">
                {nutrition.simpleMenu ? t(EFFECT_COPY.simpleMenu) : log.autoSimple
                  ? t("El menú tiene menos opciones porque registraste menos del 60 % de las comidas en cada uno de los dos días anteriores.")
                  : t("El menú tiene menos opciones para que sea más fácil elegir.")}
              </p>
            )}
          </section>

          {nutrition.blockCuts && (
            <p className="wp-card">{t(messages.includes(EFFECT_COPY.dizziness) ? EFFECT_COPY.dizziness : EFFECT_COPY.hunger)}</p>
          )}
          {saveError && !activeMeal && <p role="alert">{t("No se pudo guardar el registro. Inténtalo de nuevo.")}</p>}

          {plan.meals.map((meal) => {
            const entry = log.eaten[meal.id];
            const pending = log.pending[meal.id];
            const name = t(meal.label);
            const values = entry?.values ?? meal;
            const confirmedPhoto = entry && "grams" in entry.values ? entry.values : null;
            return (
              <section key={meal.id} className="wp-card wl-diet-meal" aria-label={name}>
                <div className="wl-diet-meal-head">
                  <h2>{name}</h2>
                  {entry && <span className="wp-done"><IonIcon icon={checkmarkCircle} aria-hidden="true" /> {t("Registrada")}</span>}
                </div>
                {meal.id === "dinner" && nutrition.earlierDinner && <p>{t(EFFECT_COPY.dinner)}</p>}
                {confirmedPhoto ? (
                  <p>{t("Registro confirmado")}{confirmedPhoto.grams !== null && <> · {grams(confirmedPhoto.grams)}</>}</p>
                ) : (
                  <ul className="wl-diet-ingredients">
                    {meal.ingredients.map(({ id, grams: portion }) => (
                      <li key={id}><span>{t(FOODS[id][0])}</span><span>{grams(portion)}</span></li>
                    ))}
                  </ul>
                )}
                <p><strong>{energy(values.kcal)}</strong> · {macros(values)}</p>
                <div className="wl-diet-actions">
                  {!entry && (
                    <>
                      <IonButton onClick={() => update(() => logDietMeal(today, meal.id, meal.option, {
                        kcal: meal.kcal, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG,
                      }))}>
                        {t("Lo comí")}
                      </IonButton>
                      {meal.canSwap && (
                        <IonButton fill="outline" onClick={() => update(() => saveDishChoice(today, meal.id, nextDish(plan, meal.id)))}>
                          {t("Cambiar plato")}
                        </IonButton>
                      )}
                    </>
                  )}
                  <IonButton fill="clear" onClick={() => openPhoto(meal.id)}>
                    <IonIcon icon={cameraOutline} slot="start" aria-hidden="true" />
                    {pending ? t("Revisar registro") : t("Foto de comida")}
                  </IonButton>
                </div>
              </section>
            );
          })}
        </div>
      </Scroll>

      <IonModal
        className="wl-diet-modal"
        isOpen={photoOpen}
        aria-label={t("Foto de comida")}
        onDidPresent={() => modalTitle.current?.focus()}
        onWillDismiss={() => { request.current++; }}
        onDidDismiss={() => {
          setPhotoOpen(false);
          setActiveMeal(null);
          setSaveError(false);
        }}
      >
        {activeMeal && activeDish && (
          <div className="wl-diet-dialog">
            <h2 tabIndex={-1} ref={modalTitle}>
              {phase === "review" ? t("Revisar registro") : t("Foto de comida")} · {t(activeDish.label)}
            </h2>
            {phase === "capture" && (
              <CameraCapture
                onCapture={(blob, name) => void capture(activeMeal, blob, name)}
                onManual={() => setPhase("review")}
                onCancel={closePhoto}
              />
            )}
            {phase === "loading" && (
              <p role="status"><IonSpinner aria-hidden="true" /> {t("Analizando la foto…")}</p>
            )}
            {phase === "review" && (
              <>
                {analysisError && <p role="alert">{t("La foto no dio una estimación. Puedes ingresar los datos.")}</p>}
                <p>{t("Revisa y ajusta los valores antes de confirmar. El registro solo se aplica al confirmar.")}</p>
                <p>{t("La porción y la fibra son opcionales.")}</p>
                <div className="wl-diet-fields">
                  {PHOTO_KEYS.map((key) => (
                    <IonInput
                      key={key}
                      label={t(PHOTO_FIELDS[key])}
                      labelPlacement="stacked"
                      fill="outline"
                      inputmode="decimal"
                      required={key !== "grams" && key !== "fiberG"}
                      value={draft[key]}
                      onIonInput={(event) => update(() => savePhotoDraft(today, activeMeal, {
                        ...draft, [key]: event.detail.value ?? "",
                      }))}
                    />
                  ))}
                </div>
                <IonButton disabled={!photo} onClick={() => {
                  if (photo && update(() => logDietMeal(today, activeMeal, activeDish.option, photo))) closePhoto();
                }}>
                  {t("Confirmar registro")}
                </IonButton>
                {log.pending[activeMeal] && (
                  <IonButton fill="clear" onClick={() => {
                    if (update(() => savePhotoDraft(today, activeMeal))) closePhoto();
                  }}>
                    {t("Descartar borrador")}
                  </IonButton>
                )}
              </>
            )}
            {saveError && <p role="alert">{t("No se pudo guardar el registro. Inténtalo de nuevo.")}</p>}
            <IonButton fill="clear" onClick={closePhoto}>{t("Cerrar")}</IonButton>
          </div>
        )}
      </IonModal>
      <VitaEntry
        module="diet"
        summary={{
          day: home.day,
          kcalGoal: Math.round(plan.total.kcal),
          kcalLogged: Math.round(consumed.kcal),
          mealsLogged: eaten.length,
          mealsTotal: plan.meals.length,
          simplified,
          vegetarian: prefs.vegetarian,
        }}
      />
    </Screen>
  );
}


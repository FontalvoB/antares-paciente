import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  arrowBackOutline,
  cameraOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  createOutline,
  imageOutline,
  refreshOutline,
} from "ionicons/icons";
import { CameraCapture } from "./CameraCapture";
import { FoodResultCard } from "./FoodResultCard";
import { MealIntakeForm } from "./MealIntakeForm";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import {
  useNutritionLog,
  useUpdateNutritionLog,
} from "../hooks/useNutritionLog";
import type {
  MealCode,
  NutritionIntakePayload,
} from "../services/program/nutrition-service";
import type { NutritionIntakeLogDto } from "../services/program/types";
import { ApiError } from "../utils/apiClient";
import { formatDateForDisplay } from "../utils/dates";
import {
  analyzeFoodImage,
  getFoodAnalysis,
  getSignedImageUrl,
  type DetectedFood,
  type FoodAnalysisItem,
  type FoodAnalysisResult,
  type MealIntake,
  type NutritionValues,
} from "../utils/foodAiApi";
import {
  EMPTY_INTAKE_FORM,
  type IntakeFormState,
} from "../utils/nutritionForm";

/**
 * Flujo de comida con contexto (UX por comida, mismo diseño):
 * pending → capturing → analyzing → review → registered (+ editing/error).
 *
 * - register: captura → análisis → revisión titulada ("Revisar almuerzo") →
 *   guardar en ESA comida. El contexto nunca se pierde.
 * - detail: ver registrada (valores del snapshot + foto y alimentos del
 *   análisis cuando hay foodAnalysisId) y editar sin duplicar (PUT).
 *
 * Reutiliza CameraCapture, FoodResultCard, MealIntakeForm, clases `.nut-*`
 * e infraestructura TanStack existente. Sin estado global nuevo.
 */

export type MealFlowMode = "register" | "detail";
type Step =
  | "capture"
  | "analyzing"
  | "review"
  | "detail"
  | "edit"
  | "recapture"
  | "reanalyzing"
  | "rereview";

const FLOW_MEAL_LABELS: Record<string, string> = {
  des: "Desayuno",
  alm: "Almuerzo",
  mer: "Merienda",
  cen: "Cena",
};

interface Props {
  meal: Exclude<MealCode, "agua">;
  mode: MealFlowMode;
  autoSource?: "camera" | "gallery";
  /** Paso inicial del detalle (ver o editar directo). */
  startAt?: "detail" | "edit";
  /** Verdad del snapshot para detail/edit (null = pendiente). */
  log?: NutritionIntakeLogDto | null;
  onClose: () => void;
  onManual: (meal: MealCode) => void;
}

function valuesToForm(
  calories?: number | null,
  proteinG?: number | null,
  carbsG?: number | null,
  fatG?: number | null,
  fiberG?: number | null,
): IntakeFormState {
  const s = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  return {
    calories: s(calories),
    proteinG: s(proteinG),
    carbsG: s(carbsG),
    fatG: s(fatG),
    fiberG: s(fiberG),
  };
}

function summaryToForm(s: NutritionValues | null | undefined): IntakeFormState {
  if (!s) return { ...EMPTY_INTAKE_FORM };
  return valuesToForm(s.calories, s.protein, s.carbohydrates, s.fat, s.fiber);
}

function intakeToForm(m: MealIntake | null | undefined): IntakeFormState {
  if (!m) return { ...EMPTY_INTAKE_FORM };
  return valuesToForm(m.calories, m.proteinG, m.carbsG, m.fatG, m.fiberG);
}

function logToForm(
  log: NutritionIntakeLogDto | null | undefined,
): IntakeFormState {
  if (!log) return { ...EMPTY_INTAKE_FORM };
  return valuesToForm(
    log.calories,
    log.proteinG,
    log.carbsG,
    log.fatG,
    log.fiberG,
  );
}

function num(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function formToPayload(
  form: IntakeFormState,
  source: string,
  foodAnalysisId?: string | null,
): NutritionIntakePayload {
  return {
    calories: num(form.calories),
    proteinG: num(form.proteinG),
    carbsG: num(form.carbsG),
    fatG: num(form.fatG),
    fiberG: num(form.fiberG),
    source,
    ...(foodAnalysisId ? { foodAnalysisId } : {}),
  };
}

function analysisItemToDetected(item: FoodAnalysisItem): DetectedFood {
  return {
    name: item.name,
    confidence: item.confidence,
    boundingBox: item.boundingBox,
    segmentation: null,
    portion: item.portion
      ? {
          portionSize: item.portion.portionSize,
          estimatedGrams: item.portion.estimatedGrams,
          minGrams: item.portion.minGrams,
          maxGrams: item.portion.maxGrams,
          confidence: item.portion.confidence,
          method: item.portion.method,
        }
      : null,
    nutrition: item.nutrition,
    nutritionRange: null,
    nutritionStatus: item.nutritionStatus,
    source: item.source,
    sourceVersion: null,
    sourceId: null,
  };
}

/**
 * Resumen nutricional compacto (revisión + detalle): calorías destacadas y
 * macros en cuadrícula 2×2. Valores ausentes como "—" explícito, nunca
 * espacios vacíos. Sin estilos nuevos: clases `.nut-sum-*` del design system.
 */
function NutritionSummary({
  calories,
  protein,
  carbs,
  fat,
  fiber,
  showCalories = true,
}: {
  calories: number | null | undefined;
  protein: number | null | undefined;
  carbs: number | null | undefined;
  fat: number | null | undefined;
  fiber: number | null | undefined;
  showCalories?: boolean;
}) {
  const t = useT();
  const grams = (v: number | null | undefined) =>
    v == null ? "—" : `${Math.round(v * 10) / 10} g`;
  const cells = [
    { label: t("Proteínas"), value: grams(protein) },
    { label: t("Carbohidratos"), value: grams(carbs) },
    { label: t("Grasas"), value: grams(fat) },
    { label: t("Fibra"), value: grams(fiber) },
  ];
  return (
    <section aria-label={t("Resumen nutricional")}>
      <div className="nut-ai-title nut-flow-sec">
        {t("Resumen nutricional")}
      </div>
      {showCalories && (
        <div className="nut-sum-hero">
          <span>{t("Calorías")}</span>
          <strong>
            {calories != null ? `${Math.round(calories)} kcal` : "—"}
          </strong>
        </div>
      )}
      <div className="nut-sum-grid">
        {cells.map((c) => (
          <div key={c.label} className="nut-sum-cell">
            <span>{c.label}</span>
            <strong>{c.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MealFoodFlow({
  meal,
  mode,
  autoSource,
  startAt = "detail",
  log = null,
  onClose,
  onManual,
}: Props) {
  const t = useT();
  const { showToast } = useApp();
  const mealLabel = t(FLOW_MEAL_LABELS[meal]);
  const createMutation = useNutritionLog();
  const updateMutation = useUpdateNutritionLog();

  const [step, setStep] = useState<Step>(() =>
    mode === "detail" && log ? startAt : "capture",
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [captureKey, setCaptureKey] = useState(0);
  const [editingValues, setEditingValues] = useState(false);
  const [detailFoods, setDetailFoods] = useState<DetectedFood[] | null>(null);
  const [detailImg, setDetailImg] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Análisis para el que ya se resolvió el detalle (foto + alimentos). Si el
  // log cambia de foodAnalysisId (p. ej. tras cambiar la foto), se recarga.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [detailError, setDetailError] = useState(false);
  // Re-análisis desde el detalle (cambiar foto): estados separados del flujo
  // de registro para no mezclar contextos. Siempre actualiza (PUT), nunca crea.
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [newResult, setNewResult] = useState<FoodAnalysisResult | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [newCaptureKey, setNewCaptureKey] = useState(0);
  const [editingNewValues, setEditingNewValues] = useState(false);

  // Libera los objectURL al desmontar (sin subidas duplicadas: el blob vive
  // solo en memoria hasta el análisis; el backend guarda su propia copia).
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo);
      if (newPhoto) URL.revokeObjectURL(newPhoto);
    };
  }, [photo, newPhoto]);

  // Detalle: alimentos + foto original del análisis vinculado (si hay).
  // Fail-open honesto: si la carga falla se muestra reintento, nunca un
  // hueco silencioso; la comida registrada siempre se conserva.
  useEffect(() => {
    if (step !== "detail" || !log?.foodAnalysisId) return;
    if (loadedFor === log.foodAnalysisId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(false);
    getFoodAnalysis(log.foodAnalysisId)
      .then(async (detail) => {
        if (cancelled) return;
        setDetailFoods(detail.foods.map(analysisItemToDetected));
        setLoadedFor(log.foodAnalysisId ?? null);
        if (detail.imageKey) {
          try {
            setDetailImg(await getSignedImageUrl(detail.imageKey));
          } catch {
            if (!cancelled) setDetailImg(null);
          }
        } else {
          setDetailImg(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDetailFoods([]);
        setDetailImg(null);
        setDetailError(true);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, log?.foodAnalysisId, loadedFor]);

  function retryDetail() {
    setDetailFoods(null);
    setDetailImg(null);
    setLoadedFor(null);
    setDetailError(false);
  }

  async function handleCapture(blob: Blob, fileName: string) {
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(blob));
    setAnalysisError(null);
    setResult(null);
    setEditingValues(false);
    setStep("analyzing");
    try {
      const data = await analyzeFoodImage(blob, fileName);
      setResult(data);
      if (data.foods.length > 0) {
        setStep("review");
      } else {
        setAnalysisError(
          t("No se identificaron alimentos con suficiente confianza."),
        );
        setStep("capture");
      }
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : t("Ocurrió un error al analizar la imagen."),
      );
      setStep("capture");
    }
  }

  function retake() {
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(null);
    setResult(null);
    setAnalysisError(null);
    setEditingValues(false);
    setCaptureKey((k) => k + 1);
    setStep("capture");
  }

  // Cambiar foto desde el detalle: abre captura y al confirmar re-analiza.
  // La comida registrada se conserva en todo momento hasta guardar.
  function startChangePhoto() {
    if (newPhoto) URL.revokeObjectURL(newPhoto);
    setNewPhoto(null);
    setNewResult(null);
    setNewError(null);
    setEditingNewValues(false);
    setNewCaptureKey((k) => k + 1);
    setStep("recapture");
  }

  function newRetake() {
    if (newPhoto) URL.revokeObjectURL(newPhoto);
    setNewPhoto(null);
    setNewResult(null);
    setNewError(null);
    setEditingNewValues(false);
    setNewCaptureKey((k) => k + 1);
    setStep("recapture");
  }

  async function handleNewCapture(blob: Blob, fileName: string) {
    if (newPhoto) URL.revokeObjectURL(newPhoto);
    setNewPhoto(URL.createObjectURL(blob));
    setNewError(null);
    setNewResult(null);
    setEditingNewValues(false);
    setStep("reanalyzing");
    try {
      const data = await analyzeFoodImage(blob, fileName);
      setNewResult(data);
      if (data.foods.length > 0) {
        setStep("rereview");
      } else {
        setNewError(
          t("No se identificaron alimentos con suficiente confianza."),
        );
        setStep("recapture");
      }
    } catch (err) {
      setNewError(
        err instanceof Error
          ? err.message
          : t("Ocurrió un error al analizar la imagen."),
      );
      setStep("recapture");
    }
  }

  function saveReview(form: IntakeFormState) {
    if (!result) return;
    const summary = result.summary;
    const fallback = result.intake;
    const base =
      form.calories.trim() !== "" ||
      form.proteinG.trim() !== "" ||
      form.carbsG.trim() !== "" ||
      form.fatG.trim() !== "" ||
      form.fiberG.trim() !== ""
        ? form
        : summary
          ? summaryToForm(summary)
          : intakeToForm(fallback);
    createMutation.mutate(
      {
        mealCode: meal,
        intake: formToPayload(base, "ai_photo", result.analysisId),
      },
      {
        onSuccess: () => {
          showToast(t("Comida registrada con foto"), "ok");
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            showToast(t("Esta comida ya estaba registrada"), "warn");
            onClose();
            return;
          }
          showToast(
            error.message || t("No se pudo registrar la comida"),
            "err",
          );
        },
      },
    );
  }

  function saveEdit(form: IntakeFormState) {
    // Se reenvía el foodAnalysisId vigente: el backend reemplaza el campo
    // (omitirlo desvincularía la foto del registro).
    updateMutation.mutate(
      {
        mealCode: meal,
        intake: formToPayload(
          form,
          log?.source ?? "manual",
          log?.foodAnalysisId ?? null,
        ),
      },
      {
        onSuccess: () => {
          showToast(t("Comida actualizada"), "ok");
          onClose();
        },
        onError: (error) => {
          showToast(
            error.message || t("No se pudo actualizar la comida"),
            "err",
          );
        },
      },
    );
  }

  // Guarda el re-análisis sobre la MISMA comida (PUT por comida+día: sin
  // duplicados, sin XP adicional). El nuevo foodAnalysisId relanza la foto.
  function saveReanalysis(form: IntakeFormState) {
    if (!newResult) return;
    const summary = newResult.summary;
    const fallback = newResult.intake;
    const base =
      form.calories.trim() !== "" ||
      form.proteinG.trim() !== "" ||
      form.carbsG.trim() !== "" ||
      form.fatG.trim() !== "" ||
      form.fiberG.trim() !== ""
        ? form
        : summary
          ? summaryToForm(summary)
          : intakeToForm(fallback);
    updateMutation.mutate(
      {
        mealCode: meal,
        intake: formToPayload(base, "ai_photo", newResult.analysisId),
      },
      {
        onSuccess: () => {
          showToast(t("Comida actualizada"), "ok");
          // Invalida el detalle cacheado: al volver, el efecto recarga la
          // nueva foto + alimentos (el snapshot revalidado trae el log).
          setDetailFoods(null);
          setDetailImg(null);
          setLoadedFor(null);
          setDetailError(false);
          if (newPhoto) URL.revokeObjectURL(newPhoto);
          setNewPhoto(null);
          setNewResult(null);
          setEditingNewValues(false);
          setStep("detail");
        },
        onError: (error) => {
          showToast(
            error.message || t("No se pudo actualizar la comida"),
            "err",
          );
        },
      },
    );
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const reviewForm =
    result?.summary != null
      ? summaryToForm(result.summary)
      : intakeToForm(result?.intake);
  const newReviewForm =
    newResult?.summary != null
      ? summaryToForm(newResult.summary)
      : intakeToForm(newResult?.intake);
  const isAnalyzing = step === "analyzing" || step === "reanalyzing";
  // El análisis vinculado aún no se resolvió (primer frame antes del efecto
  // o tras cambiar la foto): se muestra esqueleto, nunca hueco ni salto.
  const awaitingAnalysis =
    log?.foodAnalysisId != null &&
    loadedFor !== log.foodAnalysisId &&
    !detailError;

  // Cabecera única del flujo: la comida como título, el paso como subtítulo.
  // Una sola jerarquía (antes "Registrar X" + "Revisar X" competían).
  const stepSub =
    step === "review" || step === "rereview"
      ? t("Revisa tu comida")
      : step === "capture" ||
          step === "analyzing" ||
          step === "recapture" ||
          step === "reanalyzing"
        ? t("Toma una foto o elige una imagen")
        : step === "edit"
          ? t("Editar comida")
          : log
            ? formatDateForDisplay(log.localDate)
            : "";

  function goBack() {
    if (step === "review") retake();
    else if (step === "rereview") newRetake();
    else if (step === "recapture") setStep("detail");
    else if (step === "edit" && log) setStep("detail");
    else onClose();
  }

  return (
    <div className="nut-ai">
      <div className="nut-flow-head">
        {!isAnalyzing && (
          <IonButton
            fill="clear"
            className="nut-flow-back"
            onClick={goBack}
            aria-label={t("Volver")}
          >
            <IonIcon icon={arrowBackOutline} slot="icon-only" />
          </IonButton>
        )}
        <div className="nut-flow-titles">
          <div className="nut-flow-title">{mealLabel}</div>
          {stepSub !== "" && <div className="nut-flow-sub">{stepSub}</div>}
        </div>
      </div>

      {(step === "capture" ||
        step === "analyzing" ||
        step === "recapture" ||
        step === "reanalyzing") && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          {isAnalyzing && (step === "analyzing" ? photo : newPhoto) ? (
            <div className="nut-ai-photo">
              <img
                src={(step === "analyzing" ? photo : newPhoto) as string}
                alt={t("Fotografía de la comida")}
              />
              <div className="nut-ai-overlay">
                <IonSpinner name="crescent" />
                <div className="nut-ai-title">{t("Analizando tu comida…")}</div>
                {step === "reanalyzing" && (
                  <div className="nut-ai-keep">
                    {t("Tu comida registrada se conserva.")}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {(step === "recapture" ? newError : analysisError) && (
                <div className="nut-cam-error" role="alert">
                  <span>{step === "recapture" ? newError : analysisError}</span>
                </div>
              )}
              {step === "recapture" && (
                <div className="nut-ai-hint">
                  {t("Tu comida registrada se conserva.")}
                </div>
              )}
              <CameraCapture
                key={step === "recapture" ? newCaptureKey : captureKey}
                autoSource={step === "recapture" ? undefined : autoSource}
                onCapture={(blob, fileName) =>
                  void (step === "recapture"
                    ? handleNewCapture(blob, fileName)
                    : handleCapture(blob, fileName))
                }
                onCancel={() =>
                  step === "recapture" ? setStep("detail") : onClose()
                }
              />
              {step === "capture" && (
                <IonButton
                  expand="block"
                  fill="clear"
                  onClick={() => onManual(meal)}
                >
                  {t("Registro manual")}
                </IonButton>
              )}
            </>
          )}
        </motion.div>
      )}

      {step === "review" && result && photo && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <figure className="nut-fig">
            <img
              className="nut-ai-preview"
              src={photo}
              alt={t("Fotografía de la comida")}
            />
          </figure>
          <IonButton expand="block" fill="outline" onClick={retake}>
            <IonIcon icon={imageOutline} slot="start" />
            {t("Cambiar foto")}
          </IonButton>
          <div className="nut-ai-title nut-flow-sec">
            {t("Alimentos detectados")} ({result.foods.length})
          </div>
          {result.foods.map((food, i) => (
            <FoodResultCard key={`${food.name}-${i}`} food={food} />
          ))}
          <NutritionSummary
            calories={
              result.summary?.calories ?? result.intake?.calories ?? null
            }
            protein={result.summary?.protein ?? result.intake?.proteinG ?? null}
            carbs={
              result.summary?.carbohydrates ?? result.intake?.carbsG ?? null
            }
            fat={result.summary?.fat ?? result.intake?.fatG ?? null}
            fiber={result.summary?.fiber ?? result.intake?.fiberG ?? null}
          />
          {editingValues ? (
            <>
              <div className="nut-ai-title nut-flow-sec">
                {t("Editar valores")}
              </div>
              <div className="nut-ai-hint">
                {t("Los cambios aplican a esta comida.")}
              </div>
              <MealIntakeForm
                initial={reviewForm}
                submitLabel={t("Guardar {meal}", { meal: mealLabel })}
                pending={saving}
                onSubmit={saveReview}
              />
            </>
          ) : (
            <>
              <IonButton
                className="bt-teal nut-flow-primary"
                expand="block"
                disabled={saving}
                onClick={() => saveReview(reviewForm)}
              >
                <IonIcon icon={checkmarkOutline} slot="start" />
                {saving
                  ? t("Guardando…")
                  : t("Guardar {meal}", { meal: mealLabel })}
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => setEditingValues(true)}
              >
                <IonIcon icon={createOutline} slot="start" />
                {t("Editar valores")}
              </IonButton>
            </>
          )}
          <IonButton expand="block" fill="clear" onClick={onClose}>
            {t("Cancelar")}
          </IonButton>
        </motion.div>
      )}

      {step === "rereview" && newResult && newPhoto && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="nut-ai-hint">
            {t("Tu comida registrada se conserva.")}
          </div>
          <figure className="nut-fig">
            <img
              className="nut-ai-preview"
              src={newPhoto}
              alt={t("Fotografía de la comida")}
            />
          </figure>
          <IonButton expand="block" fill="outline" onClick={newRetake}>
            <IonIcon icon={imageOutline} slot="start" />
            {t("Cambiar foto")}
          </IonButton>
          <div className="nut-ai-title nut-flow-sec">
            {t("Alimentos detectados")} ({newResult.foods.length})
          </div>
          {newResult.foods.map((food, i) => (
            <FoodResultCard key={`${food.name}-${i}`} food={food} />
          ))}
          <NutritionSummary
            calories={
              newResult.summary?.calories ?? newResult.intake?.calories ?? null
            }
            protein={
              newResult.summary?.protein ?? newResult.intake?.proteinG ?? null
            }
            carbs={
              newResult.summary?.carbohydrates ??
              newResult.intake?.carbsG ??
              null
            }
            fat={newResult.summary?.fat ?? newResult.intake?.fatG ?? null}
            fiber={newResult.summary?.fiber ?? newResult.intake?.fiberG ?? null}
          />
          {editingNewValues ? (
            <>
              <div className="nut-ai-title nut-flow-sec">
                {t("Editar valores")}
              </div>
              <div className="nut-ai-hint">
                {t("Los cambios aplican a esta comida.")}
              </div>
              <MealIntakeForm
                initial={newReviewForm}
                submitLabel={t("Guardar cambios")}
                pending={saving}
                onSubmit={saveReanalysis}
              />
            </>
          ) : (
            <>
              <IonButton
                className="bt-teal nut-flow-primary"
                expand="block"
                disabled={saving}
                onClick={() => saveReanalysis(newReviewForm)}
              >
                <IonIcon icon={checkmarkOutline} slot="start" />
                {saving ? t("Guardando…") : t("Guardar cambios")}
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => setEditingNewValues(true)}
              >
                <IonIcon icon={createOutline} slot="start" />
                {t("Editar valores")}
              </IonButton>
            </>
          )}
          <IonButton
            expand="block"
            fill="clear"
            onClick={() => setStep("detail")}
          >
            {t("Cancelar")}
          </IonButton>
        </motion.div>
      )}

      {step === "detail" && log && (
        <motion.div
          className="nut-ai-result"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* FOTO: original del análisis, vacía o error con reintento.
              La comida registrada siempre se conserva aunque falle la carga. */}
          {(detailLoading || awaitingAnalysis) && (
            <div
              className="nut-img-skel"
              role="status"
              aria-label={t("Fotografía de la comida")}
            >
              <IonSpinner name="crescent" />
            </div>
          )}
          {!detailLoading && !awaitingAnalysis && detailImg && (
            <>
              <figure className="nut-fig">
                <img
                  className="nut-ai-preview"
                  src={detailImg}
                  alt={t("Fotografía de la comida")}
                />
              </figure>
              <IonButton
                expand="block"
                fill="outline"
                onClick={startChangePhoto}
              >
                <IonIcon icon={imageOutline} slot="start" />
                {t("Cambiar foto")}
              </IonButton>
            </>
          )}
          {!detailLoading && !awaitingAnalysis && !detailImg && detailError && (
            <div className="nut-img-error" role="alert">
              <span>{t("No se pudo cargar el análisis")}</span>
              <IonButton size="small" fill="outline" onClick={retryDetail}>
                <IonIcon icon={refreshOutline} slot="start" />
                {t("Reintentar")}
              </IonButton>
            </div>
          )}
          {!detailLoading &&
            !awaitingAnalysis &&
            !detailImg &&
            !detailError && (
              <div className="nut-img-empty">
                <IonIcon icon={imageOutline} aria-hidden="true" />
                <strong>{t("Sin foto registrada")}</strong>
                <IonButton fill="outline" onClick={startChangePhoto}>
                  <IonIcon icon={cameraOutline} slot="start" />
                  {t("Agregar foto")}
                </IonButton>
              </div>
            )}
          <div className="nut-ai-total">
            <span>{t("Consumido")}</span>
            <strong>
              {log.calories != null ? `${Math.round(log.calories)} kcal` : "—"}
            </strong>
          </div>
          <NutritionSummary
            calories={null}
            protein={log.proteinG}
            carbs={log.carbsG}
            fat={log.fatG}
            fiber={log.fiberG}
            showCalories={false}
          />
          {!detailLoading && detailFoods !== null && detailFoods.length > 0 && (
            <>
              <div className="nut-ai-title nut-flow-sec">
                {t("Alimentos detectados")} ({detailFoods.length})
              </div>
              {detailFoods.map((food, i) => (
                <FoodResultCard key={`${food.name}-${i}`} food={food} />
              ))}
            </>
          )}
          <div className="nut-status" role="status">
            <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
            <span>
              {log.source === "ai_photo"
                ? t("Registrado con foto · análisis IA")
                : t("Registrado manualmente")}
              {" · "}
              {formatDateForDisplay(log.localDate)}
            </span>
          </div>
          <IonButton
            className="bt-teal nut-flow-primary"
            expand="block"
            onClick={() => setStep("edit")}
          >
            <IonIcon icon={createOutline} slot="start" />
            {t("Editar comida")}
          </IonButton>
          <IonButton expand="block" fill="clear" onClick={onClose}>
            {t("Cerrar")}
          </IonButton>
        </motion.div>
      )}

      {step === "edit" && log && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="nut-ai-hint">
            {t("Se actualiza el mismo registro, sin duplicados.")}
          </div>
          <div className="nut-reg">
            <MealIntakeForm
              initial={logToForm(log)}
              submitLabel={t("Guardar cambios")}
              pending={saving}
              onSubmit={saveEdit}
            />
            <IonButton
              expand="block"
              fill="clear"
              onClick={() => setStep("detail")}
            >
              {t("Cancelar")}
            </IonButton>
          </div>
        </motion.div>
      )}
    </div>
  );
}

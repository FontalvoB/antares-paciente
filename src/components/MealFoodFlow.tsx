import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  cameraOutline,
  closeOutline,
  createOutline,
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
type Step = "capture" | "analyzing" | "review" | "detail" | "edit";

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

  // Libera el objectURL al desmontar (sin subidas duplicadas: el blob vive
  // solo en memoria hasta el análisis; el backend guarda su propia copia).
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo);
    };
  }, [photo]);

  // Detalle: alimentos + foto original del análisis vinculado (si hay).
  useEffect(() => {
    if (step !== "detail" || !log?.foodAnalysisId || detailFoods) return;
    let cancelled = false;
    setDetailLoading(true);
    getFoodAnalysis(log.foodAnalysisId)
      .then(async (detail) => {
        if (cancelled) return;
        setDetailFoods(detail.foods.map(analysisItemToDetected));
        if (detail.imageKey) {
          try {
            setDetailImg(await getSignedImageUrl(detail.imageKey));
          } catch {
            setDetailImg(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setDetailFoods([]);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, log?.foodAnalysisId]);

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
    updateMutation.mutate(
      { mealCode: meal, intake: formToPayload(form, log?.source ?? "manual") },
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

  const saving = createMutation.isPending || updateMutation.isPending;
  const reviewForm =
    result?.summary != null
      ? summaryToForm(result.summary)
      : intakeToForm(result?.intake);

  return (
    <div className="nut-ai">
      <div className="nut-ai-title">
        {step === "detail" || step === "edit"
          ? `${mealLabel} · ${log ? formatDateForDisplay(log.localDate) : ""}`
          : t("Registrar {meal}", { meal: mealLabel })}
      </div>

      {(step === "capture" || step === "analyzing") && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          {step === "analyzing" && photo ? (
            <div className="nut-ai-photo">
              <img src={photo} alt={t("Fotografía de la comida")} />
              <div className="nut-ai-overlay">
                <IonSpinner name="crescent" />
                <div className="nut-ai-title">{t("Analizando tu comida…")}</div>
              </div>
            </div>
          ) : (
            <>
              {analysisError && (
                <div className="nut-cam-error" role="alert">
                  <span>{analysisError}</span>
                </div>
              )}
              <CameraCapture
                key={captureKey}
                autoSource={autoSource}
                onCapture={(blob, fileName) =>
                  void handleCapture(blob, fileName)
                }
                onCancel={onClose}
              />
              <IonButton
                expand="block"
                fill="clear"
                onClick={() => onManual(meal)}
              >
                {t("Registro manual")}
              </IonButton>
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
          <div className="nut-ai-title">
            {t("Revisar {meal}", { meal: mealLabel })}
          </div>
          <img
            className="nut-ai-preview"
            src={photo}
            alt={t("Fotografía de la comida")}
          />
          <div className="nut-ai-title">
            {t("Alimentos detectados")} ({result.foods.length})
          </div>
          {result.foods.map((food, i) => (
            <FoodResultCard key={`${food.name}-${i}`} food={food} />
          ))}
          {result.summary && (
            <div className="nut-ai-total">
              <span>{t("TOTAL")}</span>
              <strong>{Math.round(result.summary.calories)} kcal</strong>
            </div>
          )}
          {editingValues ? (
            <MealIntakeForm
              initial={reviewForm}
              submitLabel={t("Guardar {meal}", { meal: mealLabel })}
              pending={saving}
              onSubmit={saveReview}
            />
          ) : (
            <>
              <IonButton
                className="bt-teal"
                expand="block"
                disabled={saving}
                onClick={() => saveReview(reviewForm)}
              >
                <IonIcon icon={cameraOutline} slot="start" />
                {saving
                  ? t("Guardando…")
                  : t("Guardar {meal}", { meal: mealLabel })}
              </IonButton>
              <div className="nut-ai-actions">
                <IonButton
                  style={{ flex: 1 }}
                  fill="outline"
                  onClick={() => setEditingValues(true)}
                >
                  <IonIcon icon={createOutline} slot="start" />
                  {t("Editar valores")}
                </IonButton>
                <IonButton style={{ flex: 1 }} fill="clear" onClick={retake}>
                  <IonIcon icon={refreshOutline} slot="start" />
                  {t("Analizar otra comida")}
                </IonButton>
              </div>
            </>
          )}
        </motion.div>
      )}

      {step === "detail" && log && (
        <motion.div
          className="nut-ai-result"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {(detailImg ?? photo) && (
            <img
              className="nut-ai-preview"
              src={(detailImg ?? photo) as string}
              alt={t("Fotografía de la comida")}
            />
          )}
          <div className="nut-ai-total">
            <span>{t("Consumido")}</span>
            <strong>{Math.round(log.calories ?? 0)} kcal</strong>
          </div>
          <div className="nut-ai-hint">
            {[
              log.proteinG != null
                ? `${t("Proteínas")} ${log.proteinG}g`
                : null,
              log.carbsG != null
                ? `${t("Carbohidratos")} ${log.carbsG}g`
                : null,
              log.fatG != null ? `${t("Grasas")} ${log.fatG}g` : null,
              log.fiberG != null ? `${t("Fibra")} ${log.fiberG}g` : null,
            ]
              .filter(Boolean)
              .join(" · ") || t("Sin valores registrados")}
          </div>
          {detailLoading && <IonSpinner name="crescent" />}
          {!detailLoading && detailFoods !== null && detailFoods.length > 0 && (
            <>
              <div className="nut-ai-title">
                {t("Alimentos detectados")} ({detailFoods.length})
              </div>
              {detailFoods.map((food, i) => (
                <FoodResultCard key={`${food.name}-${i}`} food={food} />
              ))}
            </>
          )}
          <div className="nut-ai-hint">
            {log.source === "ai_photo"
              ? t("✓ Registrado con foto · análisis IA")
              : t("✓ Registrado manualmente")}
            {" · "}
            {formatDateForDisplay(log.localDate)}
          </div>
          <IonButton expand="block" onClick={() => setStep("edit")}>
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
          <div className="nut-ai-title">
            {t("Editar comida")} · {mealLabel}
          </div>
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
            <IonButton expand="block" fill="clear" onClick={onClose}>
              {t("Cancelar")}
            </IonButton>
          </div>
        </motion.div>
      )}

      {step !== "detail" && step !== "edit" && (
        <IonButton
          expand="block"
          fill="clear"
          onClick={onClose}
          aria-label={t("Cancelar")}
        >
          <IonIcon icon={closeOutline} />
        </IonButton>
      )}
    </div>
  );
}

import { useState } from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from "@ionic/react";
import { useT } from "../../i18n/I18nContext";
import { useApp } from "../../context/AppContext";
import { formatDateForDisplay } from "../../utils/dates";
import { WeightRecordModal } from "./WeightRecordModal";
import type { WeightRecord } from "./avatar-body-state";

export type WeightHistoryStatus =
  "session-required" | "loading" | "ready" | "empty" | "unavailable" | "error";

export interface WeightHistoryError {
  status?: number;
  code?: string;
  message?: string;
  correlationId?: string;
  unit?: string;
}

export interface WeightEvolutionSectionProps {
  /** Registros cronológicos de peso (useAvatarProgress). */
  records: WeightRecord[];
  status: WeightHistoryStatus;
  error?: WeightHistoryError;
  /** Solo Admin ve el botón de registrar peso; pacientes solo leen. */
  canRecordWeight: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onRefresh: () => void;
  onSaved: () => void;
  /** True en la vista evolución; false en resumen/apariencia. */
  showEvolution: boolean;
  onSeeEvolution?: () => void;
}

/** Evolución cronológica del peso con selector de registros y registro Admin-only. */
export function WeightEvolutionSection({
  records,
  status,
  error,
  canRecordWeight,
  selectedDate,
  onSelectDate,
  onRefresh,
  onSaved,
  showEvolution,
  onSeeEvolution,
}: WeightEvolutionSectionProps) {
  const t = useT();
  const { navigate } = useApp();
  const [recordOpen, setRecordOpen] = useState(false);
  const reference = records[0];
  const latest = records.at(-1);
  const selected = records.find((r) => r.date === selectedDate) ?? latest;
  const loading = status === "loading";

  return (
    <>
      <IonCard>
        <IonCardContent>
          <h2>{t("Tu cuerpo y tu progreso")}</h2>
          <p>
            {t(
              "El estado corporal se calcula a partir de tu historial clínico. La personalización no cambia tus mediciones.",
            )}
          </p>
          {!showEvolution && latest && status === "ready" && (
            <p>
              {t("Último registro disponible")}:{" "}
              {formatDateForDisplay(latest.date)} · {latest.value} kg
            </p>
          )}
          {status === "loading" && (
            <div role="status">
              <IonSpinner />
              {t("Consultando tu historial de peso…")}
            </div>
          )}
          {status === "session-required" && (
            <p role="status">
              {t(
                "Inicia sesión con una cuenta real para consultar tu progreso. El acceso demo no contiene mediciones reales.",
              )}
            </p>
          )}
          {status === "empty" && (
            <>
              <p role="status">
                {t(
                  "No hay registros de peso suficientes para mostrar tu evolución.",
                )}
              </p>
              <IonButton
                style={{ minHeight: 44 }}
                onClick={() => navigate("hc")}
              >
                {t("Completar historia clínica")}
              </IonButton>
            </>
          )}
          {status === "unavailable" && (
            <p role="status">
              {t(
                "El historial no está disponible: se requiere perfil de paciente e inscripción activa en el programa.",
              )}
            </p>
          )}
          {status === "error" && (
            <div role="alert">
              <p>{t("Error al cargar historial.")}</p>
              {error?.code === "UNSUPPORTED_WEIGHT_UNIT" && (
                <p>
                  {t(
                    "La API devolvió registros con una unidad de peso no compatible: {unit}.",
                    { unit: error.unit ?? "—" },
                  )}
                </p>
              )}
              {error?.code === "INVALID_HISTORY_RESPONSE" && (
                <p>
                  {t(
                    "La respuesta del historial no tiene el formato esperado.",
                  )}
                </p>
              )}
              {error?.code === "INVALID_WEIGHT_RECORDS" && (
                <p>
                  {t(
                    "La API devolvió registros, pero sus fechas o valores de peso no son válidos.",
                  )}
                </p>
              )}
            </div>
          )}
          {showEvolution && status !== "session-required" && (
            <>
              <IonButton
                style={{ minHeight: 44 }}
                fill="outline"
                disabled={loading}
                onClick={onRefresh}
              >
                {t("Actualizar historial")}
              </IonButton>
              {canRecordWeight && (
                <IonButton
                  style={{ minHeight: 44 }}
                  fill="outline"
                  disabled={loading}
                  onClick={() => setRecordOpen(true)}
                >
                  {t("Registrar peso")}
                </IonButton>
              )}
            </>
          )}
          {status === "error" && (
            <IonButton
              style={{ minHeight: 44 }}
              fill="clear"
              onClick={onRefresh}
            >
              {t("Reintentar")}
            </IonButton>
          )}
          {!showEvolution && onSeeEvolution && (
            <IonButton
              style={{ minHeight: 44 }}
              fill="clear"
              onClick={onSeeEvolution}
            >
              {t("Ver mi evolución")}
            </IonButton>
          )}
        </IonCardContent>
      </IonCard>
      {showEvolution &&
        status === "ready" &&
        reference &&
        selected &&
        latest && (
          <IonCard>
            <IonCardContent>
              <h2>{t("Evolución del peso registrado")}</h2>
              <p>
                {t(
                  "Vista relativa a tu primer registro válido de los últimos 365 días. No es una simulación médica ni reproduce tu anatomía.",
                )}
              </p>
              <p>
                {t("Registros válidos")}: {records.length}
              </p>
              <p>
                {t("Referencia del período")}:{" "}
                {formatDateForDisplay(reference.date)} · {reference.value} kg
              </p>
              <p>
                {t("Último registro disponible")}:{" "}
                {formatDateForDisplay(latest.date)} · {latest.value} kg
              </p>
              <IonButton
                style={{ minHeight: 44 }}
                fill="outline"
                onClick={() => onSelectDate(reference.date)}
              >
                {t("Ver inicial del período")}
              </IonButton>
              <IonButton
                style={{ minHeight: 44 }}
                fill="outline"
                onClick={() => onSelectDate(null)}
              >
                {t("Ver último registro")}
              </IonButton>
              <IonSelect
                label={t("Registro mostrado")}
                labelPlacement="stacked"
                interface="popover"
                value={selected.date}
                onIonChange={(e) => onSelectDate(String(e.detail.value))}
              >
                {records.map((r) => (
                  <IonSelectOption key={r.date} value={r.date}>
                    {formatDateForDisplay(r.date)} · {r.value} kg
                  </IonSelectOption>
                ))}
              </IonSelect>
              <p aria-live="polite">
                {t("Cambio respecto a la referencia")}:{" "}
                {(selected.value - reference.value).toFixed(2)} kg{" "}
                {((selected.value / reference.value - 1) * 100).toFixed(2)} %
              </p>
              {records.length === 1 && (
                <p>
                  {t(
                    "Solo hay un registro: se muestra la referencia neutral hasta disponer de otra medición.",
                  )}
                </p>
              )}
              <p>
                {t(
                  "La transición entre registros es visual; no crea mediciones intermedias. El peso no determina cambios regionales ni musculatura.",
                )}
              </p>
            </IonCardContent>
          </IonCard>
        )}
      {canRecordWeight && recordOpen && (
        <WeightRecordModal
          onClose={() => setRecordOpen(false)}
          onSaved={() => {
            setRecordOpen(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}

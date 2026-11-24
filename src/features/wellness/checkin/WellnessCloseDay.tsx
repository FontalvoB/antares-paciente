import { IonButton, IonCheckbox, IonInput, IonRadio, IonRadioGroup } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { parseNumberInput, RANGES } from "../domain/draft";
import { loadPlanSnapshot, localISODate, parseLocalDate, planDay } from "../state/wellness-home-store";
import { checkinHistory, checkinOwner, loadCheckins, saveCheckin, subscribeCheckins, syncCheckins } from "./checkin-store";
import { dailyEffects, shiftLocalDate, SYMPTOMS } from "./close-day";
import type { DailyCheckin } from "./close-day";
import "../protocol/wellness-protocol.css";
import "./wellness-close-day.css";

const FIELDS = [
  { name: "adherence", label: "Adherencia (%)", min: 0, max: 100, step: "any", optional: false },
  { name: "sleepHours", label: "Horas de sueño", min: 0, max: 24, step: "any", optional: false },
  { name: "energy", label: "Energía (1–5)", min: 1, max: 5, step: "1", optional: false },
  { name: "pain", label: "Dolor (0–10)", min: 0, max: 10, step: "1", optional: false },
  { name: "weightKg", label: "Peso (kg, opcional)", ...RANGES.weightKg, step: "any", optional: true },
  { name: "waistCm", label: "Cintura (cm, opcional)", ...RANGES.waistCm, step: "any", optional: true },
] as const;

type Field = (typeof FIELDS)[number]["name"];
const SYMPTOM_IDS = Object.keys(SYMPTOMS) as DailyCheckin["symptoms"];

export function WellnessCloseDay() {
  const { user, navigate } = useApp();
  const { t, lang } = useI18n();
  const owner = checkinOwner(user);
  const [date] = useState(() => localISODate(new Date()));
  const [record, setRecord] = useState(() => loadCheckins(owner)[date]);
  const [values, setValues] = useState<Partial<Record<Field, string>>>({});
  const [symptoms, setSymptoms] = useState<DailyCheckin["symptoms"]>([]);
  const [exercise, setExercise] = useState<"yes" | "no">();
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const issue = useRef<HTMLParagraphElement>(null);
  const saved = Boolean(record);
  const attempted = failedAttempts > 0;

  useEffect(() => {
    const refresh = () => setRecord(loadCheckins(owner)[date]);
    const unsubscribe = subscribeCheckins(owner, refresh);
    refresh();
    return unsubscribe;
  }, [owner, date]);

  useEffect(() => {
    if (saved) title.current?.focus();
  }, [saved]);

  useEffect(() => {
    if (failedAttempts || saveError) issue.current?.focus();
  }, [failedAttempts, saveError]);

  const parsed = FIELDS.map((field) => parseNumberInput(values[field.name]?.trim()));
  const invalid = FIELDS.map((field, index) => {
    if (field.optional && !values[field.name]?.trim()) return false;
    const value = parsed[index];
    return value === null || value < field.min || value > field.max ||
      (field.step === "1" && !Number.isInteger(value));
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || record) return;
    setSaveError(undefined);
    const [adherence, sleepHours, energy, pain, weightKg, waistCm] = parsed;
    if (invalid.some(Boolean) || !exercise ||
      adherence === null || sleepHours === null || energy === null || pain === null) {
      setFailedAttempts((count) => count + 1);
      return;
    }
    setSaving(true);
    try {
      await saveCheckin(owner, date, {
        adherence, sleepHours, energy, pain, symptoms, weightKg, waistCm,
        exercised: exercise === "yes",
      });
      setRecord(loadCheckins(owner)[date]);
      void syncCheckins(owner);
    } catch (error) {
      setSaveError(error instanceof RangeError
        ? "Revisa la fecha del dispositivo. No puedes cerrar un día futuro."
        : "No se pudo guardar el cierre. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const tomorrow = shiftLocalDate(date, 1);
  const startDate = loadPlanSnapshot()?.startDate ?? date;
  const effects = record
    ? dailyEffects(tomorrow, checkinHistory(owner), planDay(startDate, parseLocalDate(tomorrow) ?? undefined))
    : null;
  const formattedDate = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-CO", { dateStyle: "long" })
    .format(parseLocalDate(date) ?? new Date());
  const invalidForm = attempted && (invalid.some(Boolean) || !exercise);

  return (
    <Screen>
      <Scroll className="wp-scroll wc-scroll">
        <header className="wp-hero">
          <h1 className="wp-title" ref={title} tabIndex={-1}>
            {record ? t("Día cerrado") : t("Cerrar el día")}
          </h1>
          <p className="wp-eyebrow"><time dateTime={date}>{formattedDate}</time></p>
        </header>
        {record && effects ? (
          <section className="wp-card wc-card">
            <p className="wc-status" role="status">
              {record.status === "synced"
                ? t("Cierre sincronizado.")
                : t("Guardado en este dispositivo. Se sincronizará al volver la conexión.")}
            </p>
            <h2>{t("Tu plan para mañana")}</h2>
            {effects.messages.length ? (
              <ul className="wc-effects">
                {effects.messages.map((message) => <li key={message}>{t(message)}</li>)}
              </ul>
            ) : (
              <p>{t("Tu plan de mañana sigue igual.")}</p>
            )}
            <IonButton expand="block" onClick={() => navigate("home")}>{t("Volver al inicio")}</IonButton>
          </section>
        ) : (
          <form className="wp-card wc-card" noValidate onSubmit={submit}>
            <p>{t("Completa adherencia, sueño, energía, dolor y ejercicio.")}</p>
            {FIELDS.map((field, index) => (
              <IonInput
                key={field.name}
                name={field.name}
                type="number"
                inputmode={field.step === "1" ? "numeric" : "decimal"}
                label={t(field.label)}
                labelPlacement="stacked"
                fill="outline"
                min={String(field.min)}
                max={String(field.max)}
                step={field.step}
                required={!field.optional}
                value={values[field.name] ?? ""}
                className={attempted && invalid[index] ? "ion-invalid ion-touched" : undefined}
                errorText={t(field.step === "1"
                  ? "Ingresa un número entero entre {min} y {max}."
                  : "Ingresa un valor entre {min} y {max}.", {
                  min: String(field.min), max: String(field.max),
                })}
                onIonInput={(event) => setValues((current) => ({
                  ...current, [field.name]: event.detail.value ?? "",
                }))}
              />
            ))}
            <fieldset>
              <legend>{t("¿Cómo te sentiste? Marca lo que aplique.")}</legend>
              <div className="wc-options">
                {SYMPTOM_IDS.map((id) => (
                  <IonCheckbox key={id} checked={symptoms.includes(id)} onIonChange={(event) =>
                    setSymptoms((current) => event.detail.checked
                      ? [...current, id]
                      : current.filter((symptom) => symptom !== id))}
                  >
                    {t(SYMPTOMS[id])}
                  </IonCheckbox>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend id="wc-exercise-label">{t("¿Hiciste ejercicio hoy?")}</legend>
              <IonRadioGroup className="wc-options" aria-labelledby="wc-exercise-label"
                aria-required="true" aria-invalid={attempted && !exercise}
                aria-describedby={attempted && !exercise ? "wc-error" : undefined}
                value={exercise}
                onIonChange={(event) => setExercise(event.detail.value)}
              >
                <IonRadio value="yes">{t("Sí")}</IonRadio>
                <IonRadio value="no">{t("No")}</IonRadio>
              </IonRadioGroup>
            </fieldset>
            {(saveError || invalidForm) && (
              <p ref={issue} id="wc-error" tabIndex={-1} role="alert" className="wc-error">
                {t(saveError ?? "Revisa los valores e indica si hiciste ejercicio.")}
              </p>
            )}
            <IonButton type="submit" expand="block" disabled={saving}>
              {saving ? t("Guardando…") : t("Cerrar el día")}
            </IonButton>
            <IonButton fill="clear" expand="block" onClick={() => navigate("home")}>
              {t("Volver al inicio")}
            </IonButton>
          </form>
        )}
      </Scroll>
    </Screen>
  );
}

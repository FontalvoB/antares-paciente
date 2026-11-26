import { IonButton, IonCheckbox, IonInput, IonLabel, IonListHeader, IonRadio, IonRadioGroup } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { formatLocalizedDate } from "../../../utils/dates";
import { formatWellnessMeasurement, loadUnitPrefs, parseWellnessMeasurement } from "../vitals/unit-prefs";
import type { UnitPrefs } from "../vitals/unit-prefs";
import { parseNumberInput, RANGES } from "../domain/draft";
import { loadPlanSnapshot, localISODate, parseLocalDate, planDay } from "../state/wellness-home-store";
import { checkinHistory, checkinKey, checkinOwner, loadCheckins, motorCheckinOwner, saveCheckin, subscribeCheckins, syncMotorCheckins } from "./checkin-store";
import { motorPlanUserId } from "../calendar/motor-plan-api";
import { useMotorDay } from "../calendar/useMotorDay";
import { dailyEffects, shiftLocalDate, SYMPTOMS } from "./close-day";
import type { DailyCheckin } from "./close-day";
import "../protocol/wellness-protocol.css";
import "./wellness-close-day.css";
import { VitaEntry } from "../vita";

const FIELDS = [
  { name: "adherence", label: "Adherencia (%)", min: 0, max: 100, step: "any", optional: false },
  { name: "sleepHours", label: "Horas de sueño", min: 0, max: 24, step: "any", optional: false },
  { name: "energy", label: "Energía (1–5)", min: 1, max: 5, step: "1", optional: false },
  { name: "pain", label: "Dolor (0–10)", min: 0, max: 10, step: "1", optional: false },
  { name: "weightKg", label: "Peso (kg, opcional)", usLabel: "Peso (lb, opcional)", unit: "kilogram", ...RANGES.weightKg, step: "any", optional: true },
  { name: "waistCm", label: "Cintura (cm, opcional)", usLabel: "Cintura (in, opcional)", unit: "centimeter", ...RANGES.waistCm, step: "any", optional: true },
] as const;

type Field = (typeof FIELDS)[number]["name"];
const SYMPTOM_IDS = Object.keys(SYMPTOMS) as DailyCheckin["symptoms"];

export function WellnessCloseDay() {
  const { user, navigate } = useApp();
  const { t, lang } = useI18n();
  const owner = checkinOwner(user);
  const prefs = loadUnitPrefs(owner, lang);
  const [legacyDate] = useState(() => localISODate(new Date()));
  const motor = useMotorDay();
  const remote = motor.kind === "ready" ? motor.day : undefined;
  const account = motorPlanUserId();
  const personId = remote?.personId;
  const scope = account && personId ? motorCheckinOwner(account, personId)
    : motor.kind === "legacy" ? owner : undefined;
  const date = remote?.todayLocalDate ?? legacyDate;
  const key = checkinKey(date, remote?.today);
  const [records, setRecords] = useState(() => ({ scope, values: scope ? loadCheckins(scope) : {} }));
  const record = scope && records.scope === scope ? records.values[key] : undefined;
  const serverRecorded = remote?.logStatus === "recorded";
  const canSubmit = Boolean(scope);
  const [values, setValues] = useState<Partial<Record<Field, { raw: string; prefs: UnitPrefs }>>>({});
  const [symptoms, setSymptoms] = useState<DailyCheckin["symptoms"]>([]);
  const [exercise, setExercise] = useState<"yes" | "no">();
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const issue = useRef<HTMLParagraphElement>(null);
  const saved = Boolean(record) || serverRecorded;
  const attempted = failedAttempts > 0;

  useEffect(() => {
    if (!scope) return;
    const refresh = () => setRecords({ scope, values: loadCheckins(scope) });
    const unsubscribe = subscribeCheckins(scope, refresh);
    refresh();
    return unsubscribe;
  }, [scope]);

  useEffect(() => {
    if (saved) title.current?.focus();
  }, [saved]);

  useEffect(() => {
    if (failedAttempts || saveError) issue.current?.focus();
  }, [failedAttempts, saveError]);

  const parsed = FIELDS.map((field) => {
    const entry = values[field.name];
    const raw = entry?.raw.trim();
    if (!entry || !raw || !/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(raw)) return null;
    const value = parseNumberInput(raw);
    return value !== null && "unit" in field ? parseWellnessMeasurement(value, field.unit, entry.prefs) : value;
  });
  const invalid = FIELDS.map((field, index) => {
    if (field.optional && !values[field.name]?.raw.trim()) return false;
    const value = parsed[index];
    return value === null || value < field.min || value > field.max ||
      (field.step === "1" && !Number.isInteger(value));
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || saved || !scope || (account && motorPlanUserId() !== account)) return;
    setSaveError(undefined);
    const [adherence, sleepHours, energy, pain, weightKg, waistCm] = parsed;
    if (invalid.some(Boolean) || !exercise ||
      adherence === null || sleepHours === null || energy === null || pain === null) {
      setFailedAttempts((count) => count + 1);
      return;
    }
    setSaving(true);
    try {
      await saveCheckin(scope, date, {
        adherence, sleepHours, energy, pain, symptoms, weightKg, waistCm,
        exercised: exercise === "yes",
      }, new Date(), remote?.today, personId);
      setRecords({ scope, values: loadCheckins(scope) });
      if (account) void syncMotorCheckins(account);
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
  const effects = record && motor.kind === "legacy"
    ? dailyEffects(tomorrow, checkinHistory(owner), planDay(startDate, parseLocalDate(tomorrow) ?? undefined))
    : null;
  const formattedDate = formatLocalizedDate(date, lang);
  const invalidForm = attempted && (invalid.some(Boolean) || !exercise);

  return (
    <Screen>
      <Scroll className="wp-scroll wc-scroll">
        <header className="wp-hero">
          <h1 className="wp-title" ref={title} tabIndex={-1}>
            {saved ? t("Día cerrado") : t("Cerrar el día")}
          </h1>
          {canSubmit && <p className="wp-eyebrow"><time dateTime={date}>{formattedDate}</time></p>}
        </header>
        {!canSubmit ? <p role="status">{t(motor.kind === "locked" ? "Plan bloqueado" :
          motor.kind === "loading" ? "Consultando el plan…" :
          motor.kind === "unlinked" ? "Tu cuenta no tiene un plan vinculado." : "Día del plan no disponible")}</p> : saved ? (
          <section className="wp-card wc-card">
            <p className="wc-status" role="status">
              {record?.status === "conflict" ? t("Se conservó el cierre que ya estaba registrado en el servidor.") :
                (record?.serverDay !== undefined && record.status === "synced") || serverRecorded
                ? t("Cierre sincronizado.")
                : record?.serverDay === undefined
                  ? t("Cierre guardado en este dispositivo.")
                  : t("Guardado en este dispositivo. Se sincronizará al volver la conexión.")}
            </p>
            {effects && <><h2>{t("Tu plan para mañana")}</h2>
            {effects.messages.length ? (
              <ul className="wc-effects">
                {effects.messages.map((message) => <li key={message}>{t(message)}</li>)}
              </ul>
            ) : (
              <p>{t("Tu plan de mañana sigue igual.")}</p>
            )}</>}
            <IonButton expand="block" onClick={() => navigate("home")}>{t("Volver al inicio")}</IonButton>
          </section>
        ) : (
          <form className="wp-card wc-card" aria-labelledby="wc-form-title" noValidate onSubmit={submit}>
            <h2 id="wc-form-title">{t("Registro de hoy")}</h2>
            <p>{t("Completa adherencia, sueño, energía, dolor y ejercicio.")}</p>
            {FIELDS.map((field, index) => {
              const entry = values[field.name];
              const metric = parsed[index];
              const unit = "unit" in field ? field.unit : null;
              const value = entry && unit && entry.prefs.weight !== prefs.weight && metric !== null
                ? formatWellnessMeasurement(metric, unit, lang, prefs, { withUnit: false })
                : entry?.raw ?? "";
              const min = unit ? formatWellnessMeasurement(field.min, unit, lang, prefs, { rounding: "ceil" }) : String(field.min);
              const max = unit ? formatWellnessMeasurement(field.max, unit, lang, prefs, { rounding: "floor" }) : String(field.max);
              return (
                <IonInput
                  key={field.name}
                  name={field.name}
                  type={unit ? "text" : "number"}
                  inputmode={field.step === "1" ? "numeric" : "decimal"}
                  label={t(prefs.weight === "lb" && "usLabel" in field ? field.usLabel : field.label)}
                  labelPlacement="stacked"
                  fill="outline"
                  min={unit ? undefined : String(field.min)}
                  max={unit ? undefined : String(field.max)}
                  step={unit ? undefined : field.step}
                  required={!field.optional}
                  value={value}
                  className={attempted && invalid[index] ? "ion-invalid ion-touched" : undefined}
                  errorText={t(field.step === "1"
                    ? "Ingresa un número entero entre {min} y {max}."
                    : "Ingresa un valor entre {min} y {max}.", {
                    min, max,
                  })}
                  onIonInput={(event) => setValues((current) => ({
                    ...current, [field.name]: { raw: event.detail.value ?? "", prefs },
                  }))}
                />
              );
            })}
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
            <IonRadioGroup className={attempted && !exercise ? "ion-invalid ion-touched" : undefined}
              aria-required="true"
              errorText={t("Indica si hiciste ejercicio.")}
              value={exercise}
              onIonChange={(event) => setExercise(event.detail.value)}
            >
              <IonListHeader className="wc-radio-label">
                <IonLabel>{t("¿Hiciste ejercicio hoy?")}</IonLabel>
              </IonListHeader>
              <div className="wc-options">
                <IonRadio value="yes">{t("Sí")}</IonRadio>
                <IonRadio value="no">{t("No")}</IonRadio>
              </div>
            </IonRadioGroup>
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
      <VitaEntry module="close-day" summary={{ closedToday: saved }} />
    </Screen>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PodcastChapterDto,
  RecentVitalsDto,
  VitalsPayload,
} from "../../services/program/types";
import {
  IonButton,
  IonIcon,
  IonInput,
  IonChip,
  IonRange,
  IonSpinner,
} from "@ionic/react";
import {
  batteryHalfOutline,
  bluetooth,
  heart,
  footstepsOutline,
  moonOutline,
  pause,
  play,
  playBack,
  playForward,
  pulseOutline,
  scaleOutline,
  thermometerOutline,
  waterOutline,
} from "ionicons/icons";
import {
  VITAL_FIELDS,
} from "../../data/program";
import { MISSION_PHOTOS } from "../../data/missionPhotos";
import { WatchIcon3D } from "../../components/icons3d";
import { PageHeader } from "../../components/PageHeader";
import logoIcon from "../../assets/LogoIndividual.png";
import type { MetricKind } from "../../devices/types";
import { useWearable } from "../../context/WearableContext";
import {
  hoursFromMinutes,
  minutesFromHours,
  vitalNumber,
  vitalStatus,
} from "../../utils/vitals";
import { agoLabel, formatSleep } from "../../utils/wearable";
import {
  formatDateForDisplay,
  toLocalISODate,
} from "../../utils/dates";
import { useI18n, useT } from "../../i18n/I18nContext";

function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Estado honesto para lecciones SIN contenido del servidor (content == null,
 * contentUnavailable o arrays vacíos): nunca fabricar episodios, circuitos o
 * planes. Misma lección para podcast / nutrición / ejercicio.
 */
function LessonUnavailable() {
  const t = useT();
  return (
    <div className="lsn-stack">
      <div className="lsn-unavailable">
        <p>{t("Contenido no disponible aún · tu equipo lo está preparando")}</p>
      </div>
    </div>
  );
}

export function PodcastLesson({
  done,
  pts,
  title,
  author,
  description,
  durationSecs,
  mediaUrl,
  coverUrl,
  audioError,
  chapters,
  takeaways,
  playing,
  progress,
  onToggle,
  onSkip,
  onComplete,
  unavailable,
  audioReady,
}: {
  done: boolean;
  pts: number;
  title?: string | null;
  author?: string | null;
  description?: string | null;
  durationSecs?: number | null;
  mediaUrl?: string | null;
  coverUrl?: string | null;
  audioError?: string | null;
  chapters?: PodcastChapterDto[] | null;
  takeaways?: string[] | null;
  playing: boolean;
  progress: number;
  onToggle: () => void;
  onSkip: (delta: number) => void;
  onComplete: () => void;
  unavailable?: boolean;
  /** W1: el Audio del servidor ya existe (primer play hecho) → seek real. */
  audioReady?: boolean;
}) {
  const t = useT();
  // Player real SOLO con audio del servidor: sin content (o contentUnavailable)
  // o sin mediaUrl no hay nada que reproducir — estado honesto, no fabricación.
  if (unavailable || !mediaUrl) return <LessonUnavailable />;

  // W1: antes del primer play no hay Audio que buscar — skip y capítulos se
  // deshabilitan (sin no-op silencioso); el play es la puerta de entrada.
  const seekDisabled = done || !audioReady;

  // Portada: la del servidor si existe; si falla o no hay, la foto de la
  // misión empaquetada — la lección nunca queda sin imagen.
  const coverSrc = coverUrl || MISSION_PHOTOS.podcast;

  const duration = durationSecs || 0;
  const podTitle = title || "";
  const podHost = author || "";
  const podBlurb = description || "";
  const podChapters =
    chapters && chapters.length > 0
      ? chapters
          .filter((c) => Number.isFinite(c.atSeconds) && c.atSeconds >= 0 && typeof c.label === "string" && c.label.trim().length > 0)
          .map((c) => ({ at: c.atSeconds, label: c.label }))
          .sort((a, b) => a.at - b.at)
      : [];
  const podTakeaways = takeaways && takeaways.length > 0 ? takeaways : [];

  const elapsed = progress * duration;
  const chapter =
    podChapters.length > 0
      ? ([...podChapters].reverse().find((c) => elapsed >= c.at) ??
        podChapters[0])
      : null;

  return (
    <div className="lsn-stack podcast-player">
      <div className="pod-editorial"><span>{t("UN MOMENTO PARA TI")}</span><IonChip>{t("Podcast del día")}</IonChip></div>
      <div className="pod-cover">
        <img
          src={coverSrc}
          alt=""
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallback) return;
            img.dataset.fallback = "1";
            img.src = MISSION_PHOTOS.podcast;
          }}
        />
      </div>
      <div className="pod-stage">
        <div className="pod-now">{chapter ? t(chapter.label) : ""}</div>
        <div className="pod-times">
          <span>{mmss(elapsed)}</span>
          <span>{mmss(duration)}</span>
        </div>
        <IonRange min={0} max={1000} value={Math.round(progress * 1000)} disabled={seekDisabled}
          aria-label={t("Posición del audio")} onIonChange={e => onSkip((Number(e.detail.value) / 1000 - progress) * duration)} />
      </div>

      <div className="pod-copy">
        <strong>{t(podTitle)}</strong>
        <span>{podHost}</span>
        {duration > 0 && <small>{mmss(duration)} · {t("Escucha a tu ritmo")}</small>}
        {mediaUrl && (
          <span className="pod-stream-badge text-[10px] opacity-75">
            ● {t("Audio en streaming")}
          </span>
        )}
      </div>

      {audioError && (
        <div className="pod-error text-xs text-red-500 text-center py-1">
          {t(audioError)}
        </div>
      )}

      <div className="pod-transport">
        <IonButton
          fill="clear"
          aria-label={t("Retroceder 15 segundos")}
          onClick={() => onSkip(-15)}
          disabled={seekDisabled}
        >
          <IonIcon slot="icon-only" icon={playBack} />
        </IonButton>
        <IonButton
          className="bt bt-pur pod-play"
          onClick={onToggle}
          disabled={done}
        >
          <IonIcon icon={playing ? pause : play} slot="start" />
          {playing
            ? t("Pausar")
            : progress >= 1
              ? t("Repetir")
              : t("Reproducir")}
        </IonButton>
        <IonButton
          fill="clear"
          aria-label={t("Adelantar 15 segundos")}
          onClick={() => onSkip(15)}
          disabled={seekDisabled}
        >
          <IonIcon slot="icon-only" icon={playForward} />
        </IonButton>
      </div>

      {podBlurb && <section className="pod-about"><h3>{t("Sobre este episodio")}</h3><p>{t(podBlurb)}</p></section>}
      {podChapters.length > 0 && (
        <section className="pod-chapters"><h3>{t("Capítulos")}</h3>
          {podChapters.map((c, i) => (
            <IonButton key={`${c.at}-${i}`} fill="clear" className={`pod-chapter ${chapter === c ? "on" : ""}`}
              onClick={() => onSkip(c.at - elapsed)} disabled={seekDisabled}>
              <span className="pod-chapter-number">{String(i + 1).padStart(2, '0')}</span>
              <span>{t(c.label)}</span><time>{mmss(c.at)}</time>
            </IonButton>
          ))}
        </section>
      )}
      {podTakeaways.length > 0 && <section className="pod-about"><h3>{t("Ideas para llevar contigo")}</h3>
        <ul>{podTakeaways.map(tip => <li key={tip}>{t(tip)}</li>)}</ul>
      </section>}

      {!done && (
        <IonButton
          expand="block"
          className="bt bt-primary"
          disabled={progress < 0.7}
          onClick={onComplete}
        >
          {progress < 0.7
            ? t("Escucha el 70% · vas {pct}%", {
                pct: String(Math.round(progress * 100)),
              })
            : t("Marcar escuchado · +{pts} pts", { pts: String(pts) })}
        </IonButton>
      )}
    </div>
  );
}

export function VitalsLesson({
  done,
  pts,
  recentVitals,
  wearableConnected,
  onOpenWearable,
  onComplete,
}: {
  done: boolean;
  pts: number;
  recentVitals?: RecentVitalsDto | null;
  wearableConnected: boolean;
  /** Abre la vista del wearable (Reloj) para conectar/revisar desde ahí. */
  onOpenWearable: () => void;
  onComplete: (vitals: VitalsPayload) => void;
}) {
  const { t, lang } = useI18n();
  const { samples, today, syncHistory, info, phase, sessionStale, lastSyncAt } =
    useWearable();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  /** Tarjetas esperando dato del volcado: carga hasta que el valor existe. */
  const [pendingFields, setPendingFields] = useState<Record<string, number>>(
    {},
  );

  /**
   * El autollenado usa la sesión BLE activa. Nunca toma mediciones antiguas
   * del historial como si fueran actuales.
   */
  const wearableValues = useMemo<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    const hr = samples.heart_rate?.value;
    if (hr) res.fc = String(Math.round(hr));
    const bp = samples.blood_pressure;
    if (bp) res.pa = `${Math.round(bp.value)}/${Math.round(bp.value2 ?? 0)}`;
    const spo2 = samples.spo2?.value;
    if (spo2) res.spo2 = String(Math.round(spo2));
    const temp = samples.temperature?.value;
    if (temp) res.temp = temp.toFixed(1);
    // Pasos y sueño salen del acumulado del día (historial del wearable).
    // El sueño se muestra en HORAS (canónico interno: minutos).
    if (today.steps) res.pasos = String(Math.round(today.steps));
    if (today.sleepMinutes)
      res.sueno = String(hoursFromMinutes(today.sleepMinutes));
    return res;
  }, [samples, today]);

  // El valor escrito apaga la carga de su tarjeta.
  useEffect(() => {
    setPendingFields((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if ((vals[id] ?? "").trim()) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [vals]);

  // Mientras una tarjeta espera su dato, cualquier muestra FRESCA del anillo la
  // rellena aunque el sync ya haya terminado (lecturas que llegan después).
  useEffect(() => {
    const ids = Object.keys(pendingFields);
    if (!ids.length) return;
    const now = Date.now();
    const next: Record<string, string> = {};
    for (const id of ids) {
      const value = wearableValues[id];
      if (!value) continue;
      const kind = VITAL_MEASURE_KIND[id];
      if (kind) {
        const sample = samples[kind];
        // Solo datos recientes de esta sesión: el volcado (historial) nunca
        // autollena — su slot del RTC puede traer una lectura vieja con marca
        // fresca — y lo más viejo de 5 min tampoco.
        if (
          !sample ||
          sample.source === "history" ||
          now - sample.ts > FRESH_ENOUGH_MS
        ) {
          continue;
        }
      }
      next[id] = value;
    }
    if (Object.keys(next).length) setVals((prev) => ({ ...prev, ...next }));
  }, [pendingFields, samples, wearableValues]);

  /**
   * Valor mostrado en la tarjeta: SOLO lo capturado en esta sesión (lo que
   * escribió el usuario o lo que autollenó el wearable). Sin respaldo de
   * `recentVitals`: una lección reabierta muestra las tarjetas vacías, para no
   * presentar una medición vieja como si fuera actual.
   */
  const displayVal = (fieldId: string): string => vals[fieldId] ?? "";

  const filled = VITAL_FIELDS.filter((f) => displayVal(f.id).trim()).length;

  // Datos del anillo para el bloque "Del anillo" (solo lectura).
  const locale = lang === "en" ? "en-US" : "es-ES";

  /** Footer stamp with the real recordedAt from the snapshot (completed view). */
  const recordedStamp = useMemo(() => {
    if (!done || !recentVitals?.recordedAt) return null;
    const dt = new Date(recentVitals.recordedAt);
    if (Number.isNaN(dt.getTime())) return null;
    const time = dt.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
    return toLocalISODate(dt) === toLocalISODate()
      ? t("Registrado hoy · {time}", { time })
      : t("Registrado {date} · {time}", {
          date: formatDateForDisplay(toLocalISODate(dt)),
          time,
        });
  }, [done, recentVitals, locale, t]);

  /**
   * Build the wire `VitalsPayload` from the eight collected `VITAL_FIELDS`
   * strings. Field mapping (design §Contracts / spec):
   *   fc → heartRate; pa → systolic/diastolic (split on "/");
   *   spo2 → o2Saturation; glu → glucose; peso → weightKg; temp → temperatureC;
   *   pasos → steps; sueno → sleepMinutes (el input va en HORAS, el wire en
   *   minutos: única conversión, `minutesFromHours`).
   * Empty/blank inputs are sent as `undefined` (omitted) so the backend treats
   * them as "not provided"; `measuredAt` is the completion instant (ISO). The
   * offline queue re-sends this object verbatim (JSON-serialized).
   */
  const buildVitalsPayload = useCallback((): VitalsPayload => {
    const parse = (raw: string | undefined): number | undefined => {
      if (!raw || !raw.trim()) return undefined;
      const n = vitalNumber(raw);
      return Number.isNaN(n) ? undefined : n;
    };

    const pa = vals["pa"]?.trim();
    let systolic: number | undefined;
    let diastolic: number | undefined;
    if (pa && pa.includes("/")) {
      const parts = pa.split("/");
      const s = parseFloat(parts[0].replace(",", "."));
      const d = parseFloat(parts[1].replace(",", "."));
      if (!Number.isNaN(s)) systolic = s;
      if (!Number.isNaN(d)) diastolic = d;
    }

    const sleepHours = parse(vals["sueno"]);

    return {
      heartRate: parse(vals["fc"]),
      systolic,
      diastolic,
      o2Saturation: parse(vals["spo2"]),
      glucose: parse(vals["glu"]),
      weightKg: parse(vals["peso"]),
      temperatureC: parse(vals["temp"]),
      steps: parse(vals["pasos"]),
      sleepMinutes:
        sleepHours === undefined ? undefined : minutesFromHours(sleepHours),
      measuredAt: new Date().toISOString(),
    };
  }, [vals]);

  const clearPending = useCallback((id: string) => {
    setPendingFields((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  }, []);

  /** Marca tarjetas como "cargando" (con tope de seguridad por tarjeta). */
  const markPending = useCallback(
    (ids: readonly string[], maxMs = PENDING_MAX_MS) => {
      if (!ids.length) return;
      const now = Date.now();
      setPendingFields((prev) => {
        const next = { ...prev };
        for (const id of ids) if (!(id in next)) next[id] = now;
        return next;
      });
      for (const id of ids) {
        window.setTimeout(() => clearPending(id), maxMs);
      }
    },
    [clearPending],
  );

  /**
   * Solo volcado de historial: trae lo que el anillo ya registró (pasos,
   * sueño, muestras guardadas) y deja que el stream en vivo rellene el
   * resto. Aquí NO se mide nada: medir es trabajo de la vista Reloj.
   */
  const sync = async () => {
    if (done || syncing) return;
    setSyncing(true);
    // Todo lo vacío del wearable se marca mientras llega el volcado.
    markPending(
      VITAL_FIELDS.filter(
        (f) =>
          !displayVal(f.id).trim() &&
          (f.id === "pasos" ||
            f.id === "sueno" ||
            f.id === "fc" ||
            f.id === "pa" ||
            f.id === "spo2"),
      ).map((f) => f.id),
      PENDING_AGGREGATE_MS,
    );
    try {
      await syncHistory();
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Estado de conexión para la fila del hero (verde/ámbar/gris). No basta el
   * flag de la app: si la sesión dejó de emitir (`sessionStale`) o la fase no
   * es `connected`, no está realmente conectado.
   */
  const connState: "on" | "connecting" | "off" =
    wearableConnected && !sessionStale && phase === "connected"
      ? "on"
      : phase === "scanning" || phase === "connecting" || sessionStale
        ? "connecting"
        : "off";
  const connDot =
    connState === "on"
      ? "var(--safe)"
      : connState === "connecting"
        ? "var(--org)"
        : "var(--mu)";
  const connLabel =
    connState === "on"
      ? t("Conectado")
      : connState === "connecting"
        ? t("Conectando…")
        : t("Sin wearable");

  return (
    <div className="vitals-workspace">
      <div className="wearable-brand hm-wordmark" aria-label="COPP-ADRESD">
        <img src={logoIcon} alt="" />
        <div><strong>COPP-ADRESD<sup>®</sup></strong><small>COMPREHENSIVE OBESITY<br />PREVENTION PROGRAM</small></div>
      </div>
      <PageHeader kicker={t("Biometría en vivo")} title={t("Medir signos vitales")}
        sub={t("Conecta, revisa y registra tus mediciones de hoy.")}
        trailing={<span className={`status-pill ${connState === "on" ? "on" : ""}`}>
          <span className="dot" style={{ background: connDot }} />{connLabel}
          {connState === "on" && info.battery !== undefined && <span className="wearable-battery"><IonIcon icon={batteryHalfOutline} />{info.battery}%</span>}
        </span>} />
      <section className={`wearable-showcase ${connState === "on" ? "is-connected" : ""} ${connState === "connecting" ? "is-busy" : ""}`}>
        <div className="wearable-art" aria-hidden="true">
          <span className="wearable-leaf wearable-leaf-left" /><span className="wearable-leaf wearable-leaf-right" />
          <div className="wearable-orbit"><WatchIcon3D size={132} /></div>
          <span className="wearable-bluetooth">{connState === "connecting" ? <IonSpinner name="crescent" /> : <IonIcon icon={bluetooth} />}</span>
        </div>
        <h2>{connState === "on" ? t("Tu dispositivo está conectado") : connState === "connecting" ? t("Conectando…") : t("Conecta tu wearable")}</h2>
        <p>{connState === "on" ? t("Tu salud en tiempo real, más cerca de ti.") : t("Mantén el wearable desbloqueado y cerca del teléfono.")}</p>
      </section>
      <div className="wearable-summary">
        {["fc", "spo2", "pa", "sueno", "pasos"].map(id => {
          const field = VITAL_FIELDS.find(f => f.id === id)!;
          return <div className="wearable-summary-item" key={id}>
            <span className="wearable-summary-icon"><IonIcon icon={vitalIconFor(id)} /></span>
            <span>{t(VITAL_SHORT_LABEL[id] ?? field.label)}</span><strong>{displayVal(id) || "—"}</strong><small>{t(field.unit)}</small>
          </div>;
        })}
      </div>
      <div className="wearable-sync">
        <IonButton expand="block" className="bt bt-primary" onClick={onOpenWearable}>
          <IonIcon icon={connState === "on" ? pulseOutline : bluetooth} slot="start" />
          {connState === "on" ? t("Abrir centro de medición") : t("Ir a conectar el wearable")}
        </IonButton>
        {connState === "on" && !done && <IonButton expand="block" fill="outline" disabled={syncing} onClick={() => void sync()}>
          {syncing ? <IonSpinner slot="start" name="crescent" /> : <IonIcon slot="start" icon={bluetooth} />}
          {syncing ? t("Leyendo el wearable…") : t("Sincronizar ahora")}
        </IonButton>}
        {lastSyncAt !== null && <p className="vitals-sync-stamp">{t("Última sincronización: {when}", { when: agoLabel(lastSyncAt, t) })}</p>}
      </div>
      <section className="vitals-records">
        <div className="vitals-records-heading"><div><span className="kicker">{t("Registro de mediciones")}</span><h2>{t("Signos de ahora")}</h2></div><span>{filled}/{VITAL_FIELDS.length}</span></div>
        <div className="vitals-record-grid">
          {VITAL_FIELDS.map(f => {
            const value = displayVal(f.id);
            const n = vitalNumber(value) * (f.scale ?? 1);
            const status = vitalStatus(n, t, f.goal);
            return <article className="vitals-record" key={f.id}>
              <span className="wearable-summary-icon"><IonIcon icon={vitalIconFor(f.id)} /></span>
              <div className="vitals-record-body">
                <IonInput label={t(f.label)} labelPlacement="stacked" placeholder="—" inputmode="decimal" value={value} disabled={done}
                  onIonInput={event => setVals(prev => ({ ...prev, [f.id]: event.detail.value ?? "" }))}>
                  <span slot="end" className="vitals-unit">{t(f.unit)}</span>
                </IonInput>
                <small>{pendingFields[f.id] ? t("Sincronizando…") : status.label}{f.scale && !Number.isNaN(n) ? ` · ${formatSleep(n, t)}` : ""}</small>
              </div>
              {pendingFields[f.id] && <IonSpinner name="crescent" />}
            </article>;
          })}
        </div>
      </section>
      <div className="wearable-sync">
      {recordedStamp && <div className="vt-stamp">{recordedStamp}</div>}

      {!done && (
        <>
          <IonButton
            expand="block"
            className="bt bt-primary"
            disabled={filled < 4}
            onClick={() => onComplete(buildVitalsPayload())}
          >
            {filled < 4
              ? t("Registra al menos 4 signos ({filled}/{total})", {
                  filled: String(filled),
                  total: String(VITAL_FIELDS.length),
                })
              : t("Guardar signos · +{pts} pts", { pts: String(pts) })}
          </IonButton>
        </>
      )}
      </div>
    </div>
  );
}

/** Tope de la animación de carga por tarjeta (si el dato nunca llega). */
const PENDING_MAX_MS = 60_000;
/** Tope para pasos/sueño: salen del volcado de historial (watchdogs de 6/12 s). */
const PENDING_AGGREGATE_MS = 30_000;
/**
 * Frescura para autollenar el check-in: solo datos de los últimos 5 minutos.
 * Más viejos no entran (la vista histórica vive en el Reloj).
 */
const FRESH_ENOUGH_MS = 300_000;

/** Campos con dato de wearable (los únicos que mandan al Reloj a medir). */
const VITAL_MEASURE_KIND: Partial<Record<string, MetricKind>> = {
  fc: "heart_rate",
  pa: "blood_pressure",
  spo2: "spo2",
};

/** Nombre compacto en la tarjeta; el completo queda en `title` (accesible). */
const VITAL_SHORT_LABEL: Partial<Record<string, string>> = {
  fc: "FC",
  pa: "Presión",
};

function vitalIconFor(id: string) {
  switch (id) {
    case "fc":
      return heart;
    case "pa":
      return pulseOutline;
    case "spo2":
    case "glu":
      return waterOutline;
    case "pasos":
      return footstepsOutline;
    case "sueno":
      return moonOutline;
    case "peso":
      return scaleOutline;
    case "temp":
      return thermometerOutline;
    default:
      return pulseOutline;
  }
}

export { ExerciseLesson } from "./ExerciseLesson";

export { NutraceuticLesson } from "./NutraceuticLesson";
export { EmotionalLesson } from "./EmotionalLesson";

export type ProgramTab = "hoy" | "racha" | "liga" | "evo";

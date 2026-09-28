import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ExerciseItemDto,
  NutritionMealDto,
  PodcastChapterDto,
  RecentVitalsDto,
  VitalsPayload,
} from "../../services/program/types";
import {
  IonButton,
  IonChip,
  IonIcon,
  IonInput,
  IonProgressBar,
  IonRange,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import {
  batteryHalfOutline,
  bluetooth,
  checkmark,
  heart,
  heartOutline,
  footstepsOutline,
  medkitOutline,
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
  EMOTION_FACES,
  VITAL_FIELDS,
  WEEK_BARRIERS,
  WEEK_LABELS,
} from "../../data/program";
import { MISSION_PHOTOS } from "../../data/missionPhotos";
import { EcgTrace } from "../../components/EcgTrace";
import type { MetricKind } from "../../devices/types";
import { useElapsed } from "../../hooks/useElapsed";
import { useWearable } from "../../context/WearableContext";
import { measurePhase, measurePhaseLabel } from "../../utils/measure";
import { DOUBLE_TAP_MS, isDoubleTap } from "../../hooks/useDoubleTap";
import {
  hoursFromMinutes,
  minutesFromHours,
  vitalBar,
  vitalNumber,
  vitalStatus,
} from "../../utils/vitals";
import { agoLabel, formatSleep } from "../../utils/wearable";
import {
  formatDateForDisplay,
  toLocalISODate,
  weekdayMondayIndex,
} from "../../utils/dates";
import { resolveNbDayOk } from "../../utils/nbWeekDays";
import { mealTypeToCode } from "../../utils/mealTypeToCode";
import { resolveStationSec } from "../../utils/exerciseSteps";
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
      ? chapters.map((c) => ({ at: c.atSeconds, label: c.label }))
      : [];
  const podTakeaways = takeaways && takeaways.length > 0 ? takeaways : [];

  const elapsed = progress * duration;
  const chapter =
    podChapters.length > 0
      ? ([...podChapters].reverse().find((c) => elapsed >= c.at) ??
        podChapters[0])
      : null;

  return (
    <div className="lsn-stack">
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
        <div className="pod-wave" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className={playing ? "on" : undefined}
              style={{
                animationDelay: `${i * 0.05}s`,
                height: `${18 + ((i * 17) % 28)}px`,
              }}
            />
          ))}
        </div>
        <div className="pod-now">{chapter ? t(chapter.label) : ""}</div>
        <div className="pod-times">
          <span>{mmss(elapsed)}</span>
          <span>{mmss(duration)}</span>
        </div>
        <IonProgressBar value={progress} className="pb" />
      </div>

      <div className="pod-copy">
        <strong>{t(podTitle)}</strong>
        <span>{[podHost, t(podBlurb)].filter(Boolean).join(" · ")}</span>
        {mediaUrl && (
          <span className="pod-stream-badge text-[10px] opacity-75">
            ● {t("Audio en streaming")}
          </span>
        )}
      </div>

      {audioError && (
        <div className="pod-error text-xs text-red-500 text-center py-1">
          {audioError}
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

      {podChapters.length > 0 && (
        <div className="lsn-chapters">
          {podChapters.map((c) => (
            <button
              key={c.at}
              type="button"
              className={`lsn-chip ${elapsed >= c.at ? "on" : ""}`}
              onClick={() => onSkip(c.at - elapsed)}
              disabled={seekDisabled}
            >
              {mmss(c.at)} · {t(c.label)}
            </button>
          ))}
        </div>
      )}

      {podTakeaways.length > 0 && (
        <div className="lsn-tips">
          {podTakeaways.map((tip) => (
            <div key={tip}>✓ {t(tip)}</div>
          ))}
        </div>
      )}

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
  const {
    samples,
    today,
    syncAll,
    syncStage,
    measurePolicy,
    measure,
    measureKinds,
    canMeasure,
    info,
    phase,
    sessionStale,
    lastSyncAt,
  } = useWearable();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  /**
   * Campos cuyo dato aún no ha llegado: la tarjeta mantiene su animación de
   * carga hasta que el valor existe (no solo mientras dura el sync).
   */
  const [pendingFields, setPendingFields] = useState<Record<string, number>>(
    {},
  );
  /** Tarjetas medidas en este sync que aún esperan su turno ("En cola"). */
  const [queuedFields, setQueuedFields] = useState<string[]>([]);
  /** Instante de inicio del sync: solo cuentan las muestras posteriores. */
  const syncStartedAtRef = useRef(0);
  /** Última etapa de medida vista: al cambiar, se vuelca su métrica. */
  const lastStageKindRef = useRef<MetricKind | null>(null);
  // Cronómetro del sync: refleja la medida puntual en curso (si la hay).
  const syncElapsed = useElapsed(syncStage?.startedAt);
  const syncProgress = measurePhase(
    syncElapsed * 1000,
    syncStage ? measurePolicy(syncStage.kind) : undefined,
  );
  /** Marca del último toque por tarjeta (doble toque = medir esa métrica). */
  const tileTapRef = useRef<Record<string, number>>({});
  const handleTileTap = (fieldId: string, kind: MetricKind) => {
    const now = Date.now();
    if (isDoubleTap(tileTapRef.current[fieldId] ?? 0, now, DOUBLE_TAP_MS)) {
      tileTapRef.current[fieldId] = 0;
      startCardMeasure(kind);
      return;
    }
    tileTapRef.current[fieldId] = now;
  };

  /** Medida lanzada desde la tarjeta (doble clic en su icono). */
  const [cardMeasure, setCardMeasure] = useState<{
    kind: MetricKind;
    since: number;
    /** ts de la última muestra al tocar: solo entra una ESTRICTAMENTE más nueva. */
    prevTs: number;
  } | null>(null);
  const cardElapsed = useElapsed(cardMeasure?.since);
  const cardProgress = measurePhase(
    cardElapsed * 1000,
    cardMeasure ? measurePolicy(cardMeasure.kind) : undefined,
  );
  // La tarjeta de la métrica en curso muestra la carga en su lugar.
  const measuringFieldId = cardMeasure
    ? MEASURE_FIELD_BY_KIND[cardMeasure.kind]
    : syncStage
      ? MEASURE_FIELD_BY_KIND[syncStage.kind]
      : null;
  // El cronómetro visible sale de la medida en curso (tarjeta o sync).
  const activeProgress = cardMeasure ? cardProgress : syncProgress;
  const activeKind = cardMeasure?.kind ?? syncStage?.kind ?? null;
  // Espejos: tras `await syncAll()` el autollenado debe leer los valores
  // frescos (el cierre del intervalo capturaría los del render anterior).
  const wearableValuesRef = useRef<Record<string, string>>({});

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
  wearableValuesRef.current = wearableValues;

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
        // Una muestra vale si es "viva" (mismo umbral que "En vivo"). Las
        // marcas del sync caducaban en secuencias largas (FC→presión→SpO2) y
        // el número no entraba aunque el driver ya lo hubiera entregado.
        if (!sample || now - sample.ts > LIVE_SAMPLE_MS) continue;
      }
      next[id] = value;
    }
    if (Object.keys(next).length) setVals((prev) => ({ ...prev, ...next }));
  }, [pendingFields, samples, wearableValues]);

  // Cada tarjeta muestra su número cuando SU medida termina (animación primero,
  // número después): al cambiar de etapa se vuelca solo la métrica completada, y
  // únicamente si su muestra nació en este sync (nunca una lectura vieja).
  useEffect(() => {
    const previous = lastStageKindRef.current;
    lastStageKindRef.current = syncStage?.kind ?? null;
    if (!previous || previous === syncStage?.kind) return;
    const fieldId = MEASURE_FIELD_BY_KIND[previous];
    const sample = samples[previous];
    if (!fieldId || !sample || sample.ts < syncStartedAtRef.current) return;
    const value = wearableValuesRef.current[fieldId];
    if (!value) return;
    setVals((prev) =>
      prev[fieldId] === value ? prev : { ...prev, [fieldId]: value },
    );
  }, [syncStage, samples]);

  // La medida de una tarjeta termina con SU muestra fresca: el número entra
  // en ese momento y la tarjeta deja de cargar.
  useEffect(() => {
    if (!cardMeasure) return;
    const sample = samples[cardMeasure.kind];
    if (
      !sample ||
      sample.ts <= cardMeasure.prevTs ||
      sample.ts < cardMeasure.since
    )
      return;
    const fieldId = MEASURE_FIELD_BY_KIND[cardMeasure.kind];
    const value = fieldId ? wearableValuesRef.current[fieldId] : undefined;
    if (fieldId && value) {
      setVals((prev) =>
        prev[fieldId] === value ? prev : { ...prev, [fieldId]: value },
      );
    }
    setCardMeasure(null);
  }, [cardMeasure, samples]);

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
  const hrSample = samples.heart_rate;

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
   * Tope de la animación por tarjeta: la ventana REAL del driver + su reintento
   * + margen. Con la banda, presión tarda 60 s + reintento a los 15 s.
   */
  const pendingCapFor = (kind: MetricKind) => {
    const policy = measurePolicy(kind);
    // SpO2: el barrido del anillo fija la lectura al final y puede llegar por
    // el volcado extra, así que su tarjeta espera más.
    const margin = kind === "spo2" ? 40_000 : 20_000;
    return (policy?.windowMs ?? 30_000) + (policy?.retryMs ?? 0) + margin;
  };

  // Cada etapa del sync enciende la carga de SU tarjeta (una a la vez): la
  // tarjeta se llena cuando llega el dato de esa medida, no todas a la vez.
  useEffect(() => {
    if (!syncStage) return;
    const id = MEASURE_FIELD_BY_KIND[syncStage.kind];
    if (!id) return;
    // Su turno llegó: sale de la cola y pasa a "Midiendo/Ajustando el sensor…".
    setQueuedFields((prev) =>
      prev.includes(id) ? prev.filter((field) => field !== id) : prev,
    );
    if (!displayVal(id).trim())
      markPending([id], pendingCapFor(syncStage.kind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStage, markPending]);

  /** Vuelve a medir una métrica desde su tarjeta (doble clic en el icono). */
  const startCardMeasure = (kind: MetricKind) => {
    if (
      done ||
      !wearableConnected ||
      !canMeasure ||
      !measureKinds.includes(kind) ||
      cardMeasure !== null ||
      syncStage !== null ||
      syncing
    ) {
      return;
    }
    const fieldId = MEASURE_FIELD_BY_KIND[kind];
    if (fieldId && !displayVal(fieldId).trim()) {
      markPending([fieldId], pendingCapFor(kind));
    }
    // Anti-eco: la banda a veces re-emite el mismo valor al instante; solo vale
    // una muestra estrictamente más nueva que la que había al tocar.
    setCardMeasure({ kind, since: Date.now(), prevTs: samples[kind]?.ts ?? 0 });
    measure(kind, (ok) => {
      if (ok) return;
      setCardMeasure(null);
      if (fieldId) clearPending(fieldId);
    });
  };

  const sync = async () => {
    if (done || syncing) return;
    syncStartedAtRef.current = Date.now();
    lastStageKindRef.current = null;
    setSyncing(true);
    // Pasos y sueño llegan con el volcado de historial: se marcan desde ya.
    markPending(
      VITAL_FIELDS.filter(
        (f) =>
          !displayVal(f.id).trim() && (f.id === "pasos" || f.id === "sueno"),
      ).map((f) => f.id),
      PENDING_AGGREGATE_MS,
    );
    // Medidas de este sync: FC (si su tarjeta sigue vacía, o sea el primer
    // sync de la sesión), presión y SpO2 SIEMPRE. Las tarjetas entran a la cola
    // y pasan a "Midiendo…/Ajustando…" cuando arranca su etapa.
    const force: MetricKind[] = ["blood_pressure", "spo2"];
    if (!displayVal("fc").trim()) force.unshift("heart_rate");
    const queued = force
      .map((kind) => MEASURE_FIELD_BY_KIND[kind])
      .filter((id): id is string => id !== undefined && !displayVal(id).trim());
    // Solo se encolan: el brillo y la etiqueta de fase empiezan cuando llega
    // su turno (el efecto de etapa las marca). Así no hay varias tarjetas con
    // "Ajustando el sensor…" a la vez.
    setQueuedFields(queued);
    try {
      await syncAll({ forceMeasure: force });
      // La FC no se mide en el sync, pero el driver PAUSA su stream mientras
      // mide presión/SpO2 y lo reanuda al terminar: se marca AL FINAL para que
      // la primera lectura reanudada llene la tarjeta (marcarla al inicio
      // expiraba antes de que el stream volviera y quedaba vacía). La
      // temperatura queda fuera: este anillo no la emite en vivo.
      markPending(
        VITAL_FIELDS.filter(
          (f) => !displayVal(f.id).trim() && f.id === "fc",
        ).map((f) => f.id),
        PENDING_STREAM_MS,
      );
    } finally {
      setQueuedFields([]);
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

  const pulseAge = hrSample ? agoLabel(hrSample.ts, t) : "";
  const pulseSummary = hrSample
    ? `${t("Pulso en vivo · {bpm} lpm", {
        bpm: String(Math.round(hrSample.value)),
      })} · ${
        pulseAge === t("En vivo")
          ? pulseAge
          : t("Actualizado {when}", {
              when: `${pulseAge.charAt(0).toLowerCase()}${pulseAge.slice(1)}`,
            })
      }`
    : t("Conecta el wearable para ver tu pulso en vivo");

  return (
    <div className="lsn-stack vt-lesson">
      <section className="vt-hero">
        <div className="vt-hero-top">
          <span className="vt-heart">
            <IonIcon icon={heart} />
          </span>
          <div>
            <div className="vt-kicker">{t("Check-in clínico")}</div>
            <strong>{t("Signos de ahora")}</strong>
          </div>
          <div className="vt-count">
            <b>{filled}</b>
            <small>/{VITAL_FIELDS.length}</small>
          </div>
        </div>
        {/* Estado del wearable: se ve desde el check-in sin salir de la vista. */}
        <div className="vt-hero-conn">
          <span className={`status-pill ${connState === "on" ? "on" : ""}`}>
            <span className="dot" style={{ background: connDot }} />
            {connLabel}
          </span>
          {connState === "on" && (
            <>
              {info.name && <span className="vt-conn-name">{info.name}</span>}
              {info.battery !== undefined && (
                <span className="vt-batt">
                  <IonIcon icon={batteryHalfOutline} />
                  <strong>{info.battery}%</strong>
                </span>
              )}
              {lastSyncAt !== null && (
                <span className="vt-conn-sync">
                  {t("Última sincronización: {when}", {
                    when: agoLabel(lastSyncAt, t),
                  })}
                </span>
              )}
            </>
          )}
        </div>

        <div className="vt-ecg-frame" aria-hidden="true">
          <EcgTrace bpm={hrSample?.value} height={168} />
        </div>
        <p className={`vt-ecg-live ${hrSample ? "is-live" : ""}`}>
          {hrSample && <span className="vt-live-dot" aria-hidden="true" />}
          {pulseSummary}
        </p>
        <p>
          {t(
            "Compara con mediciones anteriores. La tendencia importa más que un solo número.",
          )}
        </p>
      </section>

      {wearableConnected ? (
        <button
          type="button"
          className="vt-sync"
          disabled={syncing || syncStage !== null}
          onClick={() => void sync()}
        >
          <span className="vt-sync-orb">
            {syncing ? (
              <IonSpinner name="crescent" />
            ) : (
              <IonIcon icon={bluetooth} />
            )}
          </span>
          <span className="vt-sync-copy">
            <strong>
              {syncing
                ? t("Leyendo el wearable…")
                : t("Sincronizar {name}", {
                    name: info.name || t("Copp Adresd Wearable"),
                  })}
            </strong>
            <small>
              {syncing
                ? t("FC, SpO2, presión y más")
                : t("Autollenar con la última medición")}
            </small>
          </span>
        </button>
      ) : (
        <button type="button" className="vt-sync" onClick={onOpenWearable}>
          <span className="vt-sync-orb">
            <IonIcon icon={bluetooth} />
          </span>
          <span className="vt-sync-copy">
            <strong>{t("Ir a conectar el wearable")}</strong>
            <small>{t("Autollenar FC, SpO2, presión y más")}</small>
          </span>
        </button>
      )}

      <div className={`vt-grid ${connState === "on" ? "" : "is-offline"}`}>
        {VITAL_FIELDS.map((f) => {
          const v = displayVal(f.id);
          // Valor canónico (sueño: horas del input → minutos) para estado,
          // barra y payload; el input conserva la unidad del usuario.
          const n = vitalNumber(v) * (f.scale ?? 1);
          const st = vitalStatus(n, f.lo, f.hi, t, f.goal);
          const hasReading = v.trim() !== "" && !Number.isNaN(n);
          const bar = vitalBar(n, f);
          const isMeasuring = measuringFieldId === f.id;
          const isLoading = pendingFields[f.id] !== undefined;
          const measureKind = VITAL_MEASURE_KIND[f.id];
          return (
            <article
              key={f.id}
              className={`vt-tile vt-${f.id} ${st.cls} ${v ? "has" : ""} ${
                isMeasuring
                  ? "is-measuring"
                  : pendingFields[f.id]
                    ? "is-loading"
                    : ""
              } ${queuedFields.includes(f.id) ? "is-queued" : ""}`}
              onClick={(event) => {
                if (!measureKind) return;
                const target = event.target as HTMLElement | null;
                // Tocar el input del valor no debe disparar una medida.
                if (target?.closest("ion-input, input, textarea")) return;
                handleTileTap(f.id, measureKind);
              }}
            >
              {queuedFields.includes(f.id) && (
                <span className="watch-metric-queue">{t("En cola")}</span>
              )}
              <div className="vt-row-main">
                <span
                  className={`vt-icon ${measureKind ? "is-measurable" : ""}`}
                  aria-hidden="true"
                >
                  <IonIcon icon={vitalIconFor(f.id)} />
                </span>
                <div className="vt-reading">
                  <header className="vt-card-head">
                    <span className="vt-label" title={t(f.label)}>
                      {t(VITAL_SHORT_LABEL[f.id] ?? f.label)}
                    </span>
                    <span
                      className={`vt-status ${
                        isMeasuring ? "is-live" : st.cls || ""
                      }`}
                    >
                      {isMeasuring && activeKind
                        ? measurePhaseLabel(activeKind, activeProgress, t)
                        : pendingFields[f.id]
                          ? f.id === "pasos" || f.id === "sueno"
                            ? t("Sincronizando…")
                            : t("Ajustando el sensor…")
                          : connState !== "on" && measureKind
                            ? t("Sin wearable")
                            : st.label}
                    </span>
                  </header>
                  <div className="vt-value">
                    <IonInput
                      className="vt-input"
                      placeholder="—"
                      inputmode="decimal"
                      value={v}
                      disabled={done}
                      style={{ width: `${Math.max(2, v.length)}ch` }}
                      aria-label={t(f.label)}
                      onIonInput={(e) =>
                        setVals((prev) => ({
                          ...prev,
                          [f.id]: e.detail.value ?? "",
                        }))
                      }
                    />
                    <em className={isMeasuring || isLoading ? "is-empty" : ""}>
                      {t(f.unit)}
                    </em>
                  </div>
                  {f.scale && !Number.isNaN(n) && (
                    <span className="vt-sub">{formatSleep(n, t)}</span>
                  )}
                </div>
              </div>
              <div className="vt-row-detail">
                {isMeasuring ? (
                  <div
                    className="vt-measure"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(activeProgress.progress * 100)}
                    aria-label={t("Progreso de la medición")}
                  >
                    <i
                      style={{
                        width: `${Math.round(activeProgress.progress * 100)}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className={`vt-range ${f.kind === "goal" ? "is-goal" : ""}`}
                    aria-hidden="true"
                  >
                    {(f.kind !== "goal" || hasReading) && (
                      <b
                        style={{
                          left: `${bar.bandLeft}%`,
                          width: `${bar.bandWidth}%`,
                        }}
                      />
                    )}
                    <i
                      style={{
                        left: hasReading ? `${bar.pct}%` : "-8px",
                        opacity: hasReading ? 1 : 0,
                      }}
                    />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

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
  );
}

/** Medida puntual del wearable → tarjeta de signos que se pone "en carga". */
/** Tope de la animación de carga por tarjeta (si el dato nunca llega). */
const PENDING_MAX_MS = 60_000;
/** Tope para pasos/sueño: salen del volcado de historial (watchdogs de 6/12 s). */
const PENDING_AGGREGATE_MS = 30_000;
/** Tope para las métricas del stream en vivo (FC/temperatura) tras el sync. */
const PENDING_STREAM_MS = 30_000;
/** Una muestra cuenta como "viva" dentro de este margen (igual que "En vivo"). */
const LIVE_SAMPLE_MS = 120_000;

const MEASURE_FIELD_BY_KIND: Partial<Record<MetricKind, string>> = {
  heart_rate: "fc",
  spo2: "spo2",
  blood_pressure: "pa",
};

/** Métricas remedibles desde la tarjeta (doble clic en su icono). */
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
      return heartOutline;
    case "pa":
      return medkitOutline;
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

export function NutritionLesson({
  done,
  pts,
  title,
  dailyCalorieTarget,
  dailyProteinTarget,
  dailyCarbsTarget,
  dailyFatTarget,
  dailyFiberTarget,
  nutritionMeals,
  mealsLogged,
  onGoPlan,
  onComplete,
  unavailable,
}: {
  done: boolean;
  pts: number;
  title?: string;
  dailyCalorieTarget?: number | null;
  dailyProteinTarget?: number | null;
  dailyCarbsTarget?: number | null;
  dailyFatTarget?: number | null;
  dailyFiberTarget?: number | null;
  nutritionMeals?: NutritionMealDto[] | null;
  mealsLogged: string[];
  onGoPlan: () => void;
  onComplete: () => void;
  unavailable?: boolean;
}) {
  const t = useT();

  // Sin plan del servidor (content null/contentUnavailable o sin comidas):
  // estado honesto — nunca un plan fabricado.
  if (unavailable || !nutritionMeals || nutritionMeals.length === 0) {
    return <LessonUnavailable />;
  }

  const meals = nutritionMeals.map((m, idx) => {
    const mealTypeLower = m.mealType.toLowerCase();
    let emoji = "🥗";
    if (mealTypeLower.includes("desayuno")) emoji = "🌅";
    else if (mealTypeLower.includes("almuerzo")) emoji = "☀️";
    else if (mealTypeLower.includes("cena")) emoji = "🌙";
    else if (
      mealTypeLower.includes("snack") ||
      mealTypeLower.includes("merienda")
    )
      emoji = "🍎";

    const details: string[] = [];
    if (m.description) details.push(m.description);
    if (m.foods) details.push(`(${m.foods})`);
    const macros: string[] = [];
    if (m.proteinG) macros.push(`P: ${m.proteinG}g`);
    if (m.carbsG) macros.push(`C: ${m.carbsG}g`);
    if (m.fatG) macros.push(`G: ${m.fatG}g`);
    if (m.fiberG) macros.push(`Fib: ${m.fiberG}g`);
    if (macros.length > 0) details.push(`[${macros.join(" · ")}]`);

    return {
      // D4: el id es el mealCode canónico (des/alm/mer/cen), NO el
      // mealTypeLower crudo ('desayuno') — que nunca matcheaba los
      // códigos de nutritionIntakeLogs y rompía ring/kcal/checkmarks
      // (bug vivo Lessons.tsx:417/437). Tipos desconocidos → id único
      // sin match (no registrado).
      id: mealTypeToCode(m.mealType) ?? `meal-${idx}`,
      emoji,
      title: m.mealType,
      items: details.join(" ") || "Comida planificada",
      kcal: m.calories || 0,
    };
  });

  // S1: sin meta calórica REAL del servidor (null/0/negativo) no se inventa
  // el 1.800 de la demo — el titular muestra "—" y los macros siguen si vienen.
  const targetKcal =
    dailyCalorieTarget != null && dailyCalorieTarget > 0
      ? dailyCalorieTarget
      : null;
  const targetProtein = dailyProteinTarget
    ? `${dailyProteinTarget} g proteína`
    : null;
  const targetFat = dailyFatTarget ? `${dailyFatTarget} g grasa` : null;
  const targetCarbs = dailyCarbsTarget ? `${dailyCarbsTarget} g carbs` : null;
  const targetFiber = dailyFiberTarget ? `${dailyFiberTarget} g fibra` : null;

  const macroSubtext = [targetProtein, targetFat, targetCarbs, targetFiber]
    .filter(Boolean)
    .join(" · ");

  const kcal = meals
    .filter((m) => mealsLogged.includes(m.id))
    .reduce((s, m) => s + m.kcal, 0);
  const pct = meals.length > 0 ? mealsLogged.length / meals.length : 0;

  return (
    <div className="lsn-stack">
      <div className="nut-hero">
        <div>
          <div className="kicker" style={{ color: "var(--teal-d)" }}>
            {t(title || "Plan de Alimentación")}
          </div>
          <strong>
            {targetKcal != null ? `${targetKcal} kcal` : "—"}
            {macroSubtext ? ` · ${macroSubtext}` : ""}
          </strong>
          <span>
            {t("Hoy llevas {kcal} kcal registradas · {pct}% de comidas", {
              kcal: String(kcal),
              pct: String(Math.round(pct * 100)),
            })}
          </span>
        </div>
        <div className="nut-ring" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="24"
              fill="none"
              stroke="var(--g1)"
              strokeWidth="7"
            />
            <circle
              cx="32"
              cy="32"
              r="24"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${pct * 150.8} 150.8`}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <b>{Math.round(pct * 100)}%</b>
        </div>
      </div>
      {meals.map((m) => (
        <div
          key={m.id}
          className={`lsn-meal ${mealsLogged.includes(m.id) ? "on" : ""}`}
        >
          <span className="lsn-meal-ico">{m.emoji}</span>
          <div>
            <strong>{t(m.title)}</strong>
            <span>
              {t(m.items)} {m.kcal > 0 ? `· ${m.kcal} kcal` : ""}
            </span>
          </div>
          <em>{mealsLogged.includes(m.id) ? "✓" : ""}</em>
        </div>
      ))}
      <IonButton expand="block" className="bt bt-teal" onClick={onGoPlan}>
        {t("Ir a registrar comidas")}
      </IonButton>
      {!done && (
        <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>
          {t("Cumplí el plan hoy · +{pts} pts", { pts: String(pts) })}
        </IonButton>
      )}
    </div>
  );
}

export function ExerciseLesson({
  done,
  pts,
  title,
  exercises,
  step,
  left,
  running,
  onToggle,
  onSkip,
  onComplete,
  unavailable,
}: {
  done: boolean;
  pts: number;
  title?: string;
  exercises?: ExerciseItemDto[] | null;
  step: number;
  left: number;
  running: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onComplete: () => void;
  unavailable?: boolean;
}) {
  const t = useT();

  // Sin rutina del servidor (content null/contentUnavailable o sin ejercicios):
  // estado honesto — nunca un circuito fabricado.
  if (unavailable || !exercises || exercises.length === 0) {
    return <LessonUnavailable />;
  }

  const steps = exercises.map((ex) => {
    // W4: duración defensiva compartida con ProgramPage (resolveStationSec) —
    // un durationSecs negativo jamás crea una estación de 0s.
    const sec = resolveStationSec(ex);
    const cueParts: string[] = [];
    if (ex.sets && ex.repetitions)
      cueParts.push(`${ex.sets} series x ${ex.repetitions} reps`);
    else if (ex.sets) cueParts.push(`${ex.sets} series`);
    if (ex.description) cueParts.push(ex.description);
    if (ex.tips) cueParts.push(ex.tips);

    return {
      name: ex.name,
      sec,
      cue: cueParts.join(" · ") || "Ejecuta con buena postura",
    };
  });

  const safeStep = Math.min(step, steps.length - 1);
  const cur = steps[safeStep] || steps[0];
  const total = steps.reduce((s, x) => s + x.sec, 0);
  const doneSec =
    steps.slice(0, safeStep).reduce((s, x) => s + x.sec, 0) + (cur.sec - left);
  const ring = cur ? 1 - left / cur.sec : 1;

  return (
    <div className="lsn-stack">
      <div className="ex-timer">
        <div className="ex-ring-wrap">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r="58"
              fill="none"
              stroke="rgba(255,255,255,.12)"
              strokeWidth="10"
            />
            <circle
              cx="70"
              cy="70"
              r="58"
              fill="none"
              stroke="var(--ice)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${ring * 364.4} 364.4`}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div className="ex-ring-center">
            <div className="kicker" style={{ color: "var(--ice)" }}>
              {title ? `${t(title)} · ` : ""}
              {safeStep + 1} / {steps.length}
            </div>
            <div className="display ex-clock">{mmss(left)}</div>
          </div>
        </div>
        <div className="ex-step-name">{t(cur.name)}</div>
        <div className="ex-step-cue">{t(cur.cue)}</div>
        <div className="ex-total">
          {t("Sesión")} {mmss(doneSec)} / {mmss(total)}
        </div>
      </div>

      <div className="ex-list">
        {steps.map((s, i) => (
          <div
            key={s.name}
            className={`ex-li ${i < safeStep ? "done" : ""} ${i === safeStep ? "now" : ""}`}
          >
            <b>{i < safeStep ? "✓" : i + 1}</b>
            <div>
              <strong>{t(s.name)}</strong>
              <span>{mmss(s.sec)}</span>
            </div>
          </div>
        ))}
      </div>

      {!done && (
        <>
          <IonButton expand="block" className="bt bt-pur" onClick={onToggle}>
            {running
              ? t("Pausar")
              : step === 0 && left === (steps[0]?.sec ?? 60)
                ? t("Iniciar circuito")
                : t("Continuar")}
          </IonButton>
          <IonButton expand="block" className="bt bt-ghost" onClick={onSkip}>
            {t("Saltar estación")}
          </IonButton>
          <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>
            {t("Ya lo hice · +{pts} pts", { pts: String(pts) })}
          </IonButton>
        </>
      )}
    </div>
  );
}

export function NutraceuticLesson({
  done,
  pts,
  takenAt,
  slot,
  nbWeekDays,
  onSlot,
  onComplete,
}: {
  done: boolean;
  pts: number;
  takenAt: string;
  slot: string;
  nbWeekDays?: boolean[] | null;
  onSlot: (v: string) => void;
  onComplete: () => void;
}) {
  const t = useT();
  const todayIdx = weekdayMondayIndex();
  return (
    <div className="lsn-stack">
      <div className="nb-card">
        <div className="nb-title">{t("¿Ya tomaste tu Nutracéutico?")}</div>
        <div className="nb-sub">
          {done
            ? t("Registrado · {takenAt}", { takenAt })
            : t("Producto ADRED · 1 cápsula con el desayuno")}
        </div>
        <IonSegment
          value={slot}
          onIonChange={(e) => onSlot(String(e.detail.value))}
          disabled={done}
        >
          <IonSegmentButton value="manana">{t("Mañana")}</IonSegmentButton>
          <IonSegmentButton value="tarde">{t("Tarde")}</IonSegmentButton>
          <IonSegmentButton value="noche">{t("Noche")}</IonSegmentButton>
        </IonSegment>
        <div className="nb-streak">
          {WEEK_LABELS.map((d, i) => {
            // Misma resolución que la franja de la vista Hoy (resolveNbDayOk):
            // verdad del servidor cuando `nbWeekDays` viene (7 ítems), con el
            // estado optimista local ganando solo para hoy; sin arreglo cae a
            // la derivación local legada (pasado ok · futuro no) — sin datos
            // demo.
            const isToday = i === todayIdx;
            const ok = resolveNbDayOk(i, todayIdx, nbWeekDays, done);
            return (
              <div
                key={d}
                className={`nb-day ${ok ? "ok" : "no"} ${isToday ? "today" : ""}`}
              >
                {d}
              </div>
            );
          })}
        </div>
        {!done ? (
          <IonButton expand="block" className="bt bt-teal" onClick={onComplete}>
            {t("Sí, ya lo tomé · +{pts} pts", { pts: String(pts) })}
          </IonButton>
        ) : (
          <div className="lesson-done-banner">
            {t("Dosis de hoy confirmada")}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmotionalLesson({
  done,
  pts,
  onComplete,
}: {
  done: boolean;
  pts: number;
  onComplete: (payload: { mood: string; barrier: string }) => void;
}) {
  const t = useT();
  const [mood, setMood] = useState("");
  const [stress, setStress] = useState(5);
  const [motivation, setMotivation] = useState(8);
  const [sleep, setSleep] = useState("");
  const [barrier, setBarrier] = useState("");
  const [note, setNote] = useState("");
  // Confirmación única y neutral del registro (sin respuestas fabricadas de IA).
  const reply = barrier ? t("Gracias, tu equipo recibió tu registro") : "";
  const ready = Boolean(mood && sleep && barrier);

  const stressLabel = useMemo(
    () => (stress <= 3 ? t("Bajo") : stress <= 6 ? t("Moderado") : t("Alto")),
    [stress, t],
  );

  return (
    <div className="lsn-stack">
      <p className="lesson-q">{t("¿Cómo está tu ánimo ahora?")}</p>
      <div className="mood-row">
        {EMOTION_FACES.map((m) => (
          <button
            key={m.v}
            type="button"
            className={`mood-face ${mood === m.v ? "sel" : ""}`}
            onClick={() => setMood(m.v)}
          >
            <span>{m.face}</span>
            <small>{t(m.label)}</small>
          </button>
        ))}
      </div>

      <p className="lesson-q">
        {t("Estrés")} · {stressLabel}
      </p>
      <IonRange
        min={1}
        max={10}
        step={1}
        snaps
        value={stress}
        disabled={done}
        onIonInput={(e) => setStress(Number(e.detail.value))}
      />

      <p className="lesson-q">
        {t("Motivación")} · {motivation}/10
      </p>
      <IonRange
        min={1}
        max={10}
        step={1}
        snaps
        value={motivation}
        disabled={done}
        onIonInput={(e) => setMotivation(Number(e.detail.value))}
      />

      <p className="lesson-q">{t("Sueño anoche")}</p>
      <IonSegment
        value={sleep}
        onIonChange={(e) => setSleep(String(e.detail.value ?? ""))}
        disabled={done}
      >
        <IonSegmentButton value="5">≤5 h</IonSegmentButton>
        <IonSegmentButton value="6">6–7 h</IonSegmentButton>
        <IonSegmentButton value="8">≥8 h</IonSegmentButton>
      </IonSegment>

      <p className="lesson-q">{t("¿Qué fue lo más difícil esta semana?")}</p>
      <div className="barrier-opts">
        {WEEK_BARRIERS.map((b) => (
          <IonChip
            key={b.id}
            className={barrier === b.id ? "sel" : undefined}
            onClick={() => !done && setBarrier(b.id)}
          >
            {t(b.label)}
          </IonChip>
        ))}
      </div>
      {reply && <div className="lsn-ai">{reply}</div>}

      <IonTextarea
        className="fld post-tx"
        value={note}
        disabled={done}
        placeholder={t("Nota opcional para tu psicóloga")}
        autoGrow
        onIonInput={(e) => setNote(e.detail.value ?? "")}
      />

      {!done && (
        <IonButton
          expand="block"
          className="bt bt-primary"
          disabled={!ready}
          onClick={() => onComplete({ mood, barrier })}
        >
          <IonIcon icon={checkmark} slot="start" />
          {t("Guardar evaluación · +{pts} pts", { pts: String(pts) })}
        </IonButton>
      )}
    </div>
  );
}

export type ProgramTab = "hoy" | "racha" | "liga" | "evo";

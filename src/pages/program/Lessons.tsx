import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  NutritionMealDto,
  PodcastChapterDto,
  RecentVitalsDto,
  VitalsPayload,
} from "../../services/program/types";
import {
  IonButton,
  IonIcon,
  IonInput,
  IonProgressBar,
  IonSpinner,
} from "@ionic/react";
import {
  batteryHalfOutline,
  bluetooth,
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
  VITAL_FIELDS,
} from "../../data/program";
import { MISSION_PHOTOS } from "../../data/missionPhotos";
import { EcgTrace } from "../../components/EcgTrace";
import type { MetricKind } from "../../devices/types";
import { useWearable } from "../../context/WearableContext";
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
} from "../../utils/dates";
import { mealTypeToCode } from "../../utils/mealTypeToCode";
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

  const pulseAge = hrSample
    ? hrSample.source === "history"
      ? t("Del historial")
      : agoLabel(hrSample.ts, t)
    : "";
  /** Solo una lectura de esta sesión (no historial) puede decir "en vivo". */
  const pulseIsLive = hrSample !== undefined && hrSample.source !== "history";
  const pulseSummary =
    info.wearing === false
      ? t("Coloca el wearable para medir")
      : hrSample
        ? `${t(
            pulseIsLive ? "Pulso en vivo · {bpm} lpm" : "Pulso · {bpm} lpm",
            { bpm: String(Math.round(hrSample.value)) },
          )} · ${
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
          disabled={syncing}
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
          const isLoading = pendingFields[f.id] !== undefined;
          const measureKind = VITAL_MEASURE_KIND[f.id];
          // Sin dato del wearable: tocar la tarjeta lleva al Reloj a medir
          // (aquí no se mide; esta vista solo lee).
          const needsWearable = !hasReading && measureKind && !done;
          return (
            <article
              key={f.id}
              className={`vt-tile vt-${f.id} ${st.cls} ${v ? "has" : ""} ${
                pendingFields[f.id] ? "is-loading" : ""
              }${needsWearable ? " is-link" : ""}`}
              onClick={
                needsWearable
                  ? (event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest("ion-input, input, textarea")) return;
                      onOpenWearable();
                    }
                  : undefined
              }
            >
              <div className="vt-row-main">
                <span className="vt-icon" aria-hidden="true">
                  <IonIcon icon={vitalIconFor(f.id)} />
                </span>
                <div className="vt-reading">
                  <header className="vt-card-head">
                    <span className="vt-label" title={t(f.label)}>
                      {t(VITAL_SHORT_LABEL[f.id] ?? f.label)}
                    </span>
                    <span className={`vt-status ${st.cls || ""}`}>
                      {pendingFields[f.id]
                        ? t("Sincronizando…")
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
                    <em className={isLoading ? "is-empty" : ""}>{t(f.unit)}</em>
                  </div>
                  {f.scale && !Number.isNaN(n) && (
                    <span className="vt-sub">{formatSleep(n, t)}</span>
                  )}
                </div>
              </div>
              <div className="vt-row-detail">
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
      title: ({ des: "Desayuno", alm: "Almuerzo", mer: "Merienda", cen: "Cena" } as Record<string, string>)[mealTypeToCode(m.mealType) ?? ""] ?? m.mealType,
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
  const pct = meals.length > 0 ? meals.filter(m => mealsLogged.includes(m.id)).length / meals.length : 0;

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
      {meals.every(m => m.id !== "mer") && <section className="lsn-meal nutrition-missing-snack"><span className="lsn-meal-ico" aria-hidden="true">🍎</span><div><strong>{t("Merienda")}</strong><span>{t("Tu nutricionista aún no ha indicado esta comida para este día.")}</span></div></section>}
      <IonButton expand="block" className="bt bt-primary" onClick={onGoPlan}>
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

export { ExerciseLesson } from "./ExerciseLesson";

export { NutraceuticLesson } from "./NutraceuticLesson";
export { EmotionalLesson } from "./EmotionalLesson";

export type ProgramTab = "hoy" | "racha" | "liga" | "evo";

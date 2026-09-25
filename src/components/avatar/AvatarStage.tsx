import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  addOutline,
  eyeOutline,
  pauseOutline,
  personOutline,
  playOutline,
  refreshOutline,
  removeOutline,
} from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
import type {
  AvatarMetrics,
  MorphInfo,
  MorphWeights,
} from "./avatar-validation";
import type { AvatarState } from "./avatar-state";
import type { AvatarBodyState } from "./avatar-body-state";

// Carga diferida: el bundle 3D no se descarga hasta montar el escenario.
const Viewer = lazy(() =>
  import("./AvatarViewer").then((m) => ({ default: m.AvatarViewer })),
);

class ViewerBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div data-avatar-load-state="ERROR" data-avatar-error="asset">
        {this.props.fallback}
      </div>
    ) : (
      this.props.children
    );
  }
}

export interface AvatarStageProps {
  /** Estado visual completo (configuración + cuerpo por peso). Null = aún sin datos. */
  avatar: AvatarState | null;
  /** Pesos de morphs derivados del peso. Null = cargando o sin datos. */
  weights: MorphWeights | null;
  /** Clave de propietario para remontar el viewer al cambiar sesión/género. */
  ownerKey: string | null;
  /** True cuando hay error de datos (no se muestra el viewer). */
  disabled?: boolean;
  /** Fase de datos para QA (ERROR | LOADING_USER_DATA | NO_DATA | USER_DATA_READY). */
  dataPhase: string;
  /** Ms de carga del historial para QA. */
  historyMs?: number;
  /** Estado corporal para QA (se muestra aunque aún no haya configuración). */
  bodyState?: AvatarBodyState | null;
  /** True cuando la personalización aún carga (texto de loading preciso). */
  isPersonalizationLoading?: boolean;
  onReady?: (morphs: MorphInfo[]) => void;
  onMetrics?: (metrics: AvatarMetrics) => void;
}

/** Escenario 3D reutilizable: viewer lazy + controles de vista + autoplay con reduced motion. */
export function AvatarStage({
  avatar,
  weights,
  ownerKey,
  disabled = false,
  dataPhase,
  historyMs,
  bodyState,
  isPersonalizationLoading = false,
  onReady,
  onMetrics,
}: AvatarStageProps) {
  const t = useT();
  const gender = avatar?.gender;
  const [viewpoint, setViewpoint] = useState<"front" | "side">("front");
  const [viewRevision, setViewRevision] = useState(0);
  const [viewDistance, setViewDistance] = useState(3.1);
  const [enteredAt] = useState(() => performance.now());
  const [morphs, setMorphs] = useState<MorphInfo[]>([]);
  const [metrics, setMetrics] = useState<AvatarMetrics | null>(null);
  const [playing, setPlaying] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // Reduced motion: el autoplay se apaga por defecto si el dispositivo lo pide.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (media.matches) setPlaying(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const handleReady = (next: MorphInfo[]) => {
    setMorphs(next);
    onReady?.(next);
  };
  const handleMetrics = (next: AvatarMetrics) => {
    setMetrics(next);
    onMetrics?.(next);
  };
  const retryViewer = () => {
    setMetrics(null);
    setMorphs([]);
    setAttempt((a) => a + 1);
  };

  const showLoading = !weights && !disabled;
  const controlsDisabled = !morphs.length || disabled || !weights;

  return (
    <div className="avatar-stage">
      <div
        className="avatar-canvas"
        data-avatar-body-state={JSON.stringify(
          bodyState ?? avatar?.body ?? null,
        )}
        data-avatar-data-state={dataPhase}
        data-avatar-history-ms={historyMs}
        aria-busy={!disabled && (!weights || !metrics)}
      >
        {showLoading && (
          <div className="avatar-status" role="status">
            <IonSpinner aria-hidden="true" />
            {isPersonalizationLoading
              ? t("Cargando tu personalización…")
              : t("Consultando tu historial de peso…")}
          </div>
        )}
        {weights && avatar && (
          <div
            hidden={disabled}
            data-avatar-load-state={metrics ? "AVATAR_READY" : "AVATAR_LOADING"}
          >
            <ViewerBoundary
              key={`${ownerKey}:${gender}:${attempt}`}
              fallback={
                <div role="alert">
                  <p>
                    {t(
                      "No se pudo mostrar tu avatar. Comprueba la conexión e inténtalo de nuevo.",
                    )}
                  </p>
                  <IonButton style={{ minHeight: 44 }} onClick={retryViewer}>
                    {t("Reintentar")}
                  </IonButton>
                </div>
              }
            >
              <Suspense
                fallback={
                  <div role="status">
                    <IonSpinner />
                    {t("Cargando avatar…")}
                  </div>
                }
              >
                <Viewer
                  skin={avatar.skin}
                  gender={gender}
                  weights={weights}
                  equipment={avatar}
                  viewpoint={viewpoint}
                  viewRevision={viewRevision}
                  viewDistance={viewDistance}
                  playing={playing && !disabled}
                  enteredAt={enteredAt}
                  onReady={handleReady}
                  onMetrics={handleMetrics}
                />
              </Suspense>
            </ViewerBoundary>
          </div>
        )}
      </div>
      {/*
        Barra flotante tipo cápsula de vidrio: 6 controles táctiles con
        mini-íconos (IonButton redondos con aria-label; los textos visibles
        anteriores vivían en es.json y se reutilizan como etiquetas
        accesibles). HTML custom justificado: Ionic no ofrece una toolbar
        flotante de vidrio sobre canvas 3D.
      */}
      <div
        className="avatar-dock"
        role="toolbar"
        aria-label={t("Controles del avatar")}
      >
        <IonButton
          fill="clear"
          shape="round"
          className={`avatar-dock-btn${viewpoint === "front" ? " on" : ""}`}
          disabled={controlsDisabled}
          aria-label={t("Ver de frente")}
          aria-pressed={viewpoint === "front"}
          onClick={() => {
            setViewpoint("front");
            setViewRevision((r) => r + 1);
          }}
        >
          <IonIcon slot="icon-only" icon={eyeOutline} />
        </IonButton>
        <IonButton
          fill="clear"
          shape="round"
          className={`avatar-dock-btn${viewpoint === "side" ? " on" : ""}`}
          disabled={controlsDisabled}
          aria-label={t("Ver de perfil")}
          aria-pressed={viewpoint === "side"}
          onClick={() => {
            setViewpoint("side");
            setViewRevision((r) => r + 1);
          }}
        >
          <IonIcon slot="icon-only" icon={personOutline} />
        </IonButton>
        <IonButton
          fill="clear"
          shape="round"
          className="avatar-dock-btn avatar-dock-play"
          disabled={controlsDisabled}
          aria-label={
            playing ? t("Pausar movimiento") : t("Reanudar movimiento")
          }
          aria-pressed={playing}
          onClick={() => setPlaying((p) => !p)}
        >
          <IonIcon
            slot="icon-only"
            icon={playing ? pauseOutline : playOutline}
          />
        </IonButton>
        <span className="avatar-dock-sep" aria-hidden="true" />
        <IonButton
          fill="clear"
          shape="round"
          className="avatar-dock-btn"
          disabled={controlsDisabled}
          aria-label={t("Acercar")}
          onClick={() => setViewDistance((d) => Math.max(2.1, d - 0.4))}
        >
          <IonIcon slot="icon-only" icon={addOutline} />
        </IonButton>
        <IonButton
          fill="clear"
          shape="round"
          className="avatar-dock-btn"
          disabled={controlsDisabled}
          aria-label={t("Alejar")}
          onClick={() => setViewDistance((d) => Math.min(4.5, d + 0.4))}
        >
          <IonIcon slot="icon-only" icon={removeOutline} />
        </IonButton>
        <IonButton
          fill="clear"
          shape="round"
          className="avatar-dock-btn"
          disabled={controlsDisabled}
          aria-label={t("Restablecer vista")}
          onClick={() => {
            setViewDistance(3.1);
            setViewpoint("front");
            setViewRevision((r) => r + 1);
          }}
        >
          <IonIcon slot="icon-only" icon={refreshOutline} />
        </IonButton>
      </div>
      <p className="avatar-hint">
        {t("Arrastra para girar; pellizca para acercar.")}
      </p>
      <div>
        {Object.values(metrics?.equipment ?? {}).some(
          (item) => item.status === "loading",
        ) && (
          <p role="status">
            <IonSpinner />
            {t("Cargando elementos del avatar…")}
          </p>
        )}
        {Object.values(metrics?.equipment ?? {}).some(
          (item) => item.status === "error",
        ) && (
          <p role="alert">
            {t(
              "No se pudo cargar un elemento. Quítalo y vuelve a seleccionarlo para reintentar.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}

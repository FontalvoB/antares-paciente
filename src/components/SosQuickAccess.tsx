import { IonButton, IonIcon } from "@ionic/react";
import { medkit } from "ionicons/icons";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { isSosAvailable } from "../features/wellness/sos/sos-store";
import { useT } from "../i18n/I18nContext";
import "../features/wellness/sos/wellness-sos.css";

/** Overlays que pueden tapar la barra inferior (Ionic y overlays propios del shell). */
const COVERING_SELECTOR = [
  "ion-modal:not(.overlay-hidden)",
  "ion-popover:not(.overlay-hidden)",
  "ion-action-sheet:not(.overlay-hidden):not(.sos-contact-sheet)",
  "ion-alert:not(.overlay-hidden)",
  ".app-shell .overlay:not(.overlay-panic)",
].join(", ");

/**
 * `true` cuando el SOS de la barra inferior no está a la vista: la pantalla no
 * tiene barra, el teclado la ocultó o un modal/overlay/video la tapa.
 */
function navSosHidden(): boolean {
  if (document.documentElement.classList.contains("kb-open")) return true;
  if (document.querySelector(COVERING_SELECTOR)) return true;
  // Las pantallas con `hideNav` (registro, comunidad, lecciones…) no montan la barra.
  return !document.querySelector(".app-shell .bnav .ni-center");
}

/** Observa el DOM (solo cambios de clase y nodos) y recalcula en el siguiente frame. */
function useNavSosHidden(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHidden(navSosHidden()));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled]);
  return enabled && hidden;
}

/**
 * Acceso rápido global al SOS (KAN-137). Vive en el Shell, por encima de
 * modales, teclado, video y sesión de ejercicio, y solo aparece cuando el SOS
 * fijo de la barra inferior no está visible (sin duplicar el botón).
 */
export function SosQuickAccess() {
  const { flow, user, panicOpen, openPanic } = useApp();
  const t = useT();
  const available = isSosAvailable({ flow, user });
  const navHidden = useNavSosHidden(available && !panicOpen);
  if (!available || panicOpen || !navHidden) return null;
  return (
    <IonButton
      type="button"
      fill="clear"
      className="sos-quick-access"
      onClick={openPanic}
      aria-label={t("Abrir SOS de emergencia")}
    >
      <span className="sos-quick-access-content">
        <IonIcon icon={medkit} aria-hidden="true" />
        <span>SOS</span>
      </span>
    </IonButton>
  );
}

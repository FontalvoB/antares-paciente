import { useEffect, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import {
  checkmarkCircleOutline,
  cloudOfflineOutline,
  syncOutline,
} from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

/**
 * Banner flotante de resiliencia en red (Fase 12, tarea 2.3).
 *
 * Bento sutil no intrusivo (`pointer-events: none`, nunca bloquea toques):
 * - Offline (ámbar): "Sin conexión" + conteo de cambios pendientes.
 * - Al recuperar red (verde): "Sincronizando tus avances…" mientras despacha.
 * - Al vaciar: "Conexión restablecida" con fadeout a los 2.5 s.
 *
 * Cobertura global: se monta una vez en el `Shell` de `App.tsx`. Sin
 * props ni prop-drilling: lee `useNetworkStatus()`. Todo texto por `t()`.
 */

const RESTORED_VISIBLE_MS = 2500;
const RESTORED_LEAVING_MS = 2100;

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount } = useNetworkStatus();
  const { t } = useI18n();
  const [restored, setRestored] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const prevRef = useRef({ online: isOnline, syncing: isSyncing });

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { online: isOnline, syncing: isSyncing };
    // Regreso a online (venía offline) o fin de un despacho: ventana de
    // confirmación de 2.5 s con salida suavizada los últimos 400 ms.
    const justBack = isOnline && (!prev.online || (prev.syncing && !isSyncing));
    if (!justBack) return;
    setRestored(true);
    setLeaving(false);
    const fadeTimer = window.setTimeout(
      () => setLeaving(true),
      RESTORED_LEAVING_MS,
    );
    const hideTimer = window.setTimeout(() => {
      setRestored(false);
      setLeaving(false);
    }, RESTORED_VISIBLE_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isOnline, isSyncing]);

  if (!isOnline) {
    return (
      <div className="ob-wrap">
        <div className="ob-card ob-offline" role="status" aria-live="polite">
          <span className="ob-ico" aria-hidden="true">
            <IonIcon icon={cloudOfflineOutline} />
          </span>
          <span className="ob-body">
            <strong>{t("Sin conexión")}</strong>
            <small>
              {pendingCount > 0
                ? pendingCount === 1
                  ? t("Tienes 1 cambio pendiente de sincronizar")
                  : t("Tienes {n} cambios pendientes de sincronizar", {
                      n: String(pendingCount),
                    })
                : t("Tus avances se guardarán y sincronizarán automáticamente")}
            </small>
          </span>
        </div>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="ob-wrap">
        <div className="ob-card ob-syncing" role="status" aria-live="polite">
          <span className="ob-ico ob-spin" aria-hidden="true">
            <IonIcon icon={syncOutline} />
          </span>
          <span className="ob-body">
            <strong>{t("Sincronizando tus avances…")}</strong>
          </span>
        </div>
      </div>
    );
  }

  if (restored) {
    return (
      <div className="ob-wrap">
        <div
          className={`ob-card ob-restored${leaving ? " ob-leaving" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="ob-ico" aria-hidden="true">
            <IonIcon icon={checkmarkCircleOutline} />
          </span>
          <span className="ob-body">
            <strong>{t("Conexión restablecida")}</strong>
          </span>
        </div>
      </div>
    );
  }

  return null;
}

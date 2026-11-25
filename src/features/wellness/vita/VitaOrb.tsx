/**
 * Disparador persistente de Vita (KAN-167, uso interno de `VitaEntry`).
 *
 * Dos estados: orbe flotante (por defecto) y pestaña compacta minimizada que
 * sigue visible en el borde y vuelve a orbe al tocarla. Encima del orbe puede
 * aparecer el aviso proactivo diario. La entrada usa Framer Motion y respeta
 * `prefers-reduced-motion`; el halo solo anima `transform`/`opacity` (60 fps).
 */
import type { Ref } from "react";
import { IonButton, IonIcon } from "@ionic/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { chevronBack, close } from "ionicons/icons";
import vitaPortrait from "../../../assets/vita-coach.png";
import { useI18n } from "../../../i18n/I18nContext";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface VitaOrbProps {
  module: string;
  label: string;
  open: boolean;
  minimized: boolean;
  nudge: boolean;
  triggerRef: Ref<HTMLButtonElement>;
  tabRef: Ref<HTMLIonButtonElement>;
  onOpen: () => void;
  onRestore: () => void;
  onDismissNudge: () => void;
}

export function VitaOrb({
  module, label, open, minimized, nudge, triggerRef, tabRef, onOpen, onRestore, onDismissNudge,
}: VitaOrbProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const duration = reduced ? 0 : 0.3;

  return (
    <div className={`vita-dock${minimized ? " is-minimized" : ""}${open ? " is-open" : ""}`} data-vita-module={module}>
      <AnimatePresence initial={false} mode="wait">
        {minimized ? (
          <motion.div
            key="tab"
            className="vita-dock-tab-wrap"
            initial={reduced ? false : { x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: 28, opacity: 0 }}
            transition={{ duration, ease: EASE }}
          >
            <IonButton ref={tabRef} fill="clear" className="vita-dock-tab" aria-label={t("Mostrar a Vita")} onClick={onRestore}>
              <span className="vita-dock-tab-content">
                <IonIcon icon={chevronBack} aria-hidden="true" />
                <img src={vitaPortrait} alt="" aria-hidden="true" />
              </span>
            </IonButton>
          </motion.div>
        ) : (
          <motion.div
            key="orb"
            className="vita-dock-orb-wrap"
            initial={reduced ? false : { scale: 0.7, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { scale: 0.7, opacity: 0 }}
            transition={{ duration, ease: EASE }}
          >
            <AnimatePresence>
              {nudge && (
                <motion.div
                  className="vita-nudge"
                  role="status"
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration, ease: EASE }}
                >
                  <IonButton fill="clear" className="vita-nudge-body" onClick={onOpen}>
                    <span className="vita-nudge-text">
                      <strong>Vita</strong>
                      <span>{t("Estoy aquí si quieres repasar tu día conmigo.")}</span>
                    </span>
                  </IonButton>
                  <IonButton fill="clear" className="vita-nudge-close" aria-label={t("Descartar aviso de Vita")} onClick={onDismissNudge}>
                    <IonIcon slot="icon-only" icon={close} aria-hidden="true" />
                  </IonButton>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Excepción Ionic-first justificada: `ion-button` copia los aria-* al
                botón interno solo al cargar, así que `aria-expanded` quedaría
                desactualizado. El disparador del panel es un <button> nativo. */}
            <button
              ref={triggerRef}
              type="button"
              className="vita-entry-trigger"
              aria-haspopup="dialog"
              aria-expanded={open ? "true" : "false"}
              aria-label={label}
              onClick={onOpen}
            >
              <span className="vita-orb">
                <span className={`vita-orb-halo${reduced ? "" : " is-breathing"}`} aria-hidden="true" />
                <img src={vitaPortrait} alt="" aria-hidden="true" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

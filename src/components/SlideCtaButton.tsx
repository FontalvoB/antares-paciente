import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IonIcon, IonSpinner } from "@ionic/react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/**
 * Botón CTA deslizable (slide-to-act) para la autenticación.
 *
 * El diseño anterior (píldora con chevrons "»»»") sugería un gesto de
 * deslizar pero solo respondía al clic. Este componente implementa el
 * gesto real: arrastrar el pulgar hacia la derecha hasta la zona de
 * acción dispara `onAct`; si no supera el umbral, regresa con resorte.
 *
 * Accesibilidad: el deslizar es una mejora, nunca un requisito (WCAG 2.1,
 * excepción de gestos complejos) — el clic en cualquier parte del track y el
 * Enter/Space del <button> también ejecutan la acción. Touch-action pan-y
 * preserva el scroll vertical de la página desde el pulgar.
 */
interface Props {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  /** Icono Ionicons del pulgar (escudo, candado, flecha…). */
  icon: string;
  onAct: () => void;
  ariaLabel?: string;
  style?: CSSProperties;
}

const THUMB = 56;
const PAD = 3;
/** Umbral de confirmación: 65% del recorrido disponible o 140px. */
const MIN_TRAVEL = 140;

export function SlideCtaButton({
  label,
  busyLabel,
  busy,
  disabled,
  icon,
  onAct,
  ariaLabel,
  style,
}: Props) {
  const trackRef = useRef<HTMLButtonElement>(null);
  const [maxX, setMaxX] = useState(160);
  const x = useMotionValue(0);
  const fillScale = useTransform(x, [0, Math.max(maxX, 1)], [0.06, 1]);
  const chevOpacity = useTransform(x, [0, Math.max(maxX, 1)], [0.35, 1]);
  const canInteract = !busy && !disabled;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () =>
      setMaxX(Math.max(track.clientWidth - THUMB - PAD * 2, 24));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  function fire() {
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    onAct();
  }

  function onDragEnd(_: unknown, info: { offset: { x: number } }) {
    const threshold = Math.max(maxX * 0.65, MIN_TRAVEL);
    if (canInteract && info.offset.x >= Math.min(threshold, maxX)) {
      fire();
    }
    x.set(0);
  }

  return (
    <div className="slide-cta" style={style}>
      <button
        ref={trackRef}
        type="button"
        className="slide-cta-track"
        disabled={!canInteract}
        aria-label={ariaLabel ?? label}
        onClick={() => canInteract && fire()}
      >
        <motion.span
          className="slide-cta-fill"
          style={{ scaleX: fillScale }}
          aria-hidden="true"
        />
        <span className="slide-cta-label" aria-hidden="true">
          {busy ? busyLabel : label}
        </span>
        <motion.span
          className="slide-cta-chevrons"
          style={{ opacity: chevOpacity }}
          aria-hidden="true"
        >
          <IonIcon icon={icon} />
          <IonIcon icon={icon} />
          <IonIcon icon={icon} />
        </motion.span>
        <motion.div
          className="slide-cta-thumb"
          style={{ x }}
          drag={canInteract ? "x" : false}
          dragConstraints={{ left: 0, right: maxX }}
          dragElastic={0.02}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          whileTap={canInteract ? { scale: 1.06 } : undefined}
        >
          {busy ? (
            <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
          ) : (
            <IonIcon icon={icon} />
          )}
        </motion.div>
      </button>
    </div>
  );
}

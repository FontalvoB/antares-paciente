import { useCallback, useEffect, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { arrowForward } from "ionicons/icons";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/**
 * Carrusel coverflow de los módulos del inicio.
 *
 * La tarjeta central va de frente y las vecinas giran sobre su eje Y hacia el
 * fondo, así que las opciones se ven rotar de verdad y no solo desplazarse.
 * Se maneja con el dedo (arrastre con inercia), avanza sola y tiene puntos
 * para saltar a cualquier módulo sin recorrer los intermedios — con una sola
 * tarjeta legible a la vez, ese salto directo es lo que evita que el carrusel
 * cueste más que la lista que sustituye.
 *
 * No hay componente Ionic equivalente (`IonSlides` se eliminó en Ionic 7 y no
 * hay reemplazo en 8.8), y Framer Motion ya está en el proyecto: no se añade
 * ninguna dependencia.
 */

export type CarouselModule = {
  id: string;
  title: string;
  sub: string;
  /** Dato vivo del módulo; se omite cuando no hay nada verdadero que mostrar. */
  data?: string;
  /** Token `--mod-*` del acento del módulo. */
  accent: string;
  icon: ReactNode;
  /** Texto del botón de la tarjeta activa. */
  cta: string;
};

/** Cuánto se espera tras tocar el carrusel antes de que vuelva a girar solo. */
const RESUME_MS = 9000;
const AUTOPLAY_MS = 5200;
/** Arrastre (px) o velocidad (px/s) a partir de los cuales se cambia de tarjeta. */
const SWIPE_DISTANCE = 52;
const SWIPE_VELOCITY = 420;

/** Distancia con signo entre dos posiciones del anillo (−n/2 … n/2). */
function ringOffset(index: number, active: number, count: number): number {
  let off = index - active;
  if (off > count / 2) off -= count;
  if (off < -count / 2) off += count;
  return off;
}

export function ModuleCarousel({
  modules,
  onSelect,
  label,
}: {
  modules: CarouselModule[];
  onSelect: (id: string) => void;
  label: string;
}) {
  const count = modules.length;
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const resumeAt = useRef(0);

  /** Cualquier gesto del usuario aplaza el autoavance. */
  const hold = useCallback(() => {
    resumeAt.current = Date.now() + RESUME_MS;
  }, []);

  const go = useCallback(
    (next: number) => {
      hold();
      setActive(((next % count) + count) % count);
    },
    [count, hold],
  );

  useEffect(() => {
    if (reduce || count < 2) return;
    const id = window.setInterval(() => {
      if (Date.now() < resumeAt.current || document.hidden) return;
      setActive((cur) => (cur + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, reduce]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragging(false);
    const { offset, velocity } = info;
    const far = Math.abs(offset.x) > SWIPE_DISTANCE;
    const fast = Math.abs(velocity.x) > SWIPE_VELOCITY;
    if (!far && !fast) {
      hold();
      return;
    }
    go(active + (offset.x < 0 ? 1 : -1));
  };

  return (
    <div
      className="mcar"
      role="group"
      aria-roledescription="carrusel"
      aria-label={label}
    >
      <motion.div
        className="mcar-stage"
        drag="x"
        dragSnapToOrigin
        dragElastic={0.14}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={() => {
          setDragging(true);
          hold();
        }}
        onDragEnd={onDragEnd}
      >
        {modules.map((m, i) => {
          const off = ringOffset(i, active, count);
          const abs = Math.abs(off);
          // Solo el centro y dos vecinas por lado: más allá no aportan
          // profundidad y sí nodos animándose fuera de vista.
          if (abs > 2) return null;
          const center = off === 0;
          return (
            <motion.button
              key={m.id}
              type="button"
              className={`mcar-card${center ? " is-active" : ""}`}
              style={{ "--a": m.accent, zIndex: 10 - abs } as CSSProperties}
              aria-hidden={!center}
              tabIndex={center ? 0 : -1}
              animate={{
                x: `${off * 54}%`,
                z: -abs * 95,
                rotateY: off * -34,
                scale: 1 - abs * 0.07,
                // Las vecinas se apagan: con dos tarjetas igual de brillantes
                // el ojo no sabe cuál está al frente.
                opacity: abs === 0 ? 1 : abs === 1 ? 0.62 : 0.26,
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 32, mass: 0.9 }
              }
              onClick={() => {
                // Arrastrar no debe abrir el módulo que quedó bajo el dedo.
                if (dragging) return;
                if (center) onSelect(m.id);
                else go(i);
              }}
            >
              <span className="mcar-halo" />
              <span className="mcar-art">{m.icon}</span>
              <span className="mcar-txt">
                <strong>{m.title}</strong>
                <small>{m.sub}</small>
              </span>
              {m.data ? <span className="mcar-data">{m.data}</span> : null}
              <span className="mcar-cta">
                {m.cta}
                <IonIcon icon={arrowForward} />
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="mcar-dots">
        {modules.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className={`mcar-dot${i === active ? " on" : ""}`}
            style={{ "--a": m.accent } as CSSProperties}
            aria-label={m.title}
            aria-current={i === active}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { arrowForward } from "ionicons/icons";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import type { CSSProperties } from "react";

/**
 * Carrusel coverflow de los módulos del inicio.
 *
 * La unidad que gira es la PÁGINA, no la tarjeta: cada página muestra dos
 * módulos y son las páginas las que rotan sobre su eje Y hacia el fondo, así
 * se ven dos opciones legibles a la vez sin perder el giro. Se maneja con el
 * dedo (arrastre con inercia), avanza sola y tiene puntos para saltar a
 * cualquier página sin recorrer las intermedias.
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
  /** Ilustración del módulo; va arriba del texto. */
  cover: string;
  /** Texto del botón de la tarjeta activa. */
  cta: string;
};

/** Módulos visibles a la vez. */
const PER_PAGE = 2;
/** Cuánto se espera tras tocar el carrusel antes de que vuelva a girar solo. */
const RESUME_MS = 9000;
const AUTOPLAY_MS = 5200;
/** Arrastre (px) o velocidad (px/s) a partir de los cuales se cambia de página. */
const SWIPE_DISTANCE = 52;
const SWIPE_VELOCITY = 420;

/** Distancia con signo entre dos posiciones del anillo (−n/2 … n/2). */
function ringOffset(index: number, active: number, count: number): number {
  let off = index - active;
  if (off > count / 2) off -= count;
  if (off < -count / 2) off += count;
  return off;
}

function paginate(items: CarouselModule[], size: number): CarouselModule[][] {
  const out: CarouselModule[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
  const pages = paginate(modules, PER_PAGE);
  const count = pages.length;
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
        {pages.map((page, i) => {
          const off = ringOffset(i, active, count);
          const abs = Math.abs(off);
          // Solo la página de frente y una vecina por lado: más allá no aportan
          // profundidad y sí nodos animándose fuera de vista.
          if (abs > 1) return null;
          const front = off === 0;
          return (
            <motion.div
              className={`mcar-page${front ? " is-active" : ""}`}
              key={page[0].id}
              style={{ zIndex: 10 - abs }}
              aria-hidden={!front}
              animate={{
                // Menos del 100%: la vecina asoma por el borde y es lo que
                // avisa de que la fila sigue (los puntos solos no bastan).
                x: `${off * 97}%`,
                z: -abs * 84,
                rotateY: off * -26,
                scale: 1 - abs * 0.08,
                // Las vecinas se apagan: con dos páginas igual de brillantes
                // el ojo no sabe cuál está al frente.
                opacity: front ? 1 : 0.5,
              }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 32, mass: 0.9 }
              }
            >
              {page.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="mcar-card"
                  style={{ "--a": m.accent } as CSSProperties}
                  tabIndex={front ? 0 : -1}
                  onClick={() => {
                    // Arrastrar no debe abrir el módulo que quedó bajo el dedo.
                    if (dragging) return;
                    if (front) onSelect(m.id);
                    else go(i);
                  }}
                >
                  <img className="mcar-cover" src={m.cover} alt="" aria-hidden="true" />
                  <span className="mcar-txt">
                    <strong>{m.title}</strong>
                    <small>{m.sub}</small>
                  </span>
                  {m.data ? <span className="mcar-data">{m.data}</span> : null}
                  <span className="mcar-cta">
                    {m.cta}
                    <IonIcon icon={arrowForward} />
                  </span>
                </button>
              ))}
            </motion.div>
          );
        })}
      </motion.div>

      <div className="mcar-dots">
        {pages.map((page, i) => (
          <button
            key={page[0].id}
            type="button"
            className={`mcar-dot${i === active ? " on" : ""}`}
            style={{ "--a": page[0].accent } as CSSProperties}
            aria-label={page.map((m) => m.title).join(", ")}
            aria-current={i === active}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}

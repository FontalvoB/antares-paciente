import { useCallback, useRef } from "react";

/** Ventana del doble toque (el doble clic nativo de iOS no es fiable aquí). */
export const DOUBLE_TAP_MS = 320;

/** ¿Dos toques dentro de la ventana? (estado = marca del toque anterior). */
export function isDoubleTap(
  lastTap: number,
  now: number,
  windowMs = DOUBLE_TAP_MS,
): boolean {
  return now - lastTap <= windowMs;
}

/**
 * Doble toque/doble clic. iOS no dispara `dblclick` de forma fiable sobre
 * elementos no interactivos, así que contamos los `click` con una ventana
 * corta: funciona igual con ratón (doble clic) y con el dedo (doble toque).
 */
export function useDoubleTap(onDoubleTap: () => void, windowMs = DOUBLE_TAP_MS) {
  const lastTap = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (isDoubleTap(lastTap.current, now, windowMs)) {
      lastTap.current = 0;
      onDoubleTap();
      return;
    }
    lastTap.current = now;
  }, [onDoubleTap, windowMs]);
}

import { Capacitor } from "@capacitor/core";

/**
 * Datos de viewport para decidir si la app debe ocupar toda la pantalla
 * (iPad/tablet) o el marco de teléfono de escritorio.
 */
export type ViewportProbe = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  innerWidth: number;
  innerHeight: number;
  isNative: boolean;
  coarsePointer: boolean;
  anyCoarsePointer: boolean;
  hasTouch: boolean;
};

/** Lado corto mínimo de un iPad (iPad mini ~744 CSS px). Los teléfonos, incluso en landscape, quedan por debajo. */
export const TABLET_SHORT_SIDE_MIN = 600;

/** Ancho/alto mínimo de viewport tipo tablet (iPad 9.7" = 768 CSS px). */
export const TABLET_LONG_SIDE_MIN = 768;

function isIpad(probe: ViewportProbe): boolean {
  if (/iPad/i.test(probe.userAgent)) return true;
  // iPadOS 13+ se presenta como Macintosh.
  if (probe.platform === "MacIntel" && probe.maxTouchPoints > 0) return true;
  if (/Macintosh/i.test(probe.userAgent) && probe.maxTouchPoints > 0) return true;
  return false;
}

function isAndroidTablet(probe: ViewportProbe): boolean {
  return /Android/i.test(probe.userAgent) && !/Mobile/i.test(probe.userAgent);
}

function isTabletSized(probe: ViewportProbe): boolean {
  const shortest = Math.min(probe.innerWidth, probe.innerHeight);
  const longest = Math.max(probe.innerWidth, probe.innerHeight);
  return shortest >= TABLET_SHORT_SIDE_MIN && longest >= TABLET_LONG_SIDE_MIN;
}

export function readViewportProbe(): ViewportProbe {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    isNative: Capacitor.isNativePlatform(),
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    anyCoarsePointer: window.matchMedia("(any-pointer: coarse)").matches,
    hasTouch: "ontouchstart" in window,
  };
}

/**
 * True cuando el viewport es de tablet (iPad, simulador, Android tablet):
 * la UI debe ir a pantalla completa, sin el marco de teléfono + fondo cosmos.
 *
 * Se decide por geometría (no por pointer:coarse): el Simulator de Xcode y
 * Safari RDM controlan el iPad con ratón y reportan pointer:fine.
 * Los teléfonos (lado corto menor a 600 CSS px) nunca entran, tampoco en landscape.
 */
export function isTabletLayout(probe: ViewportProbe = readViewportProbe()): boolean {
  if (isTabletSized(probe)) return true;

  const shortest = Math.min(probe.innerWidth, probe.innerHeight);
  if (shortest < TABLET_SHORT_SIDE_MIN) return false;

  if (isIpad(probe)) return true;
  if (isAndroidTablet(probe)) return true;
  if (probe.isNative) return true;
  if (probe.coarsePointer || probe.anyCoarsePointer) return true;
  if (probe.maxTouchPoints > 0) return true;
  if (probe.hasTouch) return true;
  return false;
}

/** Sincroniza la clase `is-tablet` en `<html>` (modales Ionic se portalean fuera del shell). */
export function applyTabletLayoutClass(tablet = isTabletLayout()): boolean {
  document.documentElement.classList.toggle("is-tablet", tablet);
  return tablet;
}

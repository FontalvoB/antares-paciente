import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect } from "react";
import {
  detectStatusBarBackground,
  toHex,
  toneForColor,
  type StatusBarTone,
} from "../utils/statusBarContrast";

/** Intervalo mínimo entre mediciones: los mutations del streaming del chat son muy frecuentes. */
const THROTTLE_MS = 160;

/**
 * Mantiene legibles la hora y la batería: mide el fondo que la app pinta bajo la
 * barra de estado y fija iconos oscuros (fondo claro) o claros (fondo oscuro).
 * Cubre cualquier pantalla u overlay sin que cada uno tenga que declararlo.
 * En web solo actualiza `theme-color` (barra del navegador / PWA).
 */
export function useStatusBarContrast(): void {
  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    let lastTone: StatusBarTone | null = null;
    let lastHex = "";
    let timer = 0;
    let disposed = false;

    const apply = () => {
      timer = 0;
      if (disposed) return;
      const background = detectStatusBarBackground();
      if (!background) return;
      const hex = toHex(background);
      if (hex !== lastHex) {
        lastHex = hex;
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", hex);
      }
      const tone = toneForColor(background);
      if (tone === lastTone) return;
      lastTone = tone;
      // Style.Light = texto oscuro para fondos claros; Style.Dark = texto claro.
      if (native)
        void StatusBar.setStyle({
          style: tone === "light" ? Style.Light : Style.Dark,
        }).catch(() => undefined);
    };
    const schedule = () => {
      if (!timer) timer = window.setTimeout(apply, THROTTLE_MS);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    for (const type of ["transitionend", "animationend"])
      document.addEventListener(type, schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("visibilitychange", schedule);
    // La primera pantalla anima su entrada: medir ya y de nuevo cuando se asiente.
    schedule();
    const settle = window.setTimeout(apply, 600);

    return () => {
      disposed = true;
      observer.disconnect();
      for (const type of ["transitionend", "animationend"])
        document.removeEventListener(type, schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("visibilitychange", schedule);
      window.clearTimeout(timer);
      window.clearTimeout(settle);
    };
  }, []);
}

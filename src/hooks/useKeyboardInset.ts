import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { useEffect } from "react";

/** Un viewport visible compartido por pantallas y overlays, sin descontar dos veces el teclado. */
export function useKeyboardInset(): void {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let fullHeight = window.innerHeight;
    let nativeHeight = 0;
    let disposed = false;
    let frame = 0;
    let settle = 0;
    const handles: Array<{ remove: () => void | Promise<void> }> = [];
    const parentOf = (el: HTMLElement): HTMLElement | null => {
      if (el.parentElement) return el.parentElement;
      const tree = el.getRootNode();
      return tree instanceof ShadowRoot && tree.host instanceof HTMLElement ? tree.host : null;
    };
    const focusedInput = (): HTMLElement | null => {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      if (!(el instanceof HTMLElement)) return null;
      return el.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="hidden"])') || el.isContentEditable ? el : null;
    };
    const revealFocused = () => {
      const input = focusedInput();
      if (!input || !root.classList.contains("kb-open")) return;
      // No usar scrollIntoView: también desplazaba el documento/WKWebView.
      // Se desplazan únicamente los contenedores del formulario, incluido IonContent.
      const field = input.closest<HTMLElement>(".field, .auth-field");
      for (let parent = parentOf(input); parent; parent = parentOf(parent)) {
        if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY) || parent.scrollHeight <= parent.clientHeight) continue;
        const box = parent.getBoundingClientRect();
        const target = field && field.offsetHeight + 20 <= parent.clientHeight ? field : input;
        const rect = target.getBoundingClientRect();
        const top = box.top + parent.clientTop + 10;
        const bottom = box.top + parent.clientTop + parent.clientHeight - 10;
        if (rect.bottom > bottom) parent.scrollTop += rect.bottom - bottom;
        else if (rect.top < top) parent.scrollTop -= top - rect.top;
      }
    };
    const update = () => {
      if (disposed) return;
      const layoutHeight = window.innerHeight;
      const atNormalScale = !viewport || Math.abs(viewport.scale - 1) < 0.01;
      const visualBottom = atNormalScale && viewport ? Math.min(layoutHeight, viewport.height + viewport.offsetTop) : layoutHeight;
      const resized = Math.max(0, fullHeight - layoutHeight);
      const editing = !!focusedInput();
      // No interpretar las barras del navegador ni el zoom como teclado.
      const open = nativeHeight > 0 || (editing && atNormalScale && (layoutHeight - visualBottom > 80 || resized > 80));
      if (!open) fullHeight = layoutHeight;
      const top = open && atNormalScale && viewport ? Math.max(0, viewport.offsetTop) : 0;
      // iOS resize:none superpone el teclado. Si Android ya redujo innerHeight,
      // usar esa altura sin volver a descontar keyboardHeight.
      const nativeBottom = nativeHeight > 0 && resized < 80 ? layoutHeight - nativeHeight : layoutHeight;
      const height = open ? Math.max(1, Math.min(visualBottom, nativeBottom) - top) : layoutHeight;
      root.style.setProperty("--app-viewport-height", `${height}px`);
      root.style.setProperty("--app-viewport-top", `${top}px`);
      root.classList.toggle("kb-open", open);
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(revealFocused); });
      settle = window.setTimeout(revealFocused, 250);
    };
    const focusChanged = () => { queueMicrotask(update); };
    const orientationChanged = () => { fullHeight = window.innerHeight; nativeHeight = 0; update(); };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", orientationChanged);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("focusout", focusChanged);
    if (Capacitor.isNativePlatform()) {
      const retain = async (promise: Promise<{ remove: () => Promise<void> }>) => {
        try {
          const handle = await promise;
          if (disposed) void handle.remove();
          else handles.push(handle);
        } catch { /* El viewport web sigue funcionando si el plugin no está disponible. */ }
      };
      const show = (info: { keyboardHeight: number }) => { nativeHeight = Math.max(0, info.keyboardHeight); update(); };
      const hide = () => { nativeHeight = 0; update(); };
      void retain(Keyboard.addListener("keyboardWillShow", show));
      void retain(Keyboard.addListener("keyboardDidShow", show));
      void retain(Keyboard.addListener("keyboardWillHide", hide));
      void retain(Keyboard.addListener("keyboardDidHide", hide));
    }
    update();
    return () => {
      disposed = true;
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", orientationChanged);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("focusout", focusChanged);
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      for (const handle of handles) void handle.remove();
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-top");
      root.classList.remove("kb-open");
    };
  }, []);
}

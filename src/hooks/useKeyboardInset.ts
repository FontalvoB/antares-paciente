import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { useEffect } from "react";

/**
 * Inset global del teclado virtual para layouts custom (sin IonContent).
 *
 * Se monta una sola vez en el Shell: en iOS el teclado no reduce el
 * webview y cubriría los footers en flujo (p. ej. el composer del chat).
 * Al mostrarse fija `--kb` en `:root` con la altura del teclado y marca
 * `kb-open` en `<html>` (para colapsar héroes decorativos vía CSS);
 * al ocultarse restaura ambos. Solo nativo — en web no hace nada.
 * Combinar con CSS, p. ej.:
 * `.screen.chat-kb { padding-bottom: var(--kb, 0px); }`.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const set = (px: number) => {
      const h = Math.max(px, 0);
      document.documentElement.style.setProperty("--kb", `${h}px`);
      document.documentElement.classList.toggle("kb-open", h > 0);
    };

    let disposed = false;
    const handles: Array<{ remove: () => void }> = [];

    // Tras elevar el layout, acerca el campo enfocado a la zona visible.
    const revealFocused = () => {
      requestAnimationFrame(() => {
        const el = document.activeElement;
        if (el instanceof HTMLElement) {
          try {
            el.scrollIntoView({ block: "nearest" });
          } catch {
            /* navegadores sin soporte: el inset basta */
          }
        }
      });
    };

    void (async () => {
      const show = await Keyboard.addListener("keyboardWillShow", (info) => {
        set(info.keyboardHeight);
        revealFocused();
      });
      const shown = await Keyboard.addListener("keyboardDidShow", (info) => {
        set(info.keyboardHeight);
        revealFocused();
      });
      const hide = await Keyboard.addListener("keyboardWillHide", () => {
        set(0);
      });
      const hidden = await Keyboard.addListener("keyboardDidHide", () => {
        set(0);
      });
      if (disposed) {
        void show.remove();
        void shown.remove();
        void hide.remove();
        void hidden.remove();
        return;
      }
      handles.push(show, shown, hide, hidden);
    })();

    return () => {
      disposed = true;
      for (const h of handles) {
        try {
          void h.remove();
        } catch {
          /* plugin ya liberado */
        }
      }
      set(0);
      document.documentElement.classList.remove("kb-open");
    };
  }, []);
}

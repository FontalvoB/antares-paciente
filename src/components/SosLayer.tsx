import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "../features/wellness/sos/wellness-sos.css";

/**
 * Capa global del SOS (KAN-137): portal directo a `<body>` con z-index por
 * encima de los overlays Ionic. Así ningún modal, teclado, video ni sesión de
 * ejercicio tapa el botón ni la cuenta regresiva, sea cual sea la pantalla.
 */
export function SosLayer({ children }: { children: ReactNode }) {
  return createPortal(<div className="sos-layer">{children}</div>, document.body);
}

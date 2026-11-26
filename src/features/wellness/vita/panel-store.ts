/**
 * Canal entre disparadores externos y el panel de Vita (KAN-167).
 *
 * Las pantallas con cabecera propia (`WellnessFrame` de KAN-121) ya tienen un
 * orbe de Vita. Para que haya UNA sola entrada, montan `VitaEntry` con
 * `docked={false}` (sin orbe flotante) y sus disparadores llaman a
 * `useVitaPanel().open()`. El estado abierto se publica para `aria-expanded`.
 * Estado solo en memoria; no se persiste nada.
 */
import { useSyncExternalStore } from "react";

type Listener = () => void;
let expanded = false;
const stateListeners = new Set<Listener>();
const openListeners = new Set<Listener>();

/** Lo llama `VitaEntry` al abrir o cerrar su panel. */
export function setVitaPanelExpanded(next: boolean): void {
  if (expanded === next) return;
  expanded = next;
  stateListeners.forEach((listener) => listener());
}

/** `VitaEntry` (sin orbe propio) se suscribe a las peticiones de apertura. */
export function onVitaPanelRequest(listener: Listener): () => void {
  openListeners.add(listener);
  return () => openListeners.delete(listener);
}

/** Pide abrir el panel montado. `false` si no hay ninguno escuchando. */
export function requestVitaPanel(): boolean {
  openListeners.forEach((listener) => listener());
  return openListeners.size > 0;
}

function subscribe(listener: Listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** Disparador externo del panel de Vita: `open()` y estado para `aria-expanded`. */
export function useVitaPanel() {
  const isExpanded = useSyncExternalStore(subscribe, () => expanded, () => false);
  return { open: requestVitaPanel, expanded: isExpanded };
}

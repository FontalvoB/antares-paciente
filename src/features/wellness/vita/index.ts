/**
 * API pública de Vita transversal (KAN-167): el componente `VitaEntry` y, para
 * cabeceras que ya tienen su propio orbe de Vita, `useVitaPanel` (abre el
 * mismo panel con `docked={false}` sin duplicar la entrada).
 */
export { VitaEntry } from "./VitaEntry";
export type { VitaEntryProps } from "./VitaEntry";
export { useVitaPanel } from "./panel-store";
export type { VitaModuleId, VitaModuleSummary } from "./context";

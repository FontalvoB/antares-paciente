import { useT } from "../i18n/I18nContext";

/** Nombre interno conservado por compatibilidad. Este pulso circular es
 * decorativo: no recibe muestras, no sigue la FC y no representa un ECG.
 * Ionic no tiene equivalente para este gráfico decorativo. */
export function EcgTrace({ height = 56, className }: {
  height?: number;
  className?: string;
}) {
  const t = useT();
  return <figure className={`decorative-measure-pulse ${className ?? ""}`}>
    <svg viewBox="0 0 240 64" style={{ width: "100%", height, display: "block" }} aria-hidden="true" focusable="false">
      <circle cx="120" cy="32" r="24" fill="none" stroke="currentColor" opacity=".2" />
      <circle className="decorative-measure-pulse-ring" cx="120" cy="32" r="16" fill="none" stroke="currentColor" />
      <circle cx="120" cy="32" r="6" fill="currentColor" />
    </svg>
    <figcaption>{t("Animación decorativa; no es un electrocardiograma (ECG).")}</figcaption>
  </figure>;
}

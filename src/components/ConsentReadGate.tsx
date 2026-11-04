import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IonIcon } from "@ionic/react";
import { checkmarkCircleOutline, readerOutline } from "ionicons/icons";
import { useT } from "../i18n/I18nContext";

/** Activa la aceptación solo cuando el final del documento resulta visible. */
export function ConsentReadGate({ children, onRead }: { children: ReactNode; onRead: () => void }) {
  const t = useT();
  const region = useRef<HTMLDivElement>(null);
  const notified = useRef(false);
  const [read, setRead] = useState(false);
  const checkEnd = useCallback(() => {
    const element = region.current;
    if (element && element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight <= 8 && !notified.current) {
      notified.current = true;
      setRead(true);
      onRead();
    }
  }, [onRead]);
  useEffect(() => {
    checkEnd();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(checkEnd);
    if (region.current) observer?.observe(region.current);
    return () => observer?.disconnect();
  }, [checkEnd]);
  return <>
    <div ref={region} className="onb-doc onb-consent-document" role="region" aria-label={t("Texto del consentimiento informado")} tabIndex={0} onScroll={checkEnd}>{children}</div>
    <p className={`onb-consent-status ${read ? "is-read" : ""}`} role="status"><IonIcon icon={read ? checkmarkCircleOutline : readerOutline} aria-hidden="true" />
      {t(read ? "Ya puedes aceptar el consentimiento." : "Lee hasta el final para habilitar la aceptación.")}
    </p>
  </>;
}

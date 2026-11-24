import { IonButton } from "@ionic/react";
import { useId } from "react";
import { useT } from "../../../../i18n/I18nContext";
import type { GateResult } from "../../domain";
import { issueParams } from "./steps/DataStep";

export function GateNotice({ gate, onGoToStep }: {
  gate: GateResult;
  onGoToStep: (step: number) => void;
}) {
  const t = useT();
  const noticeId = useId();
  if (gate.ok) return <></>;

  return (
    <div className="wl-gate">
      <p role="alert" className="wl-sub">{t("Revisa lo siguiente para poder generar tu plan.")}</p>
      {gate.issues.map((issue, index) => (
        <div className="wl-gate-issue" key={`${noticeId}-${index}`} style={{ flexWrap: "wrap", alignItems: "center" }}>
          <span id={`${noticeId}-${index}`} style={{ flex: "1 1 12rem" }}>
            {t(issue.messageKey, issueParams(issue))}
          </span>
          <IonButton
            type="button"
            fill="clear"
            style={{ minHeight: 44, "--color": "var(--teal-d)", "--background-focused": "var(--teal-l)" }}
            aria-describedby={`${noticeId}-${index}`}
            onClick={() => onGoToStep(issue.step)}
          >
            {t("Revisar")}
          </IonButton>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { IonAlert, IonButton, IonSpinner } from "@ionic/react";
import { useApp } from "../../context/AppContext";
import { isComingSoonTask } from "../../data/program";
import { useI18n } from "../../i18n/I18nContext";
import { getAccessToken } from "../../utils/authApi";
import { sessionUserId } from "../../utils/sessionIdentity";
import { ApiError } from "../../utils/apiClient";
import { queryClient } from "../../utils/queryClient";
import { toLocalISODate } from "../../utils/dates";
import { normalizeVitaActions, vitaDestinations } from "../../utils/vitaActions";
import type { VitaAction } from "../../utils/vitaActions";
import { confirmVitaCompletion, prepareVitaCompletion, readVitaContext } from "../../services/chat/vita-service";
import type { VitaTaskProposal } from "../../services/chat/vita-service";

export function VitaActions({ actions }: { actions: VitaAction[] }) {
  return normalizeVitaActions(actions).filter(action => action.localDate === toLocalISODate()).map(action =>
    <VitaActionControls key={`${action.destination}:${action.resourceId ?? ""}:${action.resourceVersion}`} action={action} />);
}

function VitaActionControls({ action }: { action: VitaAction }) {
  const { navigate, openTests, showToast } = useApp();
  const { t, lang } = useI18n();
  const destination = vitaDestinations[action.destination];
  const comingSoon = isComingSoonTask(destination.screen?.replace(/^program-/, "") ?? "");
  const [proposal, setProposal] = useState<VitaTaskProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recorded, setRecorded] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [dialogClosing, setDialogClosing] = useState(false);
  const owner = sessionUserId(getAccessToken());
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const controller = useRef(new AbortController());
  const inFlight = useRef(false);
  useEffect(() => {
    const active = new AbortController(); controller.current = active;
    setProposal(null); setBusy(false); setInvalid(false); setRecorded(false); setMessage("");
    return () => { active.abort(); };
  }, [owner]);
  const context = () => ({ owner, language: lang, signal: controller.current.signal });
  const current = () => !controller.current.signal.aborted && ownerRef.current === owner && sessionUserId(getAccessToken()) === owner;
  const fail = (error: unknown) => {
    if (!current()) return;
    const status = error instanceof ApiError ? error.status : 0;
    const stale = status === 409 || (error instanceof ApiError && error.code === "VITA_STALE") || (error instanceof Error && error.message === "VITA_STALE");
    if (stale || status === 403 || status === 404) { setProposal(null); setInvalid(true); }
    setMessage(stale ? "El contenido cambió. Vuelve a consultarle a Vita."
      : status === 403 ? "Ya no tienes autorización para esta acción."
      : status === 404 ? "Esta acción todavía no está disponible."
      : "No pudimos completar la solicitud. Inténtalo de nuevo.");
  };
  const run = async (operation: () => Promise<void>) => {
    if (inFlight.current || !current()) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try { await operation(); } catch (error) { fail(error); }
    finally { inFlight.current = false; if (current()) setBusy(false); }
  };
  const validate = async () => {
    const result = await readVitaContext(action, context());
    if (!current()) return false;
    if (result.status !== "ok" || result.resourceVersion !== action.resourceVersion || result.localDate !== action.localDate
      || !normalizeVitaActions(result.actions).some(currentAction => currentAction.destination === action.destination && currentAction.resourceId === action.resourceId)) throw new Error("VITA_STALE");
    return true;
  };
  const open = () => {
    if (comingSoon) {
      showToast(t("Esta actividad estará disponible próximamente."), "info");
      return;
    }
    void run(async () => {
      if (!await validate()) return;
      if (destination.screen) navigate(destination.screen); else openTests();
    });
  };
  const prepare = () => void run(async () => {
    if (!await validate()) return;
    const result = await prepareVitaCompletion(action, context());
    if (current()) setProposal(result);
  });
  const confirm = () => void run(async () => {
    if (!proposal) return;
    const result = await confirmVitaCompletion(proposal, context());
    if (!current()) return;
    if (!result?.taskCompletionId) throw new Error("VITA_CONFIRMATION_UNCERTAIN");
    setRecorded(true); setProposal(null); setMessage("Actividad registrada.");
    // Solo refrescar datos canónicos; jamás incrementar XP o completar en estado local.
    await queryClient.invalidateQueries({ queryKey: ["program"] });
    try { await readVitaContext(action, context(), false); }
    catch { if (current()) setMessage("Actividad registrada. No pudimos actualizar el programa; vuelve a abrirlo."); }
  });
  return <div className="vita-action-controls">
    <IonButton fill="outline" disabled={busy || invalid} onClick={open}>{t(destination.label)}</IonButton>
    {!comingSoon && (action.destination === "podcast" || action.destination === "exercise") && !recorded && <IonButton fill="clear" disabled={busy || invalid || dialogClosing} onClick={prepare}>{t("Registrar que terminé")}</IonButton>}
    {busy && <IonSpinner name="dots" aria-label={t("Comprobando…")} />}
    {message && <p role="status">{t(message)}</p>}
    <IonAlert isOpen={Boolean(proposal)} backdropDismiss={false}
      onWillDismiss={() => { setDialogClosing(true); setProposal(null); }} onDidDismiss={() => setDialogClosing(false)}
      header={t("Confirmar actividad")}
      message={t("¿Confirmas que terminaste esta actividad? Abrirla o reproducirla no la completa.")}
      buttons={[
        { text: t("Cancelar"), role: "cancel", handler: () => { if (inFlight.current) return false; setProposal(null); } },
        { text: t("Confirmar"), handler: () => { confirm(); return false; } },
      ]} />
  </div>;
}

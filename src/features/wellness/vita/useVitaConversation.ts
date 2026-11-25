/**
 * Conversación de Vita ligada a un módulo (KAN-167).
 *
 * Reutiliza el servicio de chat existente (`sendChatMessage`, mismo hilo
 * longitudinal y mismo agente Vita) y añade el contexto acotado del módulo.
 * El historial visible se guarda por usuario y módulo con la retención de
 * `history.ts`; acciones e ids de ejecución solo viven en memoria.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { CHAT_UNAVAILABLE_MESSAGE, sendChatMessage } from "../../../services/chat/chat-service";
import type { PendingVitaAttachment } from "../../../services/chat/vita-attachments-service";
import { isLegalConsentError, legalConsentMessage } from "../../../utils/legalConsents";
import type { VitaAction } from "../../../utils/vitaActions";
import { normalizeVitaActions } from "../../../utils/vitaActions";
import { checkinOwner } from "../checkin/checkin-store";
import { isSosUtterance, requestSos } from "../sos/sos-store";
import { buildVitaModuleContext } from "./context";
import type { VitaModuleId, VitaModuleSummary } from "./context";
import { clearVitaHistory, loadVitaHistory, saveVitaHistory, vitaOwnerKey } from "./history";
import type { VitaHistoryMessage } from "./history";

/** Mensaje en pantalla: el persistido más datos efímeros de la respuesta. */
export interface VitaLiveMessage extends VitaHistoryMessage {
  actions?: VitaAction[];
  executionId?: string;
  threadId?: string;
}

export function useVitaConversation(module: VitaModuleId, summary?: VitaModuleSummary) {
  const { user, threadId } = useApp();
  const { t, lang } = useI18n();
  const owner = checkinOwner(user);
  const [messages, setMessages] = useState<VitaLiveMessage[]>(() => loadVitaHistory(owner, module));
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const scope = `${vitaOwnerKey(owner)}:${module}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  // Cambio de cuenta o de módulo: se recarga su historial y se corta el turno en vuelo.
  useEffect(() => {
    const loaded = loadVitaHistory(owner, module);
    messagesRef.current = loaded;
    setMessages(loaded);
    setNotice("");
    return () => {
      request.current?.abort();
      request.current = null;
      setPending(false);
    };
  }, [owner, module]);

  const commit = useCallback((next: VitaLiveMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
    saveVitaHistory(owner, module, next);
  }, [owner, module]);

  const send = useCallback(async (text: string, attachments: PendingVitaAttachment[] = []) => {
    const value = text.trim();
    if (!value || request.current || !threadId) return false;
    // KAN-137: una petición de ayuda urgente abre el SOS sin esperar a la IA.
    if (isSosUtterance(value)) requestSos("chat");
    const controller = new AbortController();
    const sourceScope = scopeRef.current;
    request.current = controller;
    setPending(true);
    setNotice("");
    const userMessage: VitaLiveMessage = {
      id: crypto.randomUUID(), role: "user", text: value, at: new Date().toISOString(),
      ...(attachments.length ? { attachments: attachments.length } : {}),
    };
    commit([...messagesRef.current, userMessage]);
    const isCurrent = () => !controller.signal.aborted && scopeRef.current === sourceScope;
    try {
      const result = await sendChatMessage(
        value, threadId, lang,
        attachments.map((file) => file.attachmentId),
        controller.signal,
        { moduleContext: buildVitaModuleContext(module, summaryRef.current) },
      );
      if (!isCurrent()) return false;
      const answer = (result.answer ?? result.reply ?? "").trim();
      if (!answer) throw new Error("EMPTY_VITA_RESPONSE");
      commit([...messagesRef.current, {
        id: crypto.randomUUID(), role: "bot", text: answer, at: new Date().toISOString(),
        actions: normalizeVitaActions(result.actions),
        ...(result.executionId ? { executionId: result.executionId } : {}),
        threadId: result.threadId || threadId,
      }]);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      if (isLegalConsentError(error)) {
        // Sin autorización no hay turno: se retira el mensaje y se explica.
        commit(messagesRef.current.filter((message) => message.id !== userMessage.id));
        setNotice(t(legalConsentMessage(error)));
        return false;
      }
      commit([...messagesRef.current, {
        id: crypto.randomUUID(), role: "bot", text: t(CHAT_UNAVAILABLE_MESSAGE),
        at: new Date().toISOString(), failed: true,
      }]);
      return false;
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }, [commit, lang, module, t, threadId]);

  const clear = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setPending(false);
    clearVitaHistory(owner, module);
    messagesRef.current = [];
    setMessages([]);
    setNotice("");
  }, [owner, module]);

  return { messages, pending, notice, send, clear, threadId, scope };
}

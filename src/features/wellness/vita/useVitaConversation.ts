/**
 * Conversación de Vita ligada a un módulo (KAN-167).
 *
 * Reutiliza el servicio de chat existente (`sendChatMessage`, mismo agente
 * Vita y mismo formato de respuesta) y añade el contexto acotado del módulo.
 * El cliente NO envía `threadId`: el backend deriva el hilo estable del JWT,
 * así ningún identificador del paciente viaja en el cuerpo.
 *
 * El historial se guarda por cuenta (espacio opaco) y módulo con la retención
 * de `history.ts`; el texto libre del usuario y las acciones solo viven en
 * memoria.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { CHAT_UNAVAILABLE_MESSAGE, sendChatMessage } from "../../../services/chat/chat-service";
import type { PendingVitaAttachment } from "../../../services/chat/vita-attachments-service";
import type { UserProfile } from "../../../types";
import { getAccessToken } from "../../../utils/authApi";
import { isLegalConsentError, legalConsentMessage } from "../../../utils/legalConsents";
import { sessionUserId } from "../../../utils/sessionIdentity";
import type { VitaAction } from "../../../utils/vitaActions";
import { normalizeVitaActions } from "../../../utils/vitaActions";
import { isSosUtterance, requestSos } from "../sos/sos-store";
import { buildVitaModuleContext } from "./context";
import type { VitaModuleId, VitaModuleSummary } from "./context";
import { clearVitaHistory, loadVitaHistory, purgeVitaHistory, saveVitaHistory, vitaNamespace } from "./history";
import type { VitaHistoryMessage } from "./history";

/** Mensaje en pantalla: el persistido más datos efímeros de la sesión. */
export interface VitaLiveMessage extends VitaHistoryMessage {
  actions?: VitaAction[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let purgedThisSession = false;

/** Cuenta verificable: `sub` del JWT o un id UUID real. Nunca un fallback compartido. */
export function vitaAccountId(user: Partial<UserProfile> | undefined): string | null {
  const fromToken = sessionUserId(getAccessToken());
  if (fromToken) return fromToken;
  const id = user?.id?.trim();
  return id && UUID.test(id) ? id : null;
}

/** Identificadores del perfil que nunca deben quedar en el texto persistido. */
function profileTerms(user: Partial<UserProfile> | undefined): string[] {
  if (!user) return [];
  return [
    user.nombre, user.cedula, user.email, user.celular, user.ciudad,
    user.fam1Nombre, user.fam1Cel, user.fam1Email, user.fam2Nombre, user.fam2Cel, user.fam2Email,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export interface VitaSendInput {
  text: string;
  attachments?: PendingVitaAttachment[];
  /** Clave i18n de la sugerencia rápida (se persiste en lugar del texto). */
  promptKey?: string;
}

export function useVitaConversation(module: VitaModuleId, summary?: VitaModuleSummary) {
  const { user } = useApp();
  const { t, lang } = useI18n();
  const accountId = vitaAccountId(user);
  const namespace = useMemo(() => vitaNamespace(accountId), [accountId]);
  const terms = useMemo(() => profileTerms(user), [user]);
  const termsRef = useRef(terms);
  termsRef.current = terms;
  const [messages, setMessages] = useState<VitaLiveMessage[]>(() => {
    if (!purgedThisSession) {
      purgeVitaHistory();
      purgedThisSession = true;
    }
    return loadVitaHistory(namespace, module);
  });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const scope = `${namespace ?? "memoria"}:${module}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  // Cambio de cuenta o de módulo: se recarga su historial y se corta el turno en vuelo.
  useEffect(() => {
    const loaded = loadVitaHistory(namespace, module);
    messagesRef.current = loaded;
    setMessages(loaded);
    setNotice("");
    return () => {
      request.current?.abort();
      request.current = null;
      setPending(false);
    };
  }, [namespace, module]);

  const commit = useCallback((next: VitaLiveMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
    saveVitaHistory(namespace, module, next, termsRef.current);
  }, [namespace, module]);

  const send = useCallback(async ({ text, attachments = [], promptKey }: VitaSendInput) => {
    const value = text.trim();
    if (!value || request.current) return false;
    // KAN-137: una petición de ayuda urgente abre el SOS sin esperar a la IA.
    if (isSosUtterance(value)) requestSos("chat");
    const controller = new AbortController();
    const sourceScope = scopeRef.current;
    request.current = controller;
    setPending(true);
    setNotice("");
    const userMessage: VitaLiveMessage = {
      id: crypto.randomUUID(), role: "user", text: value, at: new Date().toISOString(),
      ...(promptKey ? { promptKey } : {}),
      ...(attachments.length ? { attachments: attachments.length } : {}),
    };
    commit([...messagesRef.current, userMessage]);
    const isCurrent = () => !controller.signal.aborted && scopeRef.current === sourceScope;
    try {
      const result = await sendChatMessage(
        value, "", lang,
        attachments.map((file) => file.attachmentId),
        controller.signal,
        { moduleContext: buildVitaModuleContext(module, summaryRef.current), omitThreadId: true },
      );
      if (!isCurrent()) return false;
      const answer = (result.answer ?? result.reply ?? "").trim();
      if (!answer) throw new Error("EMPTY_VITA_RESPONSE");
      commit([...messagesRef.current, {
        id: crypto.randomUUID(), role: "bot", text: answer, at: new Date().toISOString(),
        actions: normalizeVitaActions(result.actions),
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
  }, [commit, lang, module, t]);

  const clear = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setPending(false);
    clearVitaHistory(namespace, module);
    messagesRef.current = [];
    setMessages([]);
    setNotice("");
  }, [namespace, module]);

  return { messages, pending, notice, send, clear, scope, namespace };
}

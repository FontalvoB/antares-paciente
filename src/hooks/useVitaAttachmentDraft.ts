import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import {
  deleteVitaAttachment, uploadVitaAttachment, VITA_ATTACHMENT_LIMIT, VITA_ATTACHMENT_MAX_BYTES,
} from "../services/chat/vita-attachments-service";
import type { PendingVitaAttachment } from "../services/chat/vita-attachments-service";
import { ApiError } from "../utils/apiClient";
import { isLegalConsentError, legalConsentMessage, legalConsentOwner } from "../utils/legalConsents";

export function useVitaAttachmentDraft(threadId: string, scope: string, captureGuard?: () => () => boolean) {
  const { t, lang } = useI18n();
  const [files, setFiles] = useState<PendingVitaAttachment[]>([]);
  const [phase, setPhase] = useState<"picking" | "uploading" | "removing" | null>(null);
  const [error, setError] = useState("");
  const pending = useRef<PendingVitaAttachment[]>([]);
  const request = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    const owner = legalConsentOwner();
    setFiles([]);
    setPhase(null);
    setError("");
    return () => {
      request.current?.abort();
      request.current = null;
      for (const { attachmentId } of pending.current) {
        void deleteVitaAttachment(attachmentId, owner).catch(() => {}); // El vencimiento del servidor cubre la limpieza interrumpida.
      }
      pending.current = [];
    };
  }, [scope]);

  function replaceFiles(next: PendingVitaAttachment[]) {
    pending.current = next;
    setFiles(next);
  }

  async function attach(pick: () => File | null | Promise<File | null>) {
    if (request.current || pending.current.length >= VITA_ATTACHMENT_LIMIT) return;
    const controller = new AbortController();
    const owner = legalConsentOwner();
    const valid = captureGuard?.();
    const isCurrent = () => !controller.signal.aborted && (!valid || valid());
    request.current = controller;
    setPhase("picking");
    setError("");
    try {
      const file = await pick();
      if (!file || !isCurrent()) return;
      if (file.size > VITA_ATTACHMENT_MAX_BYTES) {
        setError(t("El adjunto excede el límite de 10 MB."));
        return;
      }
      setPhase("uploading");
      const result = await uploadVitaAttachment(file, threadId, lang, controller.signal);
      if (isCurrent()) replaceFiles([...pending.current, { ...result, name: file.name }]);
      else void deleteVitaAttachment(result.attachmentId, owner).catch(() => {});
    } catch (cause) {
      if (!isCurrent()) return;
      if (isLegalConsentError(cause)) setError(t(legalConsentMessage(cause)));
      else if (cause instanceof ApiError && cause.status === 413) setError(t("El adjunto excede el tamaño permitido por Vita."));
      else if (cause instanceof ApiError && cause.status === 415) setError(t("Tipo de archivo no permitido. Solo se aceptan JPEG, PNG o PDF."));
      else if (cause instanceof ApiError && cause.status === 422) setError(t("Vita rechazó el archivo. Prueba con una imagen legible o un PDF válido y sin contraseña."));
      else if (cause instanceof ApiError && [502, 503].includes(cause.status)) setError(t("El servicio de adjuntos de Vita no está disponible. Inténtalo de nuevo."));
      else setError(t("No se pudo subir el adjunto. Inténtalo de nuevo."));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPhase(null);
      }
    }
  }

  async function remove(attachmentId: string) {
    if (request.current || !pending.current.some(file => file.attachmentId === attachmentId)) return;
    const controller = new AbortController();
    request.current = controller;
    setPhase("removing");
    setError("");
    try {
      await deleteVitaAttachment(attachmentId);
      if (!controller.signal.aborted) replaceFiles(pending.current.filter(file => file.attachmentId !== attachmentId));
    } catch {
      if (!controller.signal.aborted) setError(t("No se pudo quitar el adjunto. Inténtalo de nuevo."));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPhase(null);
      }
    }
  }

  function take() {
    if (request.current) return null;
    const ready = pending.current.filter(file => Date.parse(file.expiresAt) > Date.now());
    if (ready.length !== pending.current.length) {
      setError(t("Uno de los adjuntos ya no está disponible. Vuelve a adjuntarlo."));
      replaceFiles(ready);
      return null;
    }
    replaceFiles([]);
    setError("");
    return ready;
  }

  return { files, phase, error, attach, remove, take, cancelUpload: () => request.current?.abort() };
}

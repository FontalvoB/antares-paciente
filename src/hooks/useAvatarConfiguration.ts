import { useEffect, useRef, useState } from "react";
import type { AvatarConfiguration } from "../components/avatar/avatar-state";
import {
  getAvatarConfiguration,
  putAvatarConfiguration,
} from "../services/avatar-configuration-service";
import { getAccessToken, onSessionInvalid } from "../utils/authApi";

interface Result {
  owner: string | null;
  value: AvatarConfiguration | null;
  status: "loading" | "ready" | "error" | "session-required";
  dirty: boolean;
  saving: boolean;
  saveError: boolean;
}
const initial: Result = {
  owner: null,
  value: null,
  status: "loading",
  dirty: false,
  saving: false,
  saveError: false,
};

/** Preferencias por sesión. Las respuestas antiguas nunca sustituyen cambios posteriores. */
export function useAvatarConfiguration(sessionReady = true) {
  const token = getAccessToken();
  const enabled = sessionReady && Boolean(token);
  const [result, setResult] = useState<Result>(initial);
  const [attempt, setAttempt] = useState(0);
  const revision = useRef(0),
    saving = useRef(false);
  const epoch = useRef(0);
  const saveController = useRef<AbortController | null>(null);
  useEffect(
    () =>
      onSessionInvalid(() =>
        setResult({ ...initial, status: "session-required" }),
      ),
    [],
  );
  useEffect(() => {
    const generation = ++epoch.current;
    const controller = new AbortController();
    setResult({
      ...initial,
      owner: token,
      status: enabled ? "loading" : "session-required",
    });
    revision.current = 0;
    saving.current = false;
    if (enabled)
      void getAvatarConfiguration(controller.signal)
        .then((value) => {
          if (generation === epoch.current && getAccessToken() === token)
            setResult({ ...initial, owner: token, value, status: "ready" });
        })
        .catch(() => {
          if (
            !controller.signal.aborted &&
            generation === epoch.current &&
            getAccessToken() === token
          )
            setResult({ ...initial, owner: token, status: "error" });
        });
    // Se cancela deliberadamente la escritura vigente, no la que existía al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      epoch.current++;
      controller.abort();
      saveController.current?.abort();
    };
  }, [token, enabled, attempt]);
  const current = !sessionReady
    ? initial
    : !enabled
      ? { ...initial, status: "session-required" as const }
      : result.owner !== token
        ? initial
        : result;
  return {
    ...current,
    retry: () => setAttempt((a) => a + 1),
    change: (value: AvatarConfiguration) => {
      if (!current.value) return;
      revision.current++;
      setResult((r) => ({ ...r, value, dirty: true, saveError: false }));
    },
    save: async () => {
      if (!current.value || saving.current || !current.dirty) return;
      const owner = token,
        generation = epoch.current,
        savedRevision = revision.current;
      saving.current = true;
      const controller = new AbortController();
      saveController.current = controller;
      setResult((r) => ({ ...r, saving: true, saveError: false }));
      try {
        await putAvatarConfiguration(current.value, controller.signal);
        if (generation === epoch.current && getAccessToken() === owner)
          setResult((r) => ({
            ...r,
            saving: false,
            dirty: revision.current !== savedRevision,
          }));
      } catch {
        if (generation === epoch.current && getAccessToken() === owner)
          setResult((r) => ({ ...r, saving: false, saveError: true }));
      } finally {
        if (generation === epoch.current) saving.current = false;
      }
    },
  };
}

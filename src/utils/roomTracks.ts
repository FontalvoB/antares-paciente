/** Twilio adjunta medios a audio/video, nunca al div que contiene el tile. */
export interface AttachableRoomTrack {
  kind?: string;
  isEnabled?: boolean;
  isSwitchedOff?: boolean;
  on?(event: string, listener: () => void): void;
  off?(event: string, listener: () => void): void;
  attach(): HTMLMediaElement;
  detach(): HTMLMediaElement[];
}

const attachments = new WeakMap<object, HTMLMediaElement>();

export function attachRoomTrack(
  track: AttachableRoomTrack,
  container: HTMLElement | null,
  local = false,
): boolean {
  if (!container || (local && track.kind === "audio")) return false;
  let media = attachments.get(track);
  if (!media) {
    media = track.attach();
    media.autoplay = true;
    media.muted = local || track.kind === "video";
    if (media.tagName === "VIDEO") media.setAttribute("playsinline", "");
    attachments.set(track, media);
  }
  if (media.parentElement !== container) container.appendChild(media);
  return track.kind === "video" && track.isEnabled !== false;
}

export function detachRoomTrack(track: AttachableRoomTrack): void {
  track.detach().forEach(media => media.remove());
  attachments.delete(track);
}

/** Una cámara puede estar suscrita antes de encenderse; el placeholder sigue su estado real. */
export function observeRoomVideoTrack(track: AttachableRoomTrack, changed: () => void): () => void {
  if (track.kind !== "video") return () => {};
  const events = ["enabled", "disabled", "started", "switchedOn", "switchedOff"];
  events.forEach(event => track.on?.(event, changed));
  return () => events.forEach(event => track.off?.(event, changed));
}

export function roomVideoIsVisible(track: AttachableRoomTrack): boolean {
  return track.kind === "video" && track.isEnabled !== false && track.isSwitchedOff !== true;
}

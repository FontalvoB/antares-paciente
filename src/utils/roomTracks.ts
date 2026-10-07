/** Twilio adjunta medios a audio/video, nunca al div que contiene el tile. */
export interface AttachableRoomTrack {
  kind?: string;
  isEnabled?: boolean;
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
    media.muted = local;
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

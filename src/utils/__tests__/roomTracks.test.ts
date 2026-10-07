import { describe, expect, it, vi } from "vitest";
import { attachRoomTrack, detachRoomTrack } from "../roomTracks";

describe("room track rendering", () => {
  it("appends the SDK video element, sets inline playback and avoids duplicate attachments", () => {
    const container = document.createElement("div");
    const media = document.createElement("video");
    const track = { kind: "video", attach: vi.fn(() => media), detach: vi.fn(() => [media]) };
    expect(attachRoomTrack(track, container, true)).toBe(true);
    attachRoomTrack(track, container, true);
    expect(track.attach).toHaveBeenCalledExactlyOnceWith();
    expect(container.children).toHaveLength(1);
    expect(media.muted).toBe(true);
    expect(media.hasAttribute("playsinline")).toBe(true);
    detachRoomTrack(track);
    expect(container.children).toHaveLength(0);
  });

  it("plays remote audio and skips local microphone feedback", () => {
    const container = document.createElement("div");
    const media = document.createElement("audio");
    const track = { kind: "audio", attach: vi.fn(() => media), detach: () => [media] };
    attachRoomTrack(track, container, true);
    expect(track.attach).not.toHaveBeenCalled();
    attachRoomTrack(track, container);
    expect(media.parentElement).toBe(container);
    expect(media.muted).toBe(false);
  });
});

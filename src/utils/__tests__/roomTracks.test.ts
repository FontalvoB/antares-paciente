import { describe, expect, it, vi } from "vitest";
import { attachRoomTrack, detachRoomTrack, observeRoomVideoTrack, roomVideoIsVisible } from "../roomTracks";

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

it("updates remote video visibility after enabling the camera and releases listeners", () => {
  const listeners = new Map<string, () => void>();
  const track = { kind: "video", isEnabled: false, isSwitchedOff: false,
    attach: () => document.createElement("video"), detach: () => [],
    on: vi.fn((name: string, listener: () => void) => { listeners.set(name, listener); }),
    off: vi.fn((name: string) => { listeners.delete(name); }),
  };
  const changed = vi.fn();
  const dispose = observeRoomVideoTrack(track, changed);
  expect(roomVideoIsVisible(track)).toBe(false);
  track.isEnabled = true;
  listeners.get("enabled")?.();
  expect(changed).toHaveBeenCalledOnce();
  expect(roomVideoIsVisible(track)).toBe(true);
  track.isSwitchedOff = true;
  expect(roomVideoIsVisible(track)).toBe(false);
  dispose();
  expect(listeners.size).toBe(0);
});

it("mutes remote video elements without muting separate remote audio", () => {
  const container = document.createElement("div");
  const media = document.createElement("video");
  const track = {kind: "video", attach: () => media, detach: () => [media]};
  attachRoomTrack(track, container);
  expect(media.muted).toBe(true);
  expect(media.autoplay).toBe(true);
});

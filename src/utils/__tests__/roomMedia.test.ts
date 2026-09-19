import { describe, expect, it, vi } from "vitest";
import {
  canJoinWithMedia,
  classifyMediaError,
  initialMediaProbe,
  mediaPlan,
  mediaStatusLabelKey,
  probeRoomMedia,
  type MediaDevicesLike,
} from "../roomMedia";

function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] }, stop };
}

function devicesWith(
  getUserMedia: MediaDevicesLike["getUserMedia"],
  kinds: string[] = ["videoinput", "audioinput"],
): MediaDevicesLike {
  return {
    enumerateDevices: async () => kinds.map((kind) => ({ kind })),
    getUserMedia,
  };
}

describe("probeRoomMedia", () => {
  it("cámara y micrófono listos: suena getUserMedia y detiene los tracks", async () => {
    const { stream, stop } = fakeStream();
    const devices = devicesWith(vi.fn().mockResolvedValue(stream));

    const result = await probeRoomMedia({ mediaDevices: devices, secure: true });

    expect(result).toEqual({ camera: "ready", microphone: "ready" });
    expect(devices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(devices.getUserMedia).toHaveBeenNthCalledWith(1, { video: true });
    expect(devices.getUserMedia).toHaveBeenNthCalledWith(2, { audio: true });
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("sin videoinput: cámara ausente sin sondear video", async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const devices = devicesWith(getUserMedia, ["audioinput"]);

    const result = await probeRoomMedia({ mediaDevices: devices, secure: true });

    expect(result).toEqual({ camera: "no-device", microphone: "ready" });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it("permiso denegado en camera: no se sondea la cámara", async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const devices: MediaDevicesLike = {
      ...devicesWith(getUserMedia),
      permissions: {
        query: vi.fn(async ({ name }) => ({
          state: name === "camera" ? "denied" : "prompt",
        })),
      },
    };

    const result = await probeRoomMedia({ mediaDevices: devices, secure: true });

    expect(result).toEqual({ camera: "denied", microphone: "ready" });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it("NotAllowedError / NotReadableError se clasifican", async () => {
    const notAllowed = Object.assign(new Error("denied"), {
      name: "NotAllowedError",
    });
    const devices = devicesWith(vi.fn().mockRejectedValue(notAllowed));
    expect(await probeRoomMedia({ mediaDevices: devices, secure: true })).toEqual(
      { camera: "denied", microphone: "denied" },
    );

    const inUse = Object.assign(new Error("busy"), { name: "NotReadableError" });
    const busy = devicesWith(vi.fn().mockRejectedValue(inUse));
    expect(await probeRoomMedia({ mediaDevices: busy, secure: true })).toEqual({
      camera: "in-use",
      microphone: "in-use",
    });
  });

  it("sin getUserMedia → unsupported; contexto inseguro → insecure (sin sondear)", async () => {
    const getUserMedia = vi.fn();
    const devices: MediaDevicesLike = { getUserMedia };

    expect(
      await probeRoomMedia({ mediaDevices: {}, secure: true }),
    ).toEqual({ camera: "unsupported", microphone: "unsupported" });
    expect(await probeRoomMedia({ mediaDevices: devices, secure: false })).toEqual(
      { camera: "insecure", microphone: "insecure" },
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("enumerateDevices que falla no rompe la sonda", async () => {
    const { stream } = fakeStream();
    const devices: MediaDevicesLike = {
      enumerateDevices: async () => {
        throw new Error("sin permiso");
      },
      getUserMedia: vi.fn().mockResolvedValue(stream),
    };
    expect(await probeRoomMedia({ mediaDevices: devices, secure: true })).toEqual(
      { camera: "ready", microphone: "ready" },
    );
  });
});

describe("initialMediaProbe", () => {
  it("resuelve unsupported/insecure de forma sincrónica", () => {
    expect(initialMediaProbe({ mediaDevices: {}, secure: true })).toEqual({
      camera: "unsupported",
      microphone: "unsupported",
    });
    expect(
      initialMediaProbe({
        mediaDevices: devicesWith(vi.fn()),
        secure: false,
      }),
    ).toEqual({ camera: "insecure", microphone: "insecure" });
  });

  it("con getUserMedia queda en checking (null)", () => {
    expect(
      initialMediaProbe({ mediaDevices: devicesWith(vi.fn()), secure: true }),
    ).toBeNull();
  });
});

describe("canJoinWithMedia / mediaPlan", () => {
  it("no bloquea en checking ni en unsupported/insecure", () => {
    expect(canJoinWithMedia(null)).toBe(true);
    expect(
      canJoinWithMedia({ camera: "unsupported", microphone: "unsupported" }),
    ).toBe(true);
    expect(canJoinWithMedia({ camera: "insecure", microphone: "insecure" })).toBe(
      true,
    );
  });

  it("bloquea solo cuando ambos dispositivos fallan de forma recuperable", () => {
    expect(canJoinWithMedia({ camera: "denied", microphone: "denied" })).toBe(
      false,
    );
    expect(canJoinWithMedia({ camera: "no-device", microphone: "in-use" })).toBe(
      false,
    );
    expect(canJoinWithMedia({ camera: "no-device", microphone: "ready" })).toBe(
      true,
    );
    expect(canJoinWithMedia({ camera: "ready", microphone: "denied" })).toBe(
      true,
    );
  });

  it("el plan degrada a audio si la cámara no está lista", () => {
    expect(mediaPlan(null)).toEqual({ audio: true, video: true });
    expect(mediaPlan({ camera: "ready", microphone: "ready" })).toEqual({
      audio: true,
      video: true,
    });
    expect(mediaPlan({ camera: "no-device", microphone: "ready" })).toEqual({
      audio: true,
      video: false,
    });
    expect(mediaPlan({ camera: "denied", microphone: "denied" })).toEqual({
      audio: false,
      video: false,
    });
    expect(
      mediaPlan({ camera: "unsupported", microphone: "unsupported" }),
    ).toEqual({ audio: true, video: true });
  });
});

describe("classifyMediaError / mediaStatusLabelKey", () => {
  it("clasifica por nombre de error", () => {
    expect(classifyMediaError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyMediaError({ name: "SecurityError" })).toBe("denied");
    expect(classifyMediaError({ name: "NotFoundError" })).toBe("no-device");
    expect(classifyMediaError({ name: "OverconstrainedError" })).toBe(
      "no-device",
    );
    expect(classifyMediaError({ name: "NotReadableError" })).toBe("in-use");
    expect(classifyMediaError({ name: "AbortError" })).toBe("in-use");
    expect(classifyMediaError({ name: "TypeError" })).toBe("unsupported");
    expect(classifyMediaError(new Error("raro"))).toBe("error");
  });

  it("etiqueta cámara y micrófono por estado", () => {
    expect(mediaStatusLabelKey("ready", "camera")).toBe("Cámara lista");
    expect(mediaStatusLabelKey("ready", "microphone")).toBe("Micrófono listo");
    expect(mediaStatusLabelKey("denied", "camera")).toBe(
      "Permiso de cámara denegado",
    );
    expect(mediaStatusLabelKey("no-device", "microphone")).toBe(
      "No se detectó micrófono",
    );
    expect(mediaStatusLabelKey("checking", "camera")).toBe("Comprobando…");
  });
});

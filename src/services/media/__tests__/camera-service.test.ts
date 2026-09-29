import { afterEach, describe, expect, it, vi } from "vitest";
import { captureChatImage } from "../camera-service";

/**
 * REQ-AG-03 (change agente-asistente-citas, D3): captura conversacional con
 * @capacitor/camera — ActionSheet (cámara/galería), salida Base64 JPEG
 * comprimida, dataUrl para la miniatura y cancelación limpia (null).
 */

const getPhotoMock = vi.fn();

vi.mock("@capacitor/camera", () => ({
  Camera: { getPhoto: (...args: unknown[]) => getPhotoMock(...(args as [])) },
  CameraResultType: { Base64: "base64" },
  CameraSource: { Prompt: "PROMPT" },
}));

describe("captureChatImage — selección conversacional de imágenes", () => {
  afterEach(() => {
    getPhotoMock.mockReset();
  });

  it("solicita foto con ActionSheet, base64, calidad 75 y límite de ancho", async () => {
    getPhotoMock.mockResolvedValueOnce({
      base64String: "aG9sYQ==",
      format: "jpeg",
    });

    const image = await captureChatImage();

    expect(getPhotoMock).toHaveBeenCalledTimes(1);
    const options = getPhotoMock.mock.calls[0]![0] as {
      source: string;
      quality: number;
      width: number;
      correctOrientation: boolean;
    };
    expect(options.source).toBe("PROMPT");
    expect(options.quality).toBe(75);
    expect(options.width).toBe(1280);
    expect(options.correctOrientation).toBe(true);

    expect(image?.base64).toBe("aG9sYQ==");
    expect(image?.mimeType).toBe("image/jpeg");
    expect(image?.dataUrl).toBe("data:image/jpeg;base64,aG9sYQ==");
  });

  it("formato png se reporta con MIME image/png", async () => {
    getPhotoMock.mockResolvedValueOnce({ base64String: "cG5n", format: "png" });

    const image = await captureChatImage();
    expect(image?.mimeType).toBe("image/png");
    expect(image?.dataUrl).toBe("data:image/png;base64,cG5n");
  });

  it("cancelación del usuario devuelve null sin lanzar", async () => {
    getPhotoMock.mockRejectedValueOnce(new Error("User cancelled"));

    await expect(captureChatImage()).resolves.toBeNull();
  });

  it("respuesta sin base64String devuelve null", async () => {
    getPhotoMock.mockResolvedValueOnce({
      base64String: undefined,
      format: "jpeg",
    });

    await expect(captureChatImage()).resolves.toBeNull();
  });
});

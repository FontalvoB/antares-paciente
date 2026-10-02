import { afterEach, describe, expect, it, vi } from "vitest";
import { captureChatImage, dataUrlToBlob } from "../camera-service";

/**
 * Tests de `captureChatImage` (REQ-AG-03) y del helper `dataUrlToBlob`
 * (BUG TestFlight P1: conversión dataUrl→Blob con type image/jpeg).
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

describe("dataUrlToBlob — conversión dataUrl → Blob (BUG TestFlight P1)", () => {
  it("decodifica base64 a los bytes exactos y declara el MIME del dataUrl", () => {
    // "hola" en base64 = bytes [104, 111, 108, 97]
    const blob = dataUrlToBlob("data:image/jpeg;base64,aG9sYQ==");

    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBe(4);
  });

  it("usa el MIME forzado (override) cuando se provee", () => {
    const blob = dataUrlToBlob("data:image/png;base64,cG5n", "image/jpeg");
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBe(3);
  });

  it("sin override respeta el MIME declarado (png)", () => {
    const blob = dataUrlToBlob("data:image/png;base64,cG5n");
    expect(blob.type).toBe("image/png");
  });

  it("bytes no truncados (payload con byte 0xFF > 127)", () => {
    // 0xFF 0x00: base64 = /wA=
    const blob = dataUrlToBlob("data:image/jpeg;base64,/wA=");
    expect(blob.size).toBe(2);
  });

  it("lanza error ante un dataUrl sin base64", () => {
    expect(() => dataUrlToBlob("data:image/jpeg,percent%20encoded")).toThrow(
      "data URL base64 inválida",
    );
  });

  it("lanza error ante una cadena que no es dataUrl", () => {
    expect(() => dataUrlToBlob("no-es-data-url")).toThrow(
      "data URL base64 inválida",
    );
  });

  it("blob legible como bytes originales (roundtrip)", async () => {
    const blob = dataUrlToBlob("data:image/jpeg;base64,aGVsbG8=");
    const text = await blob.text();
    expect(text).toBe("hello");
  });
});

import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import type { ChatImageAttachment } from "../../types";

/**
 * Convierte un data URL base64 (`data:<mime>;base64,<payload>`) a Blob.
 * Helper extraído para poder testearlo de forma unitaria.
 *
 * Contexto BUG TestFlight (P1): la captura de comida en iOS usaba
 * `CameraResultType.Uri` (archivo ORIGINAL, HEIC en iPhones modernos, sin
 * recompresión pese a `quality`) con filename forzado a `.jpg` → el backend
 * rechazaba con 400 (extensión no permitida / firma mágica). Con
 * `CameraResultType.DataUrl` + `quality < 100` el plugin transcodea a JPEG
 * garantizado (también para picks HEIC de galería) y este helper materializa
 * el payload como Blob con el MIME correcto.
 *
 * @param mimeTypeOverride fuerza el MIME del Blob (la captura de comida viaja
 *   como image/jpeg); si se omite se usa el MIME declarado en el data URL.
 */
export function dataUrlToBlob(
  dataUrl: string,
  mimeTypeOverride?: string,
): Blob {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) {
    throw new Error("data URL base64 inválida");
  }
  const mimeType = mimeTypeOverride ?? match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Captura de imagen conversacional (change agente-asistente-citas, D3).
 * Usa `@capacitor/camera` con ActionSheet nativa (cámara o galería),
 * salida Base64 JPEG y compresión fija para acotar el payload multimodal
 * (<1 MB). Desacoplado del flujo de exámenes de laboratorio.
 * Cancelación del usuario → null (nunca lanza).
 */
export async function captureChatImage(): Promise<ChatImageAttachment | null> {
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Base64,
      quality: 75,
      // Redimensionado nativo: limita el peso del base64 en el body.
      width: 1280,
      correctOrientation: true,
      promptLabelHeader: "Adjuntar imagen",
      promptLabelPhoto: "Galería",
      promptLabelPicture: "Cámara",
    });
    if (!photo.base64String) return null;
    // CameraResultType.Base64 transcodifica a JPEG salvo origen PNG; el
    // MIME correcto evita que el modelo multimodal descanse el bloque.
    const mimeType = photo.format === "png" ? "image/png" : "image/jpeg";
    return {
      base64: photo.base64String,
      mimeType,
      dataUrl: `data:${mimeType};base64,${photo.base64String}`,
    };
  } catch {
    // El usuario canceló (o permiso denegado): no romper el compositor.
    return null;
  }
}

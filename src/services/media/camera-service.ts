import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import type { ChatImageAttachment } from "../../types";

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

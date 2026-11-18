import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { registerPlugin } from "@capacitor/core";

export const MedicationLabel = registerPlugin<{
  read(options: { image: string }): Promise<{ text: string }>;
}>("MedicationLabel");

export async function captureMedicationLabel(): Promise<{ dataUrl: string; read: () => Promise<string> } | null> {
  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Base64,
    quality: 90,
    width: 1600,
    height: 1600,
    correctOrientation: true,
    saveToGallery: false,
  });
  const image = photo.base64String;
  if (!image) return null;
  const mime = photo.format === "png" ? "image/png" : "image/jpeg";
  return {
    dataUrl: `data:${mime};base64,${image}`,
    read: async () => (await MedicationLabel.read({ image })).text,
  };
}

function normalizeLabel(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/(\d),(?=\d)/g, "$1.")
    .replace(/(\d)\s*(mg|mcg|ug|ml|g|iu|ui)\b/g, "$1 $2")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/[^\p{L}\p{N}.]+/gu, " ").trim();
}

// Solo sugiere un nombre registrado. El paciente confirma el empaque y la toma.
export function matchesMedicationLabel(
  text: string,
  selected: { id: string; name: string },
  treatments: ReadonlyArray<{ id: string; name: string }>,
): boolean {
  const label = ` ${normalizeLabel(text)} `;
  const name = normalizeLabel(selected.name);
  const productName = name.replace(/\b\d+(?:\.\d+)? (?:mg|mcg|ug|ml|g|iu|ui)\b/g, "");
  if ((productName.match(/\p{L}/gu)?.length ?? 0) < 3 || !label.includes(` ${name} `)) return false;

  // Un nombre corto puede aparecer dentro de otro producto o concentración.
  return !treatments.some(treatment => {
    if (treatment.id === selected.id) return false;
    const other = normalizeLabel(treatment.name);
    return other.length >= 3 && label.includes(` ${other} `);
  });
}

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function savePrivacyFile(content: string, filename: string, mediaType: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const path = `${crypto.randomUUID()}-${filename}`;
    const { uri } = await Filesystem.writeFile({ path, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ files: [uri] });
    } finally {
      await Filesystem.deleteFile({ path, directory: Directory.Cache });
    }
    return;
  }

  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

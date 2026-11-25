import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { exportWellnessPrivacyAudit, wellnessDataKeys } from "./privacy-consent-store";

const MOCK_ACCOUNTS_KEY = "wellness.mock.accounts.v1";

function exportValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function createWellnessExport(actor: string, now = new Date(), storage = window.localStorage) {
  const data = Object.fromEntries(wellnessDataKeys(storage).flatMap((key) => {
    if (key === MOCK_ACCOUNTS_KEY) return [[key, { credentialsRedacted: true }]];
    const raw = storage.getItem(key);
    return raw === null ? [] : [[key, exportValue(raw)]];
  }));

  return JSON.stringify({
    metadata: { version: 1, scope: "device", exportedAt: now.toISOString() },
    data,
    privacyAudit: exportWellnessPrivacyAudit(actor, storage),
  }, null, 2);
}

export async function downloadWellnessExport(actor: string, now = new Date()): Promise<void> {
  const json = createWellnessExport(actor, now);
  const filename = `wellness-${now.toISOString().replaceAll(":", "-")}.json`;
  if (Capacitor.isNativePlatform()) {
    const path = `${crypto.randomUUID()}-${filename}`;
    const { uri } = await Filesystem.writeFile({ path, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ files: [uri] });
    } finally {
      await Filesystem.deleteFile({ path, directory: Directory.Cache });
    }
    return;
  }

  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
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

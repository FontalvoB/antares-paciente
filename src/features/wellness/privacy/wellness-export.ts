import { savePrivacyFile } from "./save-privacy-file";
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
  await savePrivacyFile(json, filename, "application/json");
}

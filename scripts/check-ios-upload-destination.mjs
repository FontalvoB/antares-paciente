// Transitional guard for the legacy TestFlight record (KAN-182).
import { readFileSync } from 'node:fs';

const legacyBundle = 'com.coppadresd.mobile';
const legacyGateway = 'https://erp.coppadresd.com';
const legacyWeb = ['https://coppadresd.com', 'https://www.coppadresd.com'];
const matches = (value, origin) => value === origin || value === origin + '/';

function rejectUpload(reason) {
  console.error('TestFlight upload blocked: ' + reason);
  process.exit(1);
}

const [, , manifestPath, bundleIdentifier] = process.argv;
if (bundleIdentifier !== legacyBundle) {
  rejectUpload('this lane is restricted to the legacy Copp Adresd bundle identifier');
}

let target;
try {
  target = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
  rejectUpload('the release destination manifest is missing or unreadable');
}

if (target?.schema !== 1 || target.mode !== 'production') {
  rejectUpload('the manifest does not describe a supported production build');
}

if (!matches(target.gateway, legacyGateway) ||
    !legacyWeb.some(origin => matches(target.web, origin))) {
  rejectUpload('the web payload does not target both legacy Copp Adresd origins');
}

console.log('Legacy TestFlight destination verified.');

/**
 * Protege `ios/App/CapApp-SPM/Package.swift` tras `npx cap sync`.
 *
 * En Windows, `cap sync`/`cap add` regenera las rutas de los plugins locales
 * con BACKSLASHES (`..\..\..\node_modules\...`). En Swift, `\.` es una secuencia
 * de escape inválida: el package NO compila y rompe el Archive de TestFlight.
 *
 * Este script reescribe cualquier `\` dentro de los literales `path: "..."` a
 * `/` (convención portable de SPM). Es best-effort: nunca falla el build.
 *
 * Uso: `node scripts/protect-package-swift.mjs` (wireado tras `npm run sync`).
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";

const FILE = "ios/App/CapApp-SPM/Package.swift";

/** Copia el google-services.json del cliente (raíz) a android/app/ si falta. */
function copyAndroidGoogleServices() {
  const src = "google-services.json";
  const destDir = "android/app";
  const dest = `${destDir}/google-services.json`;
  try {
    if (existsSync(src) && !existsSync(dest)) {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(src, dest);
      console.log(
        `[protect-package-swift] ${src} -> ${dest} (copia automática).`,
      );
    }
  } catch (err) {
    console.warn(
      `[protect-package-swift] copia android omitida: ${err?.message ?? err}`,
    );
  }
}

try {
  copyAndroidGoogleServices();
  const original = readFileSync(FILE, "utf8");
  const fixed = original.replace(/(path\s*:\s*"(?:[^"]*)")/g, (match) =>
    match.replace(/\\+/g, "/"),
  );
  if (fixed !== original) {
    writeFileSync(FILE, fixed, "utf8");
    console.log(
      "[protect-package-swift] Package.swift corregido (backslashes -> forward slashes).",
    );
  }
  // Sin else: el caso normal (nada que corregir) no imprime nada.
} catch (err) {
  // Best-effort: si el archivo no existe (proyecto sin iOS), no romper el sync.
  console.warn(`[protect-package-swift] omitido: ${err?.message ?? err}`);
}

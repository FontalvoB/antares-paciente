/**
 * Extensión nativa revisable para bluetooth-le 8.3.0. No depende de patch/git.
 * Verifica TODAS las entradas antes de escribir; una actualización del plugin
 * obliga a revisar el parche en vez de compilar silenciosamente sin el diario.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = resolve(root, "node_modules/@capacitor-community/bluetooth-le");
const patches = resolve(root, "patches/bluetooth-le-8.3.0");
const manifest = JSON.parse(readFileSync(resolve(patches, "manifest.json"), "utf8"));
const version = JSON.parse(readFileSync(resolve(plugin, "package.json"), "utf8")).version;
if (version !== manifest.version) {
  throw new Error(`El parche BLE requiere ${manifest.version}; se instaló ${version}. Revisar la extensión nativa antes de actualizar.`);
}
const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/\n?$/, "\n");
const hash = (text) => createHash("sha256").update(text).digest("hex");

// Aplicación estricta de los hunks: no hay fuzzy matching ni herramientas externas.
function applyFilePatch(original, sections, name) {
  const source = original.split("\n");
  const output = [];
  let cursor = 0;
  for (let index = 0; index < sections.length; index++) {
    const header = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(sections[index]);
    if (!header) continue;
    const start = Math.max(0, Number(header[1]) - 1);
    if (start < cursor) throw new Error(`Hunk solapado: ${name}`);
    output.push(...source.slice(cursor, start));
    cursor = start;
    for (index++; index < sections.length && !sections[index].startsWith("@@ "); index++) {
      const line = sections[index];
      if (line === "" && index === sections.length - 1) break;
      const prefix = line[0];
      if (prefix === " " || prefix === "-") {
        if (source[cursor] !== line.slice(1)) throw new Error(`Contexto del parche BLE cambió: ${name}:${cursor + 1}`);
        cursor++;
      }
      if (prefix === " " || prefix === "+") output.push(line.slice(1));
    }
    index--;
  }
  output.push(...source.slice(cursor));
  return output.join("\n");
}

const hunks = new Map();
let current;
for (const line of readFileSync(resolve(patches, "native.patch"), "utf8").split("\n")) {
  if (line.startsWith("--- a/")) { current = undefined; continue; }
  if (line.startsWith("+++ b/")) { current = line.slice(6); hunks.set(current, []); continue; }
  if (current) hunks.get(current).push(line);
}

const writes = [];
for (const entry of manifest.files) {
  const destination = resolve(plugin, entry.path);
  const original = normalize(readFileSync(destination, "utf8"));
  const digest = hash(original);
  if (digest === entry.after) continue;
  if (digest !== entry.before) throw new Error(`El archivo nativo BLE cambió fuera del parche: ${entry.path}. Reinstalar dependencias o revisar el parche.`);
  const updated = applyFilePatch(original, hunks.get(entry.path) ?? [], entry.path);
  if (hash(updated) !== entry.after) throw new Error(`Resultado inesperado del parche BLE: ${entry.path}`);
  writes.push([destination, updated]);
}
for (const [name, source] of Object.entries(manifest.additions)) {
  const destination = resolve(plugin, name);
  const updated = readFileSync(resolve(patches, "native", source), "utf8");
  if (existsSync(destination)) {
    if (normalize(readFileSync(destination, "utf8")) === normalize(updated)) continue;
    throw new Error(`La extensión nativa BLE fue modificada: ${name}`);
  }
  writes.push([destination, updated]);
}
if (process.argv.includes("--check") && writes.length > 0) {
  throw new Error(`La extensión BLE no está aplicada: ${writes.length} archivos pendientes. Ejecutar npm install con scripts habilitados.`);
}
if (!process.argv.includes("--check")) {
  for (const [destination, updated] of writes) {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, updated);
  }
}
console.log(`[BLE] Extensión nativa ${version} ${process.argv.includes("--check") ? "verificada" : "aplicada"} (${writes.length} archivos pendientes).`);

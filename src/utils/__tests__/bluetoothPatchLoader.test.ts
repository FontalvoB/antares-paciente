/// <reference types="node" />
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const loader = readFileSync(resolve("scripts/apply-bluetooth-patches.mjs"), "utf8");
const original = "uno\ndos\ntres\ncuatro\ncinco\nseis\n";
const expected = "uno\nnuevo\ndos\ntres\ncuatro\ncinco\nfinal\n";
const target = "ios/Sources/BluetoothLe/Device.swift";
const addition = "ios/Sources/BluetoothLe/Extension.swift";
const patch = [
  `--- a/${target}`, `+++ b/${target}`, "@@ -1,3 +1,4 @@", " uno", "+nuevo", " dos", " tres",
  "@@ -5,2 +6,2 @@", " cinco", "-seis", "+final", "",
].join("\n");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const roots: string[] = [];

function fixture(patchEnding = "\n", sourceEnding = "\n", configEnding = "\n") {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "antares-ble-loader-")); roots.push(root);
  const plugin = join(root, "node_modules/@capacitor-community/bluetooth-le");
  const patches = join(root, "patches/bluetooth-le-8.3.0");
  const write = (path: string, text: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
  const manifest = { version: "8.3.0", files: [{ path: target, before: hash(original), after: hash(expected) }], additions: { [addition]: "Extension.swift" } };
  write(join(root, "scripts/apply-bluetooth-patches.mjs"), loader);
  write(join(plugin, "package.json"), JSON.stringify({ version: "8.3.0" }));
  write(join(plugin, target), original.replace(/\n/g, sourceEnding));
  write(join(patches, "native.patch"), patch.replace(/\n/g, patchEnding));
  write(join(patches, "manifest.json"), JSON.stringify(manifest, null, 2).replace(/\n/g, configEnding));
  write(join(patches, "native/Extension.swift"), "// extensión de prueba\n".replace(/\n/g, configEnding));
  const run = (...args: string[]) => spawnSync(process.execPath, [join(root, "scripts/apply-bluetooth-patches.mjs"), ...args], { encoding: "utf8", cwd: root });
  return { root, plugin, patches, manifest, write, run };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    // Solo directorios temporales propios, sin enlaces ni rutas del workspace.
    if (dirname(root) !== realpathSync(tmpdir()) || !basename(root).startsWith("antares-ble-loader-") || realpathSync(root) !== root) throw new Error("Ruta temporal inesperada");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("loader del parche BLE", () => {
  it.each([
    ["LF", "\n", "\n", "\n"],
    ["CRLF en todo", "\r\n", "\r\n", "\r\n"],
    ["parche CRLF y plugin LF", "\r\n", "\n", "\n"],
    ["parche LF y plugin/manifest CRLF", "\n", "\r\n", "\r\n"],
  ])("aplica dos hunks, verifica e idempotente: %s", (_name, patchEnding, sourceEnding, configEnding) => {
    const f = fixture(patchEnding, sourceEnding, configEnding);
    const before = readFileSync(join(f.plugin, target));
    const checkBefore = f.run("--check");
    expect(checkBefore.status).toBe(1);
    expect(checkBefore.stderr).toContain("no está aplicada");
    expect(readFileSync(join(f.plugin, target))).toEqual(before);
    expect(existsSync(join(f.plugin, addition))).toBe(false);
    const apply = f.run();
    expect(apply.status, apply.stderr).toBe(0);
    expect(readFileSync(join(f.plugin, target), "utf8")).toBe(expected);
    expect(hash(readFileSync(join(f.plugin, target), "utf8"))).toBe(f.manifest.files[0].after);
    const added = readFileSync(join(f.plugin, addition));
    expect(f.run("--check").status).toBe(0);
    const again = f.run();
    expect(again.status, again.stderr).toBe(0);
    expect(again.stdout).toContain("0 archivos pendientes");
    expect(readFileSync(join(f.plugin, target), "utf8")).toBe(expected);
    expect(readFileSync(join(f.plugin, addition))).toEqual(added);
  });

  it("rechaza un resultado distinto sin cambiar el hash aprobado ni escribir", () => {
    const f = fixture();
    f.write(join(f.patches, "native.patch"), patch.replace("+final", "+otro"));
    expect(f.run().stderr).toContain("Resultado inesperado");
    expect(readFileSync(join(f.plugin, target), "utf8")).toBe(original);
    expect(existsSync(join(f.plugin, addition))).toBe(false);
  });

  it("rechaza contexto distinto aunque el archivo original tenga hash válido", () => {
    const f = fixture();
    f.write(join(f.patches, "native.patch"), patch.replace(" cinco", " otro"));
    expect(f.run().stderr).toContain("Contexto del parche BLE cambió");
    expect(readFileSync(join(f.plugin, target), "utf8")).toBe(original);
  });

  it("verifica todos los originales antes de escribir el primer archivo", () => {
    const f = fixture();
    const second = "Package.swift";
    f.write(join(f.plugin, second), "modificado\n");
    f.write(join(f.patches, "manifest.json"), JSON.stringify({ ...f.manifest, files: [...f.manifest.files, { path: second, before: hash("original\n"), after: hash("final\n") }] }));
    expect(f.run().stderr).toContain("cambió fuera del parche");
    expect(readFileSync(join(f.plugin, target), "utf8")).toBe(original);
    expect(existsSync(join(f.plugin, addition))).toBe(false);
  });

  it("mantiene el pin de versión", () => {
    const f = fixture();
    f.write(join(f.plugin, "package.json"), JSON.stringify({ version: "8.3.1" }));
    expect(f.run().stderr).toContain("se instaló 8.3.1");
    expect(readFileSync(join(f.plugin, target), "utf8")).toBe(original);
  });

  it("detecta manipulación posterior de una adición nativa", () => {
    const f = fixture(); expect(f.run().status).toBe(0);
    f.write(join(f.plugin, addition), "// contenido ajeno\n");
    const checked = f.run("--check");
    expect(checked.status).toBe(1);
    expect(checked.stderr).toContain("extensión nativa BLE fue modificada");
    expect(readFileSync(join(f.plugin, addition), "utf8")).toBe("// contenido ajeno\n");
  });
});

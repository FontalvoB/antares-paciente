#!/usr/bin/env node
/**
 * i18n-scan — scans all t() calls in the codebase and reports keys
 * missing from en.json. Catches single, double, and backtick quotes.
 *
 * Usage:  node scripts/i18n-scan.mjs [--json]
 */
import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const EN_PATH = join(ROOT, "src", "i18n", "en.json");

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".vite"].includes(entry.name)) continue;
      walk(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const KEY_RE = /\bt\(\s*(['"`])((?:(?!\1).)+)\1/g;

const files = [];
try {
  walk(join(ROOT, "src"), files);
} catch {}

const codeKeys = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  let m;
  const re = new RegExp(KEY_RE.source, "g");
  while ((m = re.exec(src))) {
    const key = m[2];
    if (!codeKeys.has(key)) codeKeys.set(key, new Set());
    codeKeys.get(key).add(relative(ROOT, f));
  }
}

let en = {};
try {
  en = JSON.parse(readFileSync(EN_PATH, "utf8"));
} catch (e) {
  console.error(`Failed to parse en.json: ${e.message}`);
  process.exit(1);
}

const missing = [];
for (const [key, files] of codeKeys) {
  if (!(key in en)) {
    missing.push({ key, files: [...files] });
  }
}

const orphaned = [];
for (const key of Object.keys(en)) {
  if (!codeKeys.has(key)) {
    orphaned.push(key);
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ missing, orphaned }, null, 2));
} else {
  console.log(`\ni18n scan results:`);
  console.log(`  t() calls in code:  ${codeKeys.size}`);
  console.log(`  en.json keys:       ${Object.keys(en).length}`);
  console.log(
    `  Missing from en.json: ${missing.length > 0 ? "\x1b[31m" + missing.length + "\x1b[0m" : "\x1b[32m0\x1b[0m"}`
  );
  console.log(`  Orphaned in en.json:  ${orphaned.length}`);

  if (missing.length > 0) {
    console.log(`\nMissing keys:`);
    for (const { key, files } of missing.sort((a, b) =>
      a.key.localeCompare(b.key)
    )) {
      console.log(`  "${key}"`);
      console.log(`    used in: ${files.join(", ")}`);
    }
  }

  if (orphaned.length > 0 && !process.argv.includes("--no-orphan")) {
    console.log(`\nOrphaned keys (in en.json but no t() call found):`);
    for (const key of orphaned.sort()) {
      console.log(`  "${key}"`);
    }
  }
}

process.exit(missing.length > 0 ? 1 : 0);

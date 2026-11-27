import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const legacyBundle = 'com.coppadresd.mobile';
const legacy = {
  schema: 1,
  mode: 'production',
  gateway: 'https://erp.coppadresd.com',
  web: 'https://www.coppadresd.com',
};
const script = fileURLToPath(new URL('./check-ios-upload-destination.mjs', import.meta.url));

function check(t, contents, bundle = legacyBundle) {
  const temp = mkdtempSync(join(tmpdir(), 'ios-upload-target-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const manifest = join(temp, 'ios-release-target.json');
  if (contents !== undefined) {
    writeFileSync(manifest, typeof contents === 'string' ? contents : JSON.stringify(contents));
  }
  const result = spawnSync(process.execPath, [script, manifest, bundle], { encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('a production build with legacy gateway, web, and bundle is allowed', t => {
  const result = check(t, legacy);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /legacy TestFlight destination verified/i);
  assert.equal(check(t, { ...legacy, gateway: legacy.gateway + '/', web: 'https://coppadresd.com/' }).status, 0);
});

test('an Agentic or mixed build must not upload with the legacy bundle', t => {
  for (const overrides of [
    { gateway: 'https://erp.agenticwellness.ai', web: 'https://www.agenticwellness.ai' },
    { gateway: 'https://erp.agenticwellness.ai' },
    { web: 'https://agenticwellness.ai' },
    { gateway: 'https://erp.coppadresd.com.example.test' },
    { gateway: 'https://erp.coppadresd.com@other.example' },
    { gateway: 'http://erp.coppadresd.com' },
    { web: 'https://www.coppadresd.com/unexpected' },
  ]) {
    const result = check(t, { ...legacy, ...overrides });
    assert.equal(result.status, 1, JSON.stringify(overrides));
    assert.match(result.stderr, /upload blocked/i);
  }
});

test('the legacy gate fails closed for another bundle, wrong mode, or absent manifest', t => {
  for (const [contents, bundle] of [
    [legacy, 'ai.agenticwellness.example'],
    [{ ...legacy, mode: 'development' }, legacyBundle],
    [{ ...legacy, schema: 2 }, legacyBundle],
    [{ ...legacy, gateway: '' }, legacyBundle],
    [undefined, legacyBundle],
    ['not json', legacyBundle],
  ]) {
    const result = check(t, contents, bundle);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /upload blocked/i);
  }
});

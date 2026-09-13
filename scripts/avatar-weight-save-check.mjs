// E2E local: POST real; la única interrupción deliberada comprueba el error de red.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

assert(process.env.AVATAR_TEST_DOCUMENT && process.env.AVATAR_TEST_PASSWORD);
const out = new URL('../docs/avatar-weight-validation/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 1000 } });
  const responses = [];
  let posts = 0;
  page.on('request', r => { if (r.url().endsWith('/program/me/weight') && r.method() === 'POST') posts++; });
  page.on('response', async r => {
    if (r.url().endsWith('/program/me/weight') || r.url().includes('/metrics-history?codes=weight&days=365'))
      responses.push({ status: r.status(), path: new URL(r.url()).pathname, body: await r.json() });
  });
  await page.goto('http://localhost:5173');
  await page.locator('#login-id input').fill(process.env.AVATAR_TEST_DOCUMENT, { timeout: 60000 });
  await page.locator('#login-password input').fill(process.env.AVATAR_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Comencemos', exact: true }).click();
  await page.getByRole('button', { name: 'Perfil', exact: true }).click({ timeout: 60000 });
  await page.getByRole('button', { name: 'Probar avatar 3D', exact: true }).click();
  await page.getByText('Registros válidos: 3', { exact: true }).waitFor({ timeout: 60000 });
  const state = async () => JSON.parse(await page.locator('[data-avatar-body-state]').getAttribute('data-avatar-body-state'));
  const before = await state();
  await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
  const modal = page.locator('ion-modal.avatar-weight-modal');
  const save = modal.getByRole('button', { name: 'Guardar', exact: true });
  const input = modal.locator('ion-input input');
  assert(await save.isDisabled());
  await input.fill('501');
  assert(await save.isDisabled());
  await input.fill('0');
  assert(await save.isDisabled());
  await input.fill('80');
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await modal.waitFor({ state: 'detached' });
  assert.equal(posts, 0);
  assert.deepEqual(await state(), before);
  await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
  await input.fill('80');
  await page.screenshot({ path: fileURLToPath(new URL('modal.png', out)) });
  await page.route('**/api/v1/program/me/weight', route => route.abort('failed'));
  await save.click();
  await modal.getByRole('alert').waitFor();
  assert.equal(await input.inputValue(), '80');
  assert.deepEqual(await state(), before);
  await page.screenshot({ path: fileURLToPath(new URL('network-error.png', out)) });
  await page.unroute('**/api/v1/program/me/weight');
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/program/me/weight') && r.request().method() === 'POST');
  await save.click();
  const response = await responsePromise;
  const created = await response.json();
  // Conservar el ID inmediatamente aunque una aserción visual posterior falle.
  await fs.writeFile(new URL('created.json', out), JSON.stringify({ status: response.status(), created }, null, 2));
  assert.equal(response.status(), 201, JSON.stringify(created));
  await modal.waitFor({ state: 'detached' });
  await page.getByText(/Último registro disponible:.*80 kg/).waitFor();
  await page.waitForFunction(() => {
    const m = JSON.parse(document.querySelector('[data-avatar-metrics]')?.getAttribute('data-avatar-metrics') ?? '{}');
    return m.morphWeights?.BodyLean > 0.55;
  });
  const after = await state();
  assert(Math.abs(after.bodyLean - 5 / 9) < 0.001);
  assert.equal(after.bodyVolume, 0);
  await page.screenshot({ path: fileURLToPath(new URL('saved.png', out)) });
  const report = { before, after, responses, created, posts, cancelledWithoutPost: true, networkFailurePreservedForm: true };
  await fs.writeFile(new URL('result.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }

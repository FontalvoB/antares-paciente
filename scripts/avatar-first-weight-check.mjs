// Requiere una cuenta LOCAL de prueba sin pesos, preparada fuera de la aplicación.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
assert(process.env.AVATAR_TEST_DOCUMENT && process.env.AVATAR_TEST_PASSWORD);
const out = new URL('../docs/avatar-weight-validation/', import.meta.url);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 1000 } });
  await page.goto('http://localhost:5173');
  await page.locator('#login-id input').fill(process.env.AVATAR_TEST_DOCUMENT, { timeout: 60000 });
  await page.locator('#login-password input').fill(process.env.AVATAR_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Comencemos', exact: true }).click();
  await page.getByRole('button', { name: 'Perfil', exact: true }).click({ timeout: 60000 });
  await page.getByRole('button', { name: 'Probar avatar 3D', exact: true }).click();
  await page.getByText('No hay registros de peso suficientes para mostrar tu evolución.', { exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
  const modal = page.locator('ion-modal.avatar-weight-modal');
  await modal.locator('ion-input input').fill('90');
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/program/me/weight'));
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
  const response = await responsePromise;
  const created = await response.json();
  await fs.writeFile(new URL('first-created.json', out), JSON.stringify({ status: response.status(), created }, null, 2));
  assert.equal(response.status(), 201);
  await modal.waitFor({ state: 'detached' });
  await page.getByText('Registros válidos: 1', { exact: true }).waitFor();
  const state = JSON.parse(await page.locator('[data-avatar-body-state]').getAttribute('data-avatar-body-state'));
  assert(Object.values(state).every(v => v === 0));
  await page.locator('[data-avatar-metrics]').waitFor({ timeout: 60000 });
  await page.screenshot({ path: fileURLToPath(new URL('first-weight.png', out)) });
  await fs.writeFile(new URL('first-result.json', out), JSON.stringify({ created, state, firstWeightBecomesNeutralReference: true }, null, 2));
  console.log(JSON.stringify({ created, state, firstWeightBecomesNeutralReference: true }, null, 2));
} finally { await browser.close(); }

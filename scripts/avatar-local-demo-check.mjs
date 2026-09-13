// Prueba E2E contra la aplicación y API locales reales. Sin mocks ni datos sintéticos en HTTP.
// Las credenciales se reciben solo por variables de entorno; nunca se guardan.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] ?? 'empty';
assert(['empty', 'data'].includes(mode));
assert(process.env.AVATAR_TEST_DOCUMENT && process.env.AVATAR_TEST_PASSWORD, 'Faltan credenciales de prueba en el entorno');
const out = new URL('../docs/avatar-local-demo-validation/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.AVATAR_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 1000 } });
  const histories = [];
  page.on('response', async response => {
    if (response.url().includes('/metrics-history?codes=weight&days=365')) {
      histories.push({ status: response.status(), body: await response.json() });
    }
  });
  await page.goto('http://localhost:5173');
  await page.locator('#login-id input').fill(process.env.AVATAR_TEST_DOCUMENT, { timeout: 60000 });
  await page.locator('#login-password input').fill(process.env.AVATAR_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Comencemos', exact: true }).click();
  await page.getByRole('button', { name: 'Perfil', exact: true }).click({ timeout: 60000 });
  await page.getByRole('button', { name: 'Probar avatar 3D', exact: true }).click();
  await page.locator('[data-avatar-metrics]').waitFor({ timeout: 120000 });
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-avatar-metrics]')?.getAttribute('data-avatar-metrics') ?? '{}').loops >= 1, { timeout: 60000 });
  const body = async () => JSON.parse(await page.locator('[data-avatar-body-state]').getAttribute('data-avatar-body-state'));
  const metrics = JSON.parse(await page.locator('[data-avatar-metrics]').getAttribute('data-avatar-metrics'));
  const states = {};
  const rendered = {};
  const verifyRendered = async (name, expected) => {
    await page.waitForFunction(target => {
      const actual = JSON.parse(document.querySelector('[data-avatar-metrics]')?.getAttribute('data-avatar-metrics') ?? '{}').morphWeights;
      return actual && Math.abs(actual.BodyVolume - target.bodyVolume) < 0.002
        && Math.abs(actual.BodyLean - target.bodyLean) < 0.002;
    }, expected);
    rendered[name] = JSON.parse(await page.locator('[data-avatar-metrics]').getAttribute('data-avatar-metrics')).morphWeights;
  };
  if (mode === 'empty') {
    await page.getByText('No hay registros de peso suficientes para mostrar tu evolución.', { exact: true }).waitFor();
    states.empty = await body();
    assert(Object.values(states.empty).every(value => value === 0));
    await verifyRendered('empty', states.empty);
    await page.screenshot({ path: fileURLToPath(new URL('empty.png', out)) });
    await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
    await page.locator('.avatar-weight-modal').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.locator('.avatar-weight-modal').waitFor({ state: 'detached' });
    await page.getByText('No hay registros de peso suficientes para mostrar tu evolución.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Completar historia clínica', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-avatar-body-state]'));
    await page.getByRole('heading', { name: 'Historia clínica', exact: true }).waitFor();
    await page.screenshot({ path: fileURLToPath(new URL('history-navigation.png', out)) });
    states.historyPageText = (await page.locator('body').innerText()).slice(0, 1800);
  } else {
    await page.getByText('Registros válidos: 3', { exact: true }).waitFor();
    states.latest = await body();
    assert(states.latest.bodyLean > 0 && states.latest.bodyVolume === 0);
    await verifyRendered('latest', states.latest);
    await page.getByRole('button', { name: 'Pausar Idle', exact: true }).click();
    await page.screenshot({ path: fileURLToPath(new URL('latest.png', out)) });
    await page.locator('canvas').screenshot({ path: fileURLToPath(new URL('latest-avatar.png', out)) });
    await page.getByRole('button', { name: 'Ver inicial del período', exact: true }).click();
    await page.waitForTimeout(1500);
    states.initial = await body();
    assert(states.initial.bodyLean === 0 && states.initial.bodyVolume === 0);
    await verifyRendered('initial', states.initial);
    await page.screenshot({ path: fileURLToPath(new URL('initial.png', out)) });
    await page.locator('canvas').screenshot({ path: fileURLToPath(new URL('initial-avatar.png', out)) });
    await page.locator('ion-select').click();
    await page.getByRole('radio').filter({ hasText: '94 kg' }).click();
    await page.waitForTimeout(1500);
    states.intermediate = await body();
    assert(states.intermediate.bodyVolume > 0 && states.intermediate.bodyLean === 0);
    await verifyRendered('intermediate', states.intermediate);
    await page.screenshot({ path: fileURLToPath(new URL('intermediate.png', out)) });
    await page.locator('canvas').screenshot({ path: fileURLToPath(new URL('intermediate-avatar.png', out)) });
    await page.getByRole('button', { name: 'Ver último registro', exact: true }).click();
    await page.getByText('Registros válidos: 3', { exact: true }).waitFor();
    assert((await body()).bodyLean === states.latest.bodyLean);
  }
  assert(histories.length >= 1 && histories.every(item => item.status === 200));
  await fs.writeFile(new URL(`${mode}.json`, out), JSON.stringify({ mode, histories, states, rendered, metrics }, null, 2));
  console.log(JSON.stringify({ mode, histories, states, rendered, metrics }, null, 2));
} finally {
  await browser.close();
}

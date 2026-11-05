/** Real consent UI; synthetic onboarding APIs. Preview must make no API calls. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.COP_E2E_APP_URL ?? 'http://127.0.0.1:5173';
const out = process.env.COP_E2E_OUTPUT;
assert(out, 'COP_E2E_OUTPUT is required');
const browser = await chromium.launch();
const results = [];

async function assertLocked(page) {
  const checks = page.locator('ion-checkbox');
  await expect(checks).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(checks.nth(i)).toHaveJSProperty('disabled', true);
    await expect(checks.nth(i)).toHaveJSProperty('checked', false);
  }
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
}

async function reachEnd(page, captureWidth) {
  const region = page.getByRole('region', { name: 'Texto del consentimiento informado', exact: true });
  assert(await region.evaluate(el => el.scrollHeight > el.clientHeight * 3), 'The test document must require substantial scrolling');
  await assertLocked(page);
  await page.locator('.onb-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await assertLocked(page);
  await region.evaluate(el => { el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.45; });
  await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await assertLocked(page);
  await region.evaluate(el => { el.scrollTop = el.scrollHeight; });
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('ion-checkbox').nth(i)).toHaveJSProperty('disabled', false);
    await expect(page.locator('ion-checkbox').nth(i)).toHaveJSProperty('checked', false);
  }
  await expect(page.getByText('Ya puedes aceptar el consentimiento.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
  if (captureWidth) await page.screenshot({ path: path.join(out, `consent-ready-${captureWidth}.png`), animations: 'disabled' });
  for (let i = 0; i < 2; i++) await page.locator('ion-checkbox').nth(i).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
  await page.locator('ion-checkbox').nth(2).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled();
}

for (const width of [320, 390, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, hasTouch: width < 600 });
  const page = await context.newPage();
  const requests = [];
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.fulfill({ status: 401, json: {} }); });
  try {
    await page.goto(origin + '/?consent-test=long');
    await expect(page.getByRole('heading', { name: 'Prueba de consentimiento', exact: true })).toBeVisible();
    await expect(page.getByText('Texto largo de prueba', { exact: true })).toBeVisible();
    await assertLocked(page);
    await page.screenshot({ path: path.join(out, `consent-locked-${width}.png`), animations: 'disabled' });
    await reachEnd(page, width);
    await page.screenshot({ path: path.join(out, `consent-unlocked-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByText('Prueba completada. No se ha guardado ninguna aceptación.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reiniciar prueba', exact: true }).click();
    await assertLocked(page);
    assert.equal(requests.length, 0, 'Preview must not access authentication, patient data or consent APIs');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ scenario: 'phone-preview', width, result: 'passed', apiRequests: requests.length });
  } catch (error) {
    results.push({ scenario: 'phone-preview', width, result: 'failed', error: error.message });
    await page.screenshot({ path: path.join(out, `consent-preview-failure-${width}.png`), animations: 'disabled' });
  }
  await context.close();
}

const context = await browser.newContext({ viewport: { width: 390, height: 950 } });
const page = await context.newPage();
let verified = false;
let profileWrites = 0;
const token = 'x.' + Buffer.from(JSON.stringify({ sub: '11111111-1111-4111-8111-111111111111', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.x';
await page.route('**/api/**', route => {
  const request = route.request();
  const p = new URL(request.url()).pathname;
  const reply = json => route.fulfill({ json });
  if (p === '/api/auth/refresh') return verified ? reply({ accessToken: token, expiresIn: 3600 }) : route.fulfill({ status: 401, json: {} });
  if (p === '/api/auth/id-lookup') return reply({ patientId: '11111111-1111-4111-8111-111111111111', firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', contacts: [{ id: 'qa-contact', type: 'Email', label: 'qa@example.invalid' }] });
  if (p === '/api/auth/send-otp') return reply({ expiresInSeconds: 300 });
  if (p === '/api/auth/verify-otp') { verified = true; return reply({ accessToken: token, tokenType: 'Bearer', expiresIn: 3600 }); }
  if (p === '/api/v1/me/patient-profile') {
    if (request.method() === 'PUT') profileWrites++;
    return reply({ patientId: '11111111-1111-4111-8111-111111111111', firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', email: 'qa@example.invalid', phone: '3001234567', emergencyName: '', emergencyPhone: '', emergencyRelationship: '', emergencyEmail: '', secondaryEmergencyContact: null, insurerId: null, memberId: '' });
  }
  return reply([]);
});
try {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Activa tu cuenta', exact: true }).click();
  await page.locator('#login-first-id input').fill('QA');
  await page.getByRole('button', { name: 'Confirmar identidad', exact: true }).click();
  await page.getByRole('radio').click();
  await page.locator('#login-otp-0').fill('123456');
  await page.getByRole('button', { name: 'Verificar y entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.locator('#onb-fam-name input').fill('Contacto QA');
  await page.locator('#onb-fam-cel input').fill('3001234567');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Texto largo de prueba', { exact: true })).toHaveCount(0);
  const originalRegion = page.getByRole('region', { name: 'Texto del consentimiento informado', exact: true });
  assert((await originalRegion.innerText()).includes('Tus datos son PHI según HIPAA.'));
  await expect(originalRegion.getByText('1. Lectura del documento', { exact: true })).toHaveCount(0);
  await originalRegion.evaluate(el => { el.scrollTop = el.scrollHeight; });
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('ion-checkbox').nth(i)).toHaveJSProperty('disabled', false);
    await page.locator('ion-checkbox').nth(i).click();
  }
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.locator('#onb-pwd input')).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.getByText('Ya puedes aceptar el consentimiento.', { exact: true })).toBeVisible();
  for (let i = 0; i < 3; i++) await expect(page.locator('ion-checkbox').nth(i)).toHaveJSProperty('checked', true);
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled();
  assert.equal(profileWrites, 0);
  results.push({ scenario: 'actual-onboarding-and-return', result: 'passed', profileWrites });
} catch (error) {
  results.push({ scenario: 'actual-onboarding-and-return', result: 'failed', error: error.message });
  await page.screenshot({ path: path.join(out, 'consent-onboarding-failure.png'), animations: 'disabled' });
}
await context.close();
await browser.close();
await writeFile(path.join(out, 'consent-scroll-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => result.result === 'failed')) process.exitCode = 1;

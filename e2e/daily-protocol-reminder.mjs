/** UI real con reloj acelerado y APIs sintéticas; no modifica pacientes reales. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.COP_E2E_APP_URL ?? 'http://localhost:5173';
const out = process.env.COP_E2E_OUTPUT;
assert(out, 'COP_E2E_OUTPUT is required');
await mkdir(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const token = 'x.' + Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url') + '.x';
const browser = await chromium.launch();
const results = [];

for (const width of [390, 1280]) for (const scenario of ['repeat', 'reload', 'completed', 'background']) {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  let completed = false;
  let writes = 0;
  await page.route('**/api/**', route => {
    const request = route.request();
    const p = new URL(request.url()).pathname;
    const reply = json => route.fulfill({ json });
    if (request.method() !== 'GET' && p !== '/api/auth/refresh') writes++;
    if (p === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 86400 });
    if (p === '/api/auth/me') return reply({ id, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (p === '/api/v1/me/patient-profile') return reply({ patientId: id, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', phone: '+12025550101' });
    if (p === '/api/v1/me/context') return reply({ patient: { id, organizationId: id }, clinics: [] });
    if (p === '/api/v1/program/me/snapshot') return reply({
      enrollmentId: id, todayLocalDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      template: { id, code: 'QA', name: 'Programa QA', totalWeeks: 24, currentWeekNumber: 1, currentWeekStatus: 'Active', currentWeekStartDateLocal: '2026-11-02', currentWeekEndDateLocal: '2026-11-08' },
      todayTasks: [{ taskCode: 'emocional', title: 'Evaluación emocional', short: 'Tu bienestar', points: 10, status: completed ? 'Completed' : 'Pending', completedAt: null }],
      todayPoints: completed ? 10 : 0, todayBonusAvailable: false, todayPointsMax: 10,
      xp: { balance: 0, level: 'Semilla', nextLevelAt: 100 },
      streak: { current: 0, longest: 0, freezesRemaining: 0, multiplierActive: false, multiplierEndsAt: null, multiplierRemainingHours: 0 },
      nextMilestoneDays: 3, calendar: [],
    });
    if (p.includes('/appointments') || p.includes('/requests')) return reply({ items: [] });
    if (p.endsWith('/catalog')) return reply({ data: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  const modal = page.locator('ion-modal.daily-protocol-reminder');
  const dialog = modal.getByRole('heading', { name: 'Tu salud te espera, Paciente', exact: true });
  const tick = async ms => { await page.clock.fastForward(ms); await page.clock.runFor(500); };
  try {
    await page.clock.install();
    await page.goto(origin);
    await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
    await tick(12_000);
    await expect(dialog).toBeVisible();
    await expect(modal.getByText(/Tienes 1 actividades pendientes/)).toBeVisible();
    await modal.getByRole('button', { name: 'Más tarde', exact: true }).click();
    await tick(1000);
    await expect(dialog).not.toBeVisible();

    if (scenario === 'reload') {
      await page.reload();
      await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
      await tick(12_000);
      await expect(dialog).not.toBeVisible();
    }
    if (scenario === 'completed') {
      completed = true;
      await page.reload();
      await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
      await tick(12_000);
      await expect(dialog).not.toBeVisible();
    }
    if (scenario === 'background') await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await tick(28 * 60_000);
    await expect(dialog).not.toBeVisible();
    await tick(2 * 60_000);
    if (scenario === 'background') {
      await expect(dialog).not.toBeVisible();
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(dialog).not.toBeVisible();
    }
    await tick(12_000);
    if (scenario === 'completed') await expect(dialog).not.toBeVisible();
    else {
      await expect(dialog).toBeVisible();
      if (scenario === 'repeat') {
        await page.screenshot({ path: path.join(out, `reminder-repeat-${width}.png`), animations: 'disabled' });
        await modal.getByRole('button', { name: 'Empezar mi protocolo', exact: true }).click();
        await tick(1000);
        await expect(dialog).not.toBeVisible();
      }
    }
    assert.equal(writes, 0, 'El recordatorio no debe escribir ni completar actividades.');
    results.push({ width, scenario, result: 'passed' });
  } catch (error) {
    results.push({ width, scenario, result: 'failed', error: error.message });
    await page.screenshot({ path: path.join(out, `${scenario}-${width}-failure.png`), animations: 'disabled' });
  }
  await context.close();
}
await browser.close();
await writeFile(path.join(out, 'reminder-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => result.result === 'failed')) process.exitCode = 1;

/** UI real y HTTP sintético: sin escrituras clínicas ni llamadas a proveedores. */
import { chromium, expect } from 'playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.COP_E2E_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const status of ['active', 'pending_review']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const accountId = randomUUID();
  const token = 'x.' + Buffer.from(JSON.stringify({ sub: accountId, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.x';
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const reply = json => route.fulfill({ json });
    if (path === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 3600 });
    if (path === '/api/auth/me') return reply({ id: accountId, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (path === '/api/v1/me/patient-profile') return reply({ patientId: randomUUID(), firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA' });
    if (path === '/api/v1/program/me/snapshot' && status === 'pending_review') return reply({
      enrollmentId: 'qa-enrollment',
      template: { id: 'qa-template', code: 'qa', name: 'Programa QA', totalWeeks: 24, currentWeekNumber: 1, currentWeekStatus: 'Active', currentWeekStartDateLocal: '2026-11-12', currentWeekEndDateLocal: '2026-11-18' },
      todayLocalDate: '2026-11-12', todayTasks: [], todayPoints: 0, todayBonusAvailable: false, todayPointsMax: 0,
      xp: { balance: 0, level: 'Semilla', nextLevelAt: 1000 },
      streak: { current: 0, longest: 0, freezesRemaining: 0, multiplierActive: 1, multiplierEndsAt: null, multiplierRemainingHours: 0 },
      nextMilestoneDays: 7, calendar: [],
    });
    if (path === '/api/v1/me/nutrition-plan/status') return reply({ status, durationDays: 30, currentDay: 1, startDate: '2026-11-12', endDate: '2026-12-11' });
    if (path === '/api/v1/me/nutrition-plan' && status === 'active') return reply({ id: 'qa-plan', name: 'Plan automático QA', durationDays: 30, currentDay: 1, days: [{ dayNumber: 1, dailyWaterMl: 2000, meals: [{ mealType: 'Desayuno', foods: 'Avena QA', calories: 400 }] }] });
    if (path.endsWith('/health-tests/me/assignments') || path.endsWith('/health-tests/me/results')) return reply([]);
    if (path.endsWith('/program/notifications')) return reply({ items: [], unreadCount: 0, totalCount: 0 });
    return route.fulfill({ status: 404, json: {} });
  });
  const page = await context.newPage();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(process.env.COP_E2E_APP_URL ?? 'http://localhost:5173');
    await page.locator('.bnav').getByRole('button', { name: 'Nutrición', exact: true }).click();
    if (status === 'active') {
      await expect(page.getByText('IMPORTANT DISCLAIMER – NUTRITIONAL RECOMMENDATIONS', { exact: true })).toBeVisible();
      await expect(page.getByText(/Users are encouraged to have this plan reviewed/)).toBeVisible();
      await page.getByText('Tu plan nutricional', { exact: true }).evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await expect(page.getByText('Avena QA', { exact: true })).toBeInViewport();
    } else {
      await page.locator('ion-segment-button[value="indicaciones"]').click();
      await expect(page.getByText('Estamos terminando de publicar tu plan automático. No necesitas esperar aprobación de un nutricionista.', { exact: true })).toBeVisible();
      await expect(page.getByText('Publicación automática', { exact: true })).toBeVisible();
      await expect(page.getByText('Revisión de tu nutricionista', { exact: true })).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (output) await page.screenshot({ path: `${output}/nutrition-${status}.png`, animations: 'disabled' });
    results.push({ status, passed: true });
  } catch (error) {
    results.push({ status, passed: false, error: error.message });
  }
  await context.close();
}
await browser.close();
if (output) await writeFile(`${output}/nutrition-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => !result.passed)) process.exitCode = 1;

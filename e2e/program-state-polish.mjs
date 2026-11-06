/** UI real, APIs sintéticas: estados de disponibilidad y una sola toma de nutracéutico. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const origin = process.env.COP_E2E_APP_URL ?? 'http://localhost:5173';
const out = process.env.COP_E2E_OUTPUT;
assert(out); await mkdir(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const token = 'x.' + Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 7 * 86400 })).toString('base64url') + '.x';
const browser = await chromium.launch(), results = [];
const titles = { recoverable: 'Tu programa no cargó', paused: 'Tu programa está en pausa', withdrawn: 'Tu programa no está activo', 'no-template': 'Tu programa aún no está disponible' };
const reasons = {
  recoverable: 'No pudimos consultar tus actividades. El servicio no indicó una causa específica. Reintenta; si se repite, contacta a tu equipo de salud.',
  network: 'No pudimos conectar con el servicio de tu programa. Revisa tu conexión a internet y vuelve a intentarlo.',
  timeout: 'El servicio de tu programa tardó demasiado en responder. Espera un momento y vuelve a intentarlo.',
  server: 'El servicio de tu programa tuvo un problema al consultar tus actividades. Reintenta en unos minutos; si se repite, contacta a tu equipo de salud.',
  assessments: 'Tu programa aún no está activo y no pudimos comprobar si ya completaste tus evaluaciones. Reintenta; si se repite, contacta a tu equipo de salud.',
  paused: 'Tu programa figura como pausado y sus actividades están suspendidas. Contacta a tu equipo de salud para saber por qué y cuándo puedes retomarlas.',
  withdrawn: 'Tu participación en este programa figura como desactivada, por eso sus actividades ya no están disponibles. Contacta a tu equipo de salud para conocer el motivo y los siguientes pasos.',
  'no-template': 'El programa todavía no tiene actividades publicadas para ti. Tu equipo de salud debe habilitarlas antes de que puedas comenzar.',
};
const recoverableScenarios = ['recoverable', 'network', 'timeout', 'server', 'assessments'];
for (const width of [320, 390, 768]) for (const scenario of ['recoverable', 'network', 'timeout', 'server', 'assessments', 'loading', 'paused', 'withdrawn', 'no-template', 'nutra', 'nutra-completed']) {
  if (process.env.COP_E2E_CASE && !process.env.COP_E2E_CASE.split(',').includes(`${scenario}-${width}`)) continue;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  await page.clock.setFixedTime(new Date('2026-11-06T14:00:00Z'));
  let success = scenario.startsWith('nutra'), done = scenario === 'nutra-completed', heldRoute;
  const writes = []; let snapshotReads = 0;
  const codes = ['podcast', 'vitals', 'nut', 'ejercicio', 'nutraceutico', 'emocional'];
  const snapshot = () => ({
    enrollmentId: id, todayLocalDate: '2026-11-06',
    template: { id, code: 'QA', name: 'Programa QA', totalWeeks: 24, currentWeekNumber: 3, currentWeekStatus: 'Active', currentWeekStartDateLocal: '2026-11-02', currentWeekEndDateLocal: '2026-11-08' },
    todayTasks: codes.map(taskCode => ({ taskCode, title: taskCode === 'nutraceutico' ? '¿Ya tomaste tu Nutracéutico?' : 'Actividad QA ' + taskCode, short: taskCode === 'nutraceutico' ? 'Sigue las indicaciones de tu profesional' : '', points: taskCode === 'nutraceutico' ? 80 : 100, status: done && taskCode === 'nutraceutico' ? 'Completed' : 'Pending', completedAt: done && taskCode === 'nutraceutico' ? '2026-11-06T14:00:00Z' : null })),
    todayPoints: done ? 80 : 0, todayBonusAvailable: true, todayPointsMax: 630,
    xp: { balance: done ? 1280 : 1200, level: 'Semilla', nextLevelAt: 2000 },
    streak: { current: 1, longest: 1, freezesRemaining: 0, multiplierActive: false, multiplierEndsAt: null, multiplierRemainingHours: 0, nbWeekDays: [false, false, false, false, done, false, false] },
    nextMilestoneDays: 3, calendar: [],
  });
  await page.route('**/api/**', route => {
    const req = route.request(), p = new URL(req.url()).pathname, reply = json => route.fulfill({ json });
    if (req.method() !== 'GET' && p !== '/api/auth/refresh') writes.push({ path: p, body: req.postDataJSON() });
    if (p === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 86400 });
    if (p === '/api/auth/me') return reply({ id, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (p === '/api/v1/me/patient-profile') return reply({ patientId: id, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', email: 'qa@example.invalid', phone: '+12025550101' });
    if (p === '/api/v1/telemedicine/me') return reply({ patient: { id, organizationId: id }, clinics: [] });
    if (p === '/api/v1/telemedicine/requests/mine') return reply([]);
    if (p.endsWith('/specialties') || p.endsWith('/insurers')) return reply([]);
    if (p === '/api/v1/program/me/snapshot') {
      snapshotReads++;
      if (success) return reply(snapshot());
      if (scenario === 'loading') { heldRoute = route; return; }
      if (scenario === 'network') return route.abort('failed');
      const error = { paused: [409, 'ENROLLMENT_PAUSED'], withdrawn: [410, 'ENROLLMENT_WITHDRAWN'], 'no-template': [422, 'TEMPLATE_NOT_ACTIVE'], server: [503, 'UNAVAILABLE'], timeout: [504, 'GATEWAY_TIMEOUT'], assessments: [404, 'NO_ACTIVE_ENROLLMENT'] }[scenario] ?? [400, 'UNKNOWN_FAILURE'];
      return route.fulfill({ status: error[0], json: { code: error[1], detail: 'Technical details that must never reach the patient' } });
    }
    if (scenario === 'assessments' && p.startsWith('/api/v1/health-tests/me/')) return route.fulfill({ status: 503, json: {} });
    if (p === '/api/v1/program/tasks/complete') {
      done = true;
      return reply({ taskCompletionId: id, pointsAwarded: 80, xpBalanceAfter: 1280, isPerfectDay: false, dailyBonusAwarded: 0, streakCurrent: 1, freezesRemaining: 0, dayPoints: 80, dayPointsMax: 630 });
    }
    if (p.includes('/appointments') || p.includes('/requests')) return reply({ items: [] });
    if (p.endsWith('/catalog')) return reply({ data: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto(origin);
    if (scenario.startsWith('nutra')) {
      await expect(page.locator('.hm-program-day')).toHaveText('Día 19 del programa');
      await page.locator('.hm-day-panel').screenshot({ path: path.join(out, `home-program-day-${width}.png`), animations: 'disabled' });
    }
    await page.locator('.hm-day-link').click();
    await expect(page.locator('.router-page')).toHaveCSS('opacity', '1');
    if (scenario.startsWith('nutra')) {
      await expect(page.locator('.pgh-program-day')).toHaveText('Día 19');
      await expect(page.locator('.pgh-program-day')).toHaveAttribute('aria-label', 'Día 19 del programa');
      await page.locator('.pgh-unit').screenshot({ path: path.join(out, `protocol-program-day-${width}.png`), animations: 'disabled' });
      const card = page.locator('button.pcard').filter({ hasText: '¿Ya tomaste tu Nutracéutico?' });
      await expect(card).toHaveCount(1);
      const extra = page.locator('.pg-nb');
      await (await extra.count() ? extra : page.locator('.pg-ai')).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `nutra-overview-${width}.png`), animations: 'disabled' });
      await card.click();
      await expect(page.locator('.nutraceutic-detail')).toBeVisible();
      await page.locator('.lesson-sheet-head').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `nutra-detail-${scenario}-${width}.png`), animations: 'disabled' });
      if (done) {
        await page.locator('.lesson-done-banner').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, `nutra-confirmation-${width}.png`), animations: 'disabled' });
      }
      if (scenario === 'nutra-completed') {
        await expect(page.locator('.lesson-done-banner')).toHaveCount(1);
        await expect(page.getByText('Dosis de hoy confirmada', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Sí, ya lo tomé/ })).toHaveCount(0);
        assert.equal(writes.length, 0);
      } else {
        const confirm = page.getByRole('button', { name: /^Sí, ya lo tomé/ });
        await expect(confirm).toHaveCount(1);
        await confirm.click();
        await expect.poll(() => writes.length).toBe(1);
        assert.equal(writes[0].path, '/api/v1/program/tasks/complete');
        assert.equal(writes[0].body.taskCode, 'nutraceutico');
        assert.equal(writes[0].body.enrollmentId, id);
        assert.equal(writes[0].body.localDate, '2026-11-06');
        await expect(card).toBeVisible();
        await expect(card).toHaveAttribute('aria-label', /completada/);
      }
      const back = page.getByRole('button', { name: 'Volver al protocolo', exact: true });
      if (await back.count()) await back.click();
      await expect(page.locator('.pg-nb')).toHaveCount(0);
      await card.click();
      await expect(page.locator('.nutraceutic-detail .nb-streak .nb-day')).toHaveCount(7);
    } else {
      await page.locator('.program-setup-fallback, .program-state').waitFor();
      if (scenario !== 'loading') await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await page.screenshot({ path: path.join(out, `state-${scenario}-${width}.png`), animations: 'disabled' });
      if (scenario === 'loading') {
        await expect(page.getByRole('status', { name: 'Cargando tu programa' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0);
        success = true; await heldRoute.fulfill({ json: snapshot() }); heldRoute = null;
        await expect(page.locator('.pcards')).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: titles[scenario] ?? titles.recoverable, exact: true })).toBeVisible();
        await expect(page.locator('.program-state-description')).toHaveText(reasons[scenario]);
        await expect(page.getByText('Technical details that must never reach the patient')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Volver a Inicio', exact: true })).toBeVisible();
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        if (recoverableScenarios.includes(scenario)) {
          const reads = snapshotReads; success = true;
          await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
          await expect(page.locator('.pcards')).toBeVisible(); assert(snapshotReads > reads);
        } else {
          await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0);
          await page.getByRole('button', { name: 'Volver a Inicio', exact: true }).click();
          await expect(page.locator('.hm-day-link')).toBeVisible();
        }
      }
      assert.equal(writes.length, 0);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ width, scenario, result: 'passed' });
  } catch (error) { results.push({ width, scenario, result: 'failed', error: error.message }); }
  if (heldRoute) await heldRoute.abort().catch(() => {});
  await context.close();
}
await browser.close();
await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results)); if (results.some(r => r.result === 'failed')) process.exitCode = 1;

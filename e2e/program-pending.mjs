/** Estado real de Mi programa; APIs sintéticas y sin asignar planes ni completar pruebas. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const origin = process.env.COP_E2E_APP_URL ?? 'http://localhost:5173';
const out = process.env.COP_E2E_OUTPUT;
assert(out); await mkdir(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const batteryId = '0d0198a4-ade2-50af-a6d4-e5fe29096d41';
const codes = ['historia-clinica', 'temperamento', 'nutricional', 'movimiento', 'sueno', 'iac-adresd', 'orp', 'ers', 'bateria-antares'];
const token = 'x.' + Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.x';
const browser = await chromium.launch(), results = [];
for (const width of [320, 390, 768]) for (const completed of [0, 4, 9, 'error']) {
  if (process.env.COP_E2E_CASE && `${completed}-${width}` !== process.env.COP_E2E_CASE) continue;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage(); let writes = 0;
  await page.route('**/api/**', route => {
    const req = route.request(), p = new URL(req.url()).pathname;
    const reply = json => route.fulfill({ json });
    if (req.method() !== 'GET' && p !== '/api/auth/refresh') writes++;
    if (p === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 3600 });
    if (p === '/api/auth/me') return reply({ id, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (p === '/api/v1/me/patient-profile') return reply({ patientId: id, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', email: 'qa@example.invalid', phone: '+12025550101' });
    if (p === '/api/v1/me/context') return reply({ patient: { id, organizationId: id }, clinics: [] });
    if (p === '/api/v1/program/me/snapshot') return route.fulfill({ status: 404, json: { code: 'NO_ACTIVE_ENROLLMENT', detail: 'NO_ACTIVE_ENROLLMENT: Programa no activo.' } });
    if (p === '/api/v1/health-tests/me/batteries') return reply([{ id, patientId: id, batteryId, batteryName: 'Batería de evaluación inicial Copp Adresd', status: 'in_progress' }]);
    if (p === '/api/v1/health-tests/me/assignments') return completed === 'error' ? route.fulfill({ status: 400, json: {} }) : reply(codes.map((testCode, i) => ({ id: `test-${i}`, patientId: id, versionId: id, batteryAssignmentId: id, testName: `Evaluación QA ${i + 1}`, testCode, status: i < completed ? 'completed' : 'pending', points: 10 })));
    if (p.includes('/appointments') || p.includes('/requests')) return reply({ items: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto(origin);
    await page.locator('.hm-day-link').click();
    if (completed === 'error') {
      await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
      await expect(page.getByRole('progressbar', { name: 'Progreso de tus evaluaciones' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { name: completed === 9 ? 'Tus evaluaciones ya están completas' : 'Tu plan empieza contigo', exact: true })).toBeVisible();
      await expect(page.getByText(`${completed} de 9 evaluaciones`, { exact: true })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Los pasos de tu programa' })).toBeVisible();
      assert(await page.locator('.program-setup-top').evaluate(el => el.getBoundingClientRect().top >= 12));
      await page.screenshot({ path: path.join(out, `program-${completed}-${width}.png`), fullPage: true, animations: 'disabled' });
      if (completed < 9) {
        await page.getByRole('button', { name: 'Completar mis evaluaciones', exact: true }).click();
        await expect(page.getByText('Batería de evaluación inicial', { exact: true })).toBeVisible();
      } else await expect(page.getByRole('button', { name: 'Completar mis evaluaciones', exact: true })).toHaveCount(0);
    }
    assert.equal(writes, 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ width, completed, result: 'passed' });
  } catch (error) { results.push({ width, completed, result: 'failed', error: error.message }); }
  await context.close();
}
await browser.close(); await writeFile(path.join(out, 'program-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results)); if (results.some(r => r.result === 'failed')) process.exitCode = 1;

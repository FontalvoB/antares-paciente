/** UI real, respuestas sintéticas y almacenamiento de una cuenta ficticia: sin proveedores ni escrituras reales. */
import { chromium, expect } from 'playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.COP_E2E_OUTPUT ?? '/tmp/copp-easy-local';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const scenario of ['purpose-320', 'purpose-390', 'assessment-optional', 'assessment-pending', 'welcome-complete', 'welcome-pending', 'welcome-optional', 'welcome-missing', 'welcome-last-test', 'welcome-error', 'existing-account', 'chat-copy']) {
  if (process.env.COP_E2E_CASE && !scenario.includes(process.env.COP_E2E_CASE)) continue;
  const context = await browser.newContext({ viewport: { width: scenario === 'purpose-320' ? 320 : 390, height: 950 } });
  const accountId = randomUUID(), patientId = randomUUID(), cohortId = randomUUID(), versionId = randomUUID();
  const key = `antares:vita-welcome:v1:${accountId}`;
  const token = 'x.' + Buffer.from(JSON.stringify({ sub: accountId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.x';
  if (scenario.startsWith('welcome-')) await context.addInitScript(({ key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, 'pending');
  }, { key });
  const codes = ['historia-clinica', 'temperamento', 'nutricional', 'movimiento', 'sueno', 'iac-adresd', 'orp', 'ers', 'bateria-antares'];
  const assignments = codes.map((testCode, index) => ({ id: randomUUID(), patientId, versionId, batteryAssignmentId: cohortId,
    testCode, testName: testCode === 'bateria-antares' ? '¿Cuál es tu propósito?' : 'QA Inicial ' + index,
    status: index === 8 && (scenario.startsWith('purpose-') || scenario.startsWith('assessment-') || ['welcome-pending', 'welcome-optional', 'welcome-last-test'].includes(scenario)) ? 'pending' : 'completed',
    isRequired: !(['welcome-optional', 'assessment-optional'].includes(scenario) && index === 8), batteryRequiredCount: ['welcome-optional', 'assessment-optional'].includes(scenario) ? 8 : 9, assignedAt: '2026-11-12T10:00:00Z', completedAt: '2026-11-12T11:00:00Z' }));
  const purpose = assignments[8];
  if (scenario === 'welcome-missing') assignments.pop();
  const question = { id: randomUUID(), versionId, code: 'adh_proposito', section: 'Propósito', text: '¿Qué te motiva hoy?',
    type: 'multi', scoringDirection: 'positive', sortOrder: 1, isActive: true,
    options: ['Más energía', 'Más confianza'].map((text, index) => ({ id: randomUUID(), text, sortOrder: index, scoreValue: index, isActive: true })) };
  let reads = 0;
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname;
    const reply = json => route.fulfill({ json });
    if (p === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 3600 });
    if (p === '/api/auth/me') return reply({ id: accountId, firstName: 'Lucía', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (p === '/api/v1/me/patient-profile') return reply({ patientId, firstName: 'Lucía', lastName: 'QA', documentNumber: 'QA', emergencyContact: { name: 'QA Contacto', phone: '+573000000001' } });
    if (p.endsWith('/health-tests/me/assignments')) {
      reads++;
      return scenario === 'welcome-error' ? route.fulfill({ status: 503, json: { detail: 'QA unavailable' } }) : reply(assignments);
    }
    if (p.endsWith('/health-tests/me/results')) return reply([]);
    if (p.endsWith('/tests/' + purpose.id)) return reply({ id: versionId, instrumentId: randomUUID(), versionNumber: 1, name: '¿Cuál es tu propósito?', status: 'active', isCurrent: true, questions: [question], ranges: [] });
    if (p.endsWith('/tests/' + purpose.id + '/submit')) { purpose.status = 'completed'; return reply({ id: randomUUID(), assignmentId: purpose.id, versionId, patientId, status: 'completed', results: [] }); }
    if (p.endsWith('/tests/' + purpose.id + '/start')) return reply({ id: randomUUID(), assignmentId: purpose.id, versionId, patientId, status: 'in_progress' });
    if (p.endsWith('/program/notifications')) return reply({ items: [], unreadCount: 0, totalCount: 0 });
    if (p.includes('/professionals-catalog')) return reply({ data: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await page.goto(process.env.COP_E2E_APP_URL ?? 'http://localhost:5188');
    if (scenario.startsWith('purpose-')) {
      await page.getByRole('button', { name: 'Perfil', exact: true }).click();
      await page.getByRole('button', { name: /Batería de evaluación/ }).click();
      await page.locator('.ht-list-card').filter({ hasText: '¿Cuál es tu propósito?' }).click();
      await page.getByRole('button', { name: 'Comenzar evaluación', exact: true }).click();
      await page.getByRole('button', { name: /Más energía/ }).click();
      await expect(page.locator('.mood-cosmos .ht-chip.sel')).toHaveCSS('border-top-color', 'rgb(12, 76, 107)');
      await expect(page.locator('.ht-page.mood-cosmos .ht-cta')).toHaveCSS('--background', '#0c4c6b');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: /Más confianza/ })).toBeFocused();
      await expect(page.getByRole('button', { name: /Más confianza/ })).toHaveCSS('outline-color', 'rgb(12, 76, 107)');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } else if (scenario.startsWith('assessment-')) {
      await page.getByRole('button', { name: 'Perfil', exact: true }).click();
      await page.getByRole('button', { name: /Batería de evaluación/ }).click();
      await expect(page.locator('.ht-lead')).toContainText('El plan se prepara al completar las evaluaciones requeridas.');
      await page.getByRole('button', { name: 'Omitir el resto', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
      const warning = page.locator('ion-toast').getByText(/Tu plan queda pendiente hasta completar las evaluaciones requeridas/);
      if (scenario === 'assessment-pending') await expect(warning).toBeVisible();
      else await expect(warning).not.toBeVisible();
    } else if (['welcome-complete', 'welcome-optional', 'welcome-last-test'].includes(scenario)) {
      if (scenario === 'welcome-last-test') {
        await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
        await expect(page.locator('.vita-welcome')).not.toBeVisible();
        await page.getByRole('button', { name: 'Perfil', exact: true }).click();
        await page.getByRole('button', { name: /Batería de evaluación/ }).click();
        await page.locator('.ht-list-card').filter({ hasText: '¿Cuál es tu propósito?' }).click();
        await page.getByRole('button', { name: 'Comenzar evaluación', exact: true }).click();
        await page.getByRole('button', { name: /Más energía/ }).click();
        await page.getByRole('button', { name: 'Guardar evaluación', exact: true }).click();
        await expect(page.getByText('9 de 9 evaluaciones', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Volver', exact: true }).click();
      }
      const welcome = page.locator('.vita-welcome-modal');
      await expect(welcome.getByRole('heading', { name: 'Bienvenido Lucía al programa Copp Adresd.', exact: true })).toBeVisible();
      await page.screenshot({ path: `${output}/${scenario}-open.png`, animations: 'disabled' });
      await welcome.getByRole('button', { name: 'Conocer a Vita', exact: true }).click();
      await expect(page.locator('.chat-welcome-sub')).toHaveText('Soy Vita, tu coach asignada');
      await expect(page.locator('.vita-welcome')).not.toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
      await expect(page.locator('.vita-welcome')).not.toBeVisible();
      expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('seen');
      expect(reads).toBeGreaterThan(0);
    } else if (scenario === 'chat-copy') {
      await page.getByRole('button', { name: 'Chat', exact: true }).click();
      await expect(page.locator('.chat-disclaimer')).not.toContainText('aprobado por tu equipo');
      await expect(page.locator('.chat-disclaimer')).toContainText('plan publicado');
    } else {
      await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
      // Al navegar y volver se ejercitan efectos reales; no se muta el contexto de React desde el test.
      await page.getByRole('button', { name: 'Perfil', exact: true }).click();
      await page.getByRole('button', { name: 'Inicio', exact: true }).click();
      await expect(page.locator('.vita-welcome')).not.toBeVisible();
      if (scenario !== 'existing-account') expect(reads).toBeGreaterThan(0);
    }
    await page.screenshot({ path: `${output}/${scenario}.png`, animations: 'disabled' });
    results.push({ scenario, passed: true });
  } catch (error) {
    results.push({ scenario, passed: false, error: error.message });
    await page.screenshot({ path: `${output}/${scenario}-failed.png`, animations: 'disabled' });
  }
  await context.close();
}
await browser.close();
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => !result.passed)) process.exitCode = 1;

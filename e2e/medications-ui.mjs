/** UI E2E with explicit synthetic HTTP fixtures. Cross-app/real DB coverage is separate. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = process.env.COP_E2E_OUTPUT;
assert(output?.startsWith('/tmp/'), 'Keep evidence outside the repository');
await mkdir(output, { recursive: true });
const origin = process.env.COP_E2E_APP_URL ?? 'http://127.0.0.1:5189';
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin), 'Only local UI hosts are permitted');
const userId = '11111111-1111-4111-8111-111111111111';
const token = 'x.' + Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url') + '.x';
const browser = await chromium.launch();
const scenarios = process.env.COP_MEDICATIONS_SCENARIOS?.split(',') ?? ['enabled', 'disabled', 'old-server', 'capability-error', 'read-only', 'forbidden', 'english', 'retry', 'dose-retry', 'omitted', 'legacy-crypto'];
const results = [];

for (const scenario of scenarios) {
  const english = scenario === 'english';
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, timezoneId: 'America/Bogota', reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  if (scenario === 'legacy-crypto') await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }));
  if (english) await page.addInitScript(() => localStorage.setItem('antares_lang', 'en'));
  const writes = [];
  let failedOnce = false;
  let doseFailedOnce = false;
  const workspace = {
    patient: { id: userId, name: 'Paciente Medicamentos QA', mrn: 'QA-MED' },
    access: { enabled: true, revision: 1 }, treatments: [], doses: [], history: [],
    summary: { activeTreatments: 0, scheduledDoses: 0, takenDoses: 0, pendingDoses: 0 },
  };
  const profile = { patientId: userId, firstName: 'Paciente', lastName: 'Medicamentos QA', documentNumber: 'QA-MED', email: 'medication@example.invalid', phone: '5550101', insurerId: null, memberId: '', dateOfBirth: '1990-01-01', emergencyName: 'Contacto QA', emergencyRelationship: 'Familiar', emergencyPhone: '5550102', emergencyEmail: 'contact@example.invalid' };
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (pathname === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 86400 });
    if (pathname === '/api/auth/me') return reply({ id: userId, firstName: 'Paciente', lastName: 'Medicamentos QA', roles: ['Patient'], permissions: [] });
    if (pathname === '/api/v1/me/patient-profile') return reply(profile);
    if (pathname === '/api/v1/me/capabilities') {
      if (scenario === 'old-server') return reply({}, 404);
      if (scenario === 'capability-error') return reply({}, 503);
      return reply({ policyVersion: 'medications-v1:1', modules: { medications: { enabled: scenario !== 'disabled', canView: true, canManage: scenario !== 'read-only', canManageAccess: false } } });
    }
    if (pathname === '/api/v1/me/medications') return scenario === 'forbidden' ? reply({}, 403) : reply(workspace);
    if (pathname === '/api/v1/me/medications/treatments' && request.method() === 'POST') {
      const body = request.postDataJSON(); writes.push({ kind: 'create', body });
      if (!workspace.treatments.length) {
        const treatment = { ...body, id: '22222222-2222-4222-8222-222222222222', revision: 1, status: 'active', origin: 'patient_reported', createdAt: new Date().toISOString() };
        workspace.treatments.push(treatment);
        workspace.doses.push({ id: '33333333-3333-4333-8333-333333333333', treatmentId: treatment.id, name: treatment.name, dosage: treatment.dosage, unit: treatment.unit, scheduledAt: new Date(Date.now() - 3600000).toISOString(), timeZone: body.timeZone, status: 'pending', occurredAt: null, revision: 0 });
        workspace.summary = { activeTreatments: 1, scheduledDoses: 1, takenDoses: 0, pendingDoses: 1 };
      }
      if (scenario === 'retry' && !failedOnce) { failedOnce = true; return reply({ message: 'SYNTHETIC_PRIVATE_DETAIL' }, 503); }
      return reply(workspace.treatments[0], 201);
    }
    if (/\/doses\/[^/]+\/events$/.test(pathname)) {
      const body = request.postDataJSON(); writes.push({ kind: 'event', body });
      workspace.doses[0] = { ...workspace.doses[0], status: body.status, occurredAt: body.occurredAt ?? new Date().toISOString(), revision: 1 };
      workspace.history = [{ id: '44444444-4444-4444-8444-444444444444', doseId: workspace.doses[0].id, treatmentId: workspace.treatments[0].id, name: workspace.treatments[0].name, status: body.status, occurredAt: workspace.doses[0].occurredAt, recordedAt: new Date().toISOString(), reason: body.reason ?? null, origin: 'patient_reported' }];
      workspace.summary.takenDoses = body.status === 'taken' ? 1 : 0;
      workspace.summary.pendingDoses = 0;
      if (scenario === 'dose-retry' && !doseFailedOnce) { doseFailedOnce = true; return reply({}, 503); }
      return reply(workspace.doses[0]);
    }
    if (/\/treatments\/[^/]+\/status$/.test(pathname)) {
      const body = request.postDataJSON(); writes.push({ kind: 'status', body });
      workspace.treatments[0] = { ...workspace.treatments[0], status: body.status, revision: workspace.treatments[0].revision + 1 };
      workspace.summary.activeTreatments = workspace.treatments.filter(item => item.status === 'active').length;
      return reply(workspace.treatments[0]);
    }
    if (pathname.includes('/appointments') || pathname.includes('/requests')) return reply({ items: [] });
    if (pathname.endsWith('/insurers') || pathname.endsWith('/catalog')) return reply([]);
    return reply({}, 404);
  });

  try {
    await page.goto(origin);
    const nav = page.getByRole('navigation', { name: english ? 'Main navigation' : 'Navegación principal' });
    const verifyHeader = async () => {
      const header = page.locator('.medications-header');
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        const heading = await header.locator('.medications-heading-row').boundingBox();
        const actions = await header.locator('.medications-header-actions').boundingBox();
        assert(Math.abs(heading.y + heading.height / 2 - actions.y - actions.height / 2) < 2, `Header title and controls share one row at ${width}: ${JSON.stringify({heading, actions})}`);
        assert(actions.x >= heading.x + heading.width + 6, 'Header controls do not overlap the title');
        for (const button of await header.locator('ion-button').all()) {
          const box = await button.boundingBox();
          assert(box.width >= 43.9 && box.height >= 43.9, `Header touch targets are at least 44 px at ${width}: ${JSON.stringify(box)}`);
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Header fits the screen');
        if (width === 390) await header.screenshot({ path: path.join(output, scenario + '-header.png'), animations: 'disabled' });
      }
      await page.setViewportSize({ width: 390, height: 900 });
    };

    const profileTab = nav.getByRole('button', { name: english ? 'Profile' : 'Perfil', exact: true });
    await expect(profileTab).toBeVisible();
    await expect(nav.getByRole('button', { name: english ? 'Medication control' : 'Control de medicamentos', exact: true })).toHaveCount(0);
    await profileTab.click();
    await expect(page.locator('.pf-screen')).toBeVisible();
    await nav.getByRole('button', { name: english ? 'Home' : 'Inicio', exact: true }).click();
    if (scenario === 'disabled' || scenario === 'old-server' || scenario === 'capability-error') {
      const modules = page.locator('.hm-modules');
      await expect(modules.getByRole('button', { name: /Control de medicamentos/ })).toBeVisible();
      await expect(modules.getByRole('button', { name: /Mi perfil/ })).toHaveCount(0);
      await modules.scrollIntoViewIfNeeded();
      await modules.screenshot({ path: path.join(output, scenario + '-home-modules.png') });
      await modules.getByRole('button', { name: /Control de medicamentos/ }).click();
      await expect(page.getByRole('heading', { name: 'Control de medicamentos', exact: true })).toBeVisible();
      await verifyHeader();
      await expect(page.getByRole('button', { name: 'Añadir medicamento', exact: true })).toHaveCount(0);
      await nav.getByRole('button', { name: 'Perfil', exact: true }).click();
      await expect(page.locator('.medications-page')).toHaveCount(0);
      assert.equal(writes.length, 0);
    } else {
      await expect(page.locator('.hm-modules').getByRole('button', { name: english ? /Medication control/ : /Control de medicamentos/ })).toBeVisible();
      await page.locator('.hm-modules').getByRole('button', { name: english ? /Medication control/ : /Control de medicamentos/ }).click();
      await expect(page.getByRole('heading', { name: english ? 'Medication control' : 'Control de medicamentos', exact: true })).toBeVisible();
      await verifyHeader();
      if (scenario === 'forbidden' || scenario === 'read-only') {
        if (scenario === 'forbidden') await expect(page.getByRole('alert')).toContainText('No tienes acceso');
        else await expect(page.getByText('Sin tomas programadas para hoy', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Añadir medicamento', exact: true })).toHaveCount(0);
        assert.equal(writes.length, 0);
        await page.screenshot({ path: path.join(output, scenario + '.png') });
        results.push({ scenario, passed: true });
        continue;
      }
      await page.getByRole('button', { name: english ? 'Add medication' : 'Añadir medicamento', exact: true }).first().click();
      await page.getByRole('textbox', { name: english ? 'Medication name' : 'Nombre del medicamento', exact: true }).fill('Tratamiento QA');
      await page.getByRole('textbox', { name: english ? 'Amount per dose' : 'Cantidad por toma', exact: true }).fill('1');
      await page.getByRole('textbox', { name: english ? 'Unit' : 'Unidad', exact: true }).fill('tableta');
      await page.getByRole('textbox', { name: english ? 'Times' : 'Horarios', exact: true }).fill('00:01');
      await page.getByRole('button', { name: english ? 'Save medication' : 'Guardar medicamento', exact: true }).click();
      if (scenario === 'retry') {
        await expect(page.getByRole('alert')).toContainText('No pudimos guardar');
        await expect(page.getByText('SYNTHETIC_PRIVATE_DETAIL', { exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Guardar medicamento', exact: true }).click();
        assert.equal(writes[0].body.clientRequestId, writes[1].body.clientRequestId, 'Ambiguous save retry must preserve operation ID');
      }
      await expect(page.locator('.medications-dose').filter({ hasText: 'Tratamiento QA' })).toBeVisible();
      await page.getByRole('button', { name: scenario === 'omitted' ? 'Omitir' : english ? 'Taken' : 'Ya lo tomé', exact: true }).click();
      if (scenario === 'dose-retry') {
        await expect(page.getByRole('alert')).toContainText('No pudimos guardar');
        await page.getByRole('button', { name: 'Ya lo tomé', exact: true }).click();
        const events = writes.filter(write => write.kind === 'event');
        assert.equal(events[0].body.clientRequestId, events[1].body.clientRequestId);
        assert.equal(events[0].body.occurredAt, events[1].body.occurredAt);
      }
      await expect(page.locator('.medications-dose')).toContainText(scenario === 'omitted' ? 'Omitido' : english ? 'Taken' : 'Tomado');
      await page.locator('ion-segment-button[value="history"]').click();
      await expect(page.locator('.medications-history')).toContainText('Tratamiento QA');
      await expect(page.locator('.medications-history')).toContainText(scenario === 'omitted' ? 'Omitido' : english ? 'Taken' : 'Tomado');
      await page.locator('ion-segment-button[value="treatments"]').click();
      await page.getByRole('button', { name: english ? 'Pause' : 'Pausar', exact: true }).click();
      await expect(page.locator('.medications-treatment')).toContainText(english ? 'Paused' : 'Pausado');
      await expect(page.getByRole('button', { name: english ? 'Resume' : 'Reanudar', exact: true })).toBeEnabled();
      await expect(page.getByText(english ? 'Treatment updated' : 'Tratamiento actualizado', { exact: false })).toBeHidden();
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}`);
        if (width === 390) await page.screenshot({ path: path.join(output, scenario + '-phone.png') });
        const box = await page.locator('.medications-page').boundingBox();
        assert(box.x >= -1 && box.x + box.width <= width + 1, `The medication page stays inside the viewport at ${width}`);
      }
      await expect(nav.getByRole('button', { name: english ? 'Profile' : 'Perfil', exact: true })).toBeVisible();
      assert.equal(writes.filter(w => w.kind === 'event').length, scenario === 'dose-retry' ? 2 : 1);
      if (scenario === 'enabled') {
        await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
        await expect(page.locator('.medications-treatment .medications-badge')).toHaveText('Activo');
        await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
        await expect(page.locator('.medications-treatment .medications-badge')).toHaveText('Finalizado');
        await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toHaveCount(0);
      }
    }
    await page.screenshot({ path: path.join(output, scenario + '.png') });
    results.push({ scenario, passed: true });
  } catch (error) {
    await page.screenshot({ path: path.join(output, scenario + '-failed.png') }).catch(() => {});
    results.push({ scenario, passed: false, error: error.message });
  } finally { await page.close(); }
}
await browser.close();
await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => !result.passed)) process.exitCode = 1;

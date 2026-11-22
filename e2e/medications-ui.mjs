/** UI E2E with explicit synthetic HTTP fixtures. Cross-app/real DB coverage is separate. */
import { chromium, expect, webkit } from 'playwright/test';
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
const browser = await (process.env.COP_MEDICATIONS_BROWSER === 'webkit' ? webkit : chromium).launch();
const scenarios = process.env.COP_MEDICATIONS_SCENARIOS?.split(',') ?? ['enabled', 'disabled', 'old-server', 'capability-error', 'read-only', 'forbidden', 'english', 'retry', 'dose-retry', 'omitted', 'legacy-crypto', 'photo-match', 'photo-mismatch', 'snooze', 'agenda-es', 'agenda-en', 'empty-es', 'empty-en', 'add-photo', 'add-photo-empty', 'catalog-retry', 'catalog-empty', 'catalog-autofill-en', 'layout-es', 'layout-en'];
const results = [];

for (const scenario of scenarios) {
  const english = scenario === 'english' || scenario.endsWith('-en');
  const agenda = scenario.startsWith('agenda-');
  const empty = scenario.startsWith('empty-');
  const layout = scenario.startsWith('layout-');
  const modern = agenda || empty || layout;
  const localDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Bogota'}).format(new Date());
  const at = time => new Date(localDate + 'T' + time + ':00-05:00').toISOString();
  const simulatedNow = at('17:15');
  const addPhoto = scenario.startsWith('add-photo');
  const photo = addPhoto || scenario.startsWith('photo-');
  const catalogProduct = { id: '55555555-5555-4555-8555-555555555555', name: 'Tratamiento QA', description: 'Presentación de prueba', code: null };
  const brandProducts = [
    { id: '991001', name: 'Tylenol QA tablets', strength: '325 mg', doseForm: 'Oral Tablet', dosage: 2, doseUnit: 'tablet', route: 'Oral' },
    { id: '991002', name: 'Tylenol QA liquid', strength: '160 mg/5 mL', doseForm: 'Oral Liquid', doseUnit: 'mL', route: 'Oral' },
  ];
  const longName = 'Tratamiento QA de liberación prolongada con concentración combinada 1000 mg / 125 mg';
  const longUnit = 'tabletas de liberación prolongada';
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, timezoneId: 'America/Bogota', reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  const applicationErrors = [];
  if (modern) {
    page.on('pageerror', error => applicationErrors.push(error.message));
    page.on('console', entry => {
      if (entry.type() === 'error' && !entry.text().startsWith('Failed to load resource:')) applicationErrors.push(entry.text());
    });
    await page.clock.setFixedTime(new Date(simulatedNow));
  }
  if (scenario === 'legacy-crypto') await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }));
  if (english) await page.addInitScript(() => localStorage.setItem('antares_lang', 'en'));
  if (photo) await page.addInitScript(label => {
    // Solo sustituye el puente nativo. La UI y la comparación de etiquetas son reales.
    window.Capacitor = {
      PluginHeaders: [
        { name: 'Camera', methods: [{ name: 'getPhoto', rtype: 'promise' }] },
        { name: 'MedicationLabel', methods: [{ name: 'read', rtype: 'promise' }] },
      ],
      nativePromise: async plugin => {
        if (plugin === 'Camera') {
          return { base64String: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0XQAAAAASUVORK5CYII=', format: 'png' };
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        return { text: label };
      },
    };
  }, scenario === 'add-photo' ? 'Etiqueta QA\nTratamiento QA 500 mg\n500 mg' : scenario === 'add-photo-empty' ? '' :
    scenario === 'photo-match' ? 'Tratamiento QA' : 'Otro medicamento');
  const writes = [];
  const catalogSearches = [];
  let failedOnce = false;
  let doseFailedOnce = false;
  const workspace = {
    patient: { id: userId, name: 'Paciente Medicamentos QA', mrn: 'QA-MED' },
    access: { enabled: true, revision: 1 }, treatments: [], doses: [], history: [],
    summary: { activeTreatments: 0, scheduledDoses: 0, takenDoses: 0, pendingDoses: 0 },
  };
  if (modern) workspace.version = '66666666-6666-4666-8666-666666666666';
  if (agenda) {
    workspace.treatments.push({
      id: 'assigned', name: 'Tratamiento asignado QA', productType: 'medication', origin: 'staff_recorded',
      isRequired: true, status: 'active', dosage: 2, unit: 'mg', route: 'oral', instructions: 'QA',
      times: ['08:15','09:30','13:00','16:10','16:30','20:45'], timeZone: 'America/Bogota', startDate: localDate,
    });
    for (const [name, time, status] of [
      ['Primera dosis QA', '08:15', 'taken'], ['Segunda dosis QA', '09:30', 'omitted'],
      ['Dosis mediodía QA', '13:00', 'taken'], ['Dosis prioritaria QA', '16:10', 'pending'],
      ['Dosis siguiente QA', '16:30', 'pending'], ['Dosis noche QA', '20:45', 'pending'],
    ]) {
      workspace.doses.push({
        id: 'dose-' + time, treatmentId: 'assigned', name, status, dosage: 2, unit: 'mg',
        scheduledAt: at(time), timeZone: 'America/Bogota', instructions: 'QA',
        occurredAt: status === 'pending' ? null : at(time), revision: status === 'pending' ? 0 : 1,
      });
    }
    workspace.summary = {activeTreatments: 1, scheduledDoses: 6, takenDoses: 2, pendingDoses: 3};
  }
  if (layout) {
    workspace.treatments.push({
      id: 'layout-treatment', name: longName, productType: 'medication', origin: 'patient_reported',
      isRequired: false, status: 'active', dosage: 2, unit: longUnit, route: 'oral',
      instructions: 'Instrucciones de prueba de varias líneas para la presentación registrada.',
      times: ['08:00', '12:00', '15:00', '18:00', '20:00', '22:00'],
      weekdayMask: 127, timeZone: 'America/Bogota', startDate: localDate,
    });
    workspace.doses.push({
      id: 'layout-dose', treatmentId: 'layout-treatment', name: longName, status: 'pending',
      dosage: 2, unit: longUnit, scheduledAt: at('00:01'), timeZone: 'America/Bogota', occurredAt: null, revision: 0,
    });
    workspace.history.push({
      id: 'layout-event', doseId: 'layout-dose-before', treatmentId: 'layout-treatment', name: longName,
      status: 'taken', occurredAt: at('08:00'), recordedAt: at('08:00'), reason: null, origin: 'patient_reported',
    });
    workspace.summary = { activeTreatments: 1, scheduledDoses: 1, takenDoses: 0, pendingDoses: 1 };
  }
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
      return reply({ policyVersion: 'medications-v1:1', modules: { medications: { enabled: scenario !== 'disabled', canView: true, canManage: scenario !== 'read-only', canManageAccess: false, canSnooze: modern || scenario === 'snooze' } } });
    }
    if (pathname === '/api/v1/me/medications/version' && modern) return reply(workspace.version);
    if (pathname === '/api/v1/me/medications') return scenario === 'forbidden' ? reply({}, 403) : reply(workspace);
    if (layout && pathname === '/api/v1/me/medications/reminder-preferences') {
      return reply({ push: true, inApp: true, whatsApp: false, leadMinutes: 10, followUpMinutes: 30 });
    }
    if (layout && pathname === '/api/v1/me/medications/inventory') return reply({
      items: [{
        id: 'layout-supply', patientId: userId, treatmentId: 'layout-treatment', name: longName, unit: longUnit,
        balance: 12, dailyUsage: 2, daysRemaining: 6, expiresOn: localDate, revision: 1, tracked: true,
      }], total: 1, page: 1, pageSize: 20,
    });
    if (layout && pathname === '/api/v1/me/medications/effects') return reply([{
      id: 'layout-effect', patientId: userId, treatmentId: 'layout-treatment', treatmentName: longName,
      symptom: 'Malestar reportado para la prueba de texto largo y ajuste de tarjeta', severity: 'moderate',
      status: 'follow_up', notes: 'Observación de prueba', occurredAt: at('09:00'), createdAt: at('09:00'), revision: 1, followUps: [],
    }]);
    if (pathname === '/api/v1/me/medications/catalog/us' && scenario === 'catalog-autofill-en') {
      return reply(url.searchParams.get('search') === 'tyl' ? brandProducts : []);
    }
    if (pathname === '/api/v1/catalogs/medications') {
      const search = url.searchParams.get('search');
      catalogSearches.push(search);
      if (scenario === 'catalog-retry' && catalogSearches.length === 1) return reply({}, 503);
      return reply(search && catalogProduct.name.toLowerCase().includes(search.toLowerCase()) ? [catalogProduct] : []);
    }
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
    if (/\/doses\/[^/]+\/snooze$/.test(pathname)) {
      const body = request.postDataJSON();
      writes.push({ kind: 'snooze', body });
      if (modern) {
        const dose = workspace.doses.find(item => item.scheduledAt === body.scheduledAt);
        dose.snoozedUntil = new Date(Date.parse(simulatedNow) + body.minutes * 60_000).toISOString();
      }
      return route.fulfill({ status: 204 });
    }
    if (/\/doses\/[^/]+\/events$/.test(pathname)) {
      const body = request.postDataJSON(); writes.push({ kind: 'event', body });
      if (modern) {
        const dose = workspace.doses.find(item => item.scheduledAt === body.scheduledAt);
        dose.status = body.status;
        dose.occurredAt = body.status === 'pending' ? null : body.occurredAt;
        dose.undoUntil = body.status === 'taken' ? at('17:20') : null;
        dose.revision++;
        return reply(dose);
      }
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
    if (modern) await expect(page.locator('.pf-menu-row').filter({hasText: english ? 'Medications and supplements' : 'Medicamentos y suplementos'})).toBeVisible();
    await nav.getByRole('button', { name: english ? 'Home' : 'Inicio', exact: true }).click();
    if (scenario === 'disabled' || scenario === 'old-server' || scenario === 'capability-error') {
      const modules = page.locator('.hm-modules');
      await expect(modules.getByRole('button', { name: /Control de medicamentos/ })).toBeVisible();
      await expect(modules.getByRole('button', { name: /Mi perfil/ })).toHaveCount(0);
      await modules.scrollIntoViewIfNeeded();
      await modules.screenshot({ path: path.join(output, scenario + '-home-modules.png') });
      await modules.getByRole('button', { name: /Control de medicamentos/ }).click();
      await expect(page.getByRole('heading', { name: 'Mi medicación', exact: true })).toBeVisible();
      await verifyHeader();
      await expect(page.getByRole('button', { name: 'Añadir medicamento', exact: true })).toHaveCount(0);
      await nav.getByRole('button', { name: 'Perfil', exact: true }).click();
      await expect(page.locator('.medications-page')).toHaveCount(0);
      assert.equal(writes.length, 0);
    } else {
      const medicationCard = page.locator('.hm-modules').getByRole('button', { name: english ? /Medication control/ : /Control de medicamentos/ });
      await expect(medicationCard).toBeVisible();
      if (agenda) await expect(page.locator('.hm-module-card').filter({hasText:'Dosis prioritaria QA'})).toBeVisible();
      await medicationCard.click();
      await expect(page.getByRole('heading', { name: english ? 'My medication' : 'Mi medicación', exact: true })).toBeVisible();
      await verifyHeader();
      if (layout) {
        const fit = (locator, title) => locator.evaluate((element, name) => {
          if (element.scrollWidth > element.clientWidth + 1) {
            throw new Error(`${name} clips content (${element.scrollWidth} > ${element.clientWidth})`);
          }
        }, title);
        const wrapTitle = async (locator, title, width) => {
          await expect(locator).toBeVisible();
          if (width < 450) {
            assert(await locator.evaluate(el => el.getBoundingClientRect().height >= 1.9 * parseFloat(getComputedStyle(el).lineHeight)), title + ' wraps without truncating');
          }
          await fit(locator, title);
        };
        const fieldSpacing = async (field) => {
          await expect(field).toBeVisible();
          const spacing = await field.evaluate(element => {
            const box = element.getBoundingClientRect();
            const label = element.querySelector('.label-text').getBoundingClientRect();
            const value = element.querySelector('input').getBoundingClientRect();
            return { labelInset: label.left - box.left, valueInset: value.left - box.left, gap: value.top - label.bottom };
          });
          assert(spacing.labelInset >= 9 && spacing.valueInset >= 9, 'Field label and value are inset from the border');
          assert(spacing.gap >= 5, 'Field label and value have vertical space (' + spacing.gap + ' px)');
        };
        const tab = async (value) => {
          await page.locator(`ion-segment-button[value="${value}"]`).click();
          await page.locator('.medications-scroll').evaluate(el => { el.scrollTop = 0; });
        };
        const capture = async (tabName, width) => {
          if (width === 390) await page.screenshot({ path: path.join(output, `${scenario}-${tabName}.png`), animations: 'disabled' });
        };
        for (const width of [320, 390, 768]) {
          await page.setViewportSize({ width, height: 844 });
          await tab('today');
          await wrapTitle(page.locator('.medications-dose h3').first(), 'Today medication name', width);
          await fit(page.locator('.medications-scroll'), 'Today');
          for (const button of await page.locator('.medications-tabs ion-segment-button').all()) {
            const box = await button.boundingBox();
            assert(box.width >= 43.9 && box.height >= 43.9, 'Tabs have 44 px targets');
            await fit(button.locator('[part="native"]'), 'Medication tab');
          }
          await capture('today', width);
          await page.getByRole('button', { name: english ? 'Medication reminders' : 'Recordatorios de medicación', exact: true }).click();
          const reminders = page.locator('.medications-reminder-modal');
          await fieldSpacing(reminders.locator('ion-input').first());
          await fit(reminders.locator('.medications-reminder-channels'), 'Reminder toggles');
          await reminders.getByRole('button', { name: english ? 'Cancel' : 'Cancelar', exact: true }).click();
          await expect(reminders).toHaveCount(0);
          await tab('treatments');
          await wrapTitle(page.locator('.medications-treatment h3').first(), 'My list medication name', width);
          await fit(page.locator('.medications-times').first(), 'Treatment schedule');
          await capture('my-list', width);
          await tab('inventory');
          await wrapTitle(page.locator('.medications-stock-card ion-card-title').first(), 'Inventory medication name', width);
          await fit(page.locator('.medications-stock-balance').first(), 'Stock balance');
          await capture('inventory', width);
          await page.locator('.medications-stock-actions ion-button').first().click();
          await fieldSpacing(page.locator('.medications-form ion-input').first());
          await page.getByRole('button', { name: english ? 'Cancel' : 'Cancelar', exact: true }).click();
          await tab('effects');
          await wrapTitle(page.locator('.medications-effect-card ion-card-title').first(), 'Report title', width);
          await capture('reports', width);
          await page.locator('.medications-effect-cta').click();
          await fieldSpacing(page.locator('.medications-form ion-input').first());
          await fit(page.locator('.medications-form ion-select').first(), 'Associated medication field');
          await page.getByRole('button', { name: english ? 'Cancel' : 'Cancelar', exact: true }).click();
          await tab('history');
          await wrapTitle(page.locator('.medications-history-row h3').first(), 'History medication name', width);
          await capture('history', width);
          const last = page.locator('.medications-history-row').last();
          await last.scrollIntoViewIfNeeded();
          const [row, dock] = await Promise.all([last.boundingBox(), nav.boundingBox()]);
          assert(row.y + row.height <= dock.y + 1, 'The last history row scrolls above the bottom dock');
        }
        assert.equal(writes.length, 0);
        results.push({ scenario, passed: true });
        continue;
      }
      if (modern) {
        const next = page.locator('.medications-dose-next');
        const timeline = page.locator('.medications-timeline');
        const emptyText = english ? 'No active medications' : 'Sin medicamentos activos';
        for (const width of [320, 390, 768]) {
          await page.setViewportSize({width, height: 900});
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow at ' + width);
          if (empty) {
            await expect(page.getByRole('heading', {name: emptyText, exact: true})).toBeVisible();
            await expect(page.locator('.medications-overview')).toHaveCount(0);
          } else {
            await expect(next).toContainText('Dosis prioritaria QA');
            await expect(next).toContainText(english ? 'Overdue' : 'Atrasada');
            await expect(timeline).toBeVisible();
            assert(await next.evaluate(card => Boolean(card.compareDocumentPosition(document.querySelector('.medications-timeline')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Priority dose appears before the timeline');
            await expect(timeline.locator('section > h3')).toHaveText(english ? ['Morning','Afternoon','Evening'] : ['Mañana','Tarde','Noche']);
            await expect(timeline.locator('section').first().locator('article h3')).toHaveText(['Primera dosis QA', 'Segunda dosis QA']);
            for (const action of await next.locator('ion-button').all()) {
              const rect = await action.boundingBox();
              assert(rect.width >= 43.9 && rect.height >= 43.9, 'Dose actions have 44 px targets at ' + width);
            }
          }
        }
        if (agenda) {
          await next.getByRole('button', {name: english ? 'Snooze 15 min' : 'Posponer 15 min', exact: true}).click();
          await expect(next).toContainText(english ? 'Reminder snoozed' : 'Recordatorio pospuesto');
          assert.equal(writes[0]?.body.minutes, 15);
          const priorityDose = page.locator('.medications-dose').filter({hasText:'Dosis prioritaria QA'});
          await priorityDose.getByRole('button', {name: english ? 'I took it' : 'Ya lo tomé', exact: true}).click();
          const undo = priorityDose.getByRole('button', {name: english ? 'Undo dose' : 'Deshacer toma', exact: true});
          await expect(undo).toBeVisible();
          assert((await undo.boundingBox()).height >= 43.9, 'Undo has a 44 px touch target');
          await undo.click();
          await expect(next).toContainText('Dosis prioritaria QA');
          await page.locator('.medications-dose').filter({hasText: 'Dosis siguiente QA'})
            .getByRole('button', {name: english ? 'Skip' : 'Omitir', exact: true}).click();
          await expect(page.locator('.medications-dose').filter({hasText: 'Dosis siguiente QA'}))
            .toContainText(english ? 'Omitted' : 'Omitido');
          assert.deepEqual(writes.filter(write => write.kind === 'event').map(write => write.body.status), ['taken', 'pending', 'omitted']);
        } else {
          assert.equal(writes.length, 0);
        }
        assert.deepEqual(applicationErrors, [], 'The medication UI has no runtime or authored console errors');
        await page.screenshot({path: path.join(output, scenario + '.png')});
        results.push({scenario, passed:true});
        continue;
      }
      if (scenario === 'forbidden' || scenario === 'read-only') {
        if (scenario === 'forbidden') await expect(page.getByRole('alert')).toContainText('No tienes acceso');
        else await expect(page.getByRole('heading', {name:'Sin medicamentos activos', exact:true})).toBeVisible();
        await expect(page.getByRole('button', { name: 'Añadir medicamento', exact: true })).toHaveCount(0);
        assert.equal(writes.length, 0);
        await page.screenshot({ path: path.join(output, scenario + '.png') });
        results.push({ scenario, passed: true });
        continue;
      }
      await page.getByRole('button', { name: english ? 'Add medication' : 'Añadir medicamento', exact: true }).first().click();
      const search = page.getByRole('searchbox', { name: english ? 'Search medications' : 'Buscar medicamentos', exact: true });
      const save = page.getByRole('button', { name: english ? 'Save medication' : 'Guardar medicamento', exact: true });
      if (scenario === 'catalog-autofill-en') {
        const amount = page.getByRole('textbox', { name: 'Amount per dose', exact: true });
        const unit = page.getByRole('textbox', { name: 'Unit', exact: true });
        const route = page.getByRole('textbox', { name: 'Route of administration', exact: true });
        await search.fill('tyl');
        await page.getByRole('button', { name: /Tylenol QA tablets/ }).click();
        await expect(page.getByText(/325 mg/)).toBeVisible();
        await expect(amount).toHaveValue('2');
        await expect(unit).toHaveValue('tablet');
        await expect(route).toHaveValue('Oral');
        await unit.fill('mg');
        await expect(amount).toHaveValue('');
        await page.getByRole('button', { name: 'Change', exact: true }).click();
        await page.getByRole('button', { name: /Tylenol QA liquid/ }).click();
        await expect(amount).toHaveValue('');
        await expect(unit).toHaveValue('mL');
        await expect(route).toHaveValue('Oral');
        await expect(page.getByRole('textbox', { name: 'Times', exact: true })).toHaveValue('08:00');
        await expect(page.getByRole('textbox', { name: 'Instructions', exact: true })).toHaveValue('');
        assert.equal(writes.length, 0, 'Selection does not save a medication');
        await amount.fill('2.5');
        await route.fill('oral');
        await save.click();
        await expect(page.locator('ion-modal.medications-entry-modal')).toBeHidden();
        const { medicationId, rxCui, dosage, unit: savedUnit, route: savedRoute } = writes[0].body;
        assert.deepEqual({ medicationId, rxCui, dosage, savedUnit, savedRoute }, {
          medicationId: null, rxCui: '991002', dosage: 2.5, savedUnit: 'mL', savedRoute: 'oral',
        });
        results.push({ scenario, passed: true });
        continue;
      }
      if (addPhoto) {
        const takePhoto = page.getByRole('button', { name: 'Tomar foto del empaque', exact: true });
        await expect(takePhoto).toBeVisible();
        if (scenario === 'add-photo') {
          await page.screenshot({ path: path.join(output, 'add-medication.png'), animations: 'disabled' });
        }
        await takePhoto.click();
        if (scenario === 'add-photo') {
          await expect(search).toHaveValue('Etiqueta QA');
          await expect(page.getByRole('img', { name: 'Fotografía del empaque' })).toBeVisible();
          await expect(page.getByText('Sin resultados en el catálogo')).toBeVisible();
          await page.getByRole('button', { name: 'Tratamiento QA', exact: true }).click();
          await expect(search).toHaveValue('Tratamiento QA');
        } else {
          await expect(page.getByRole('status')).toContainText('No pudimos leer la etiqueta');
          await expect(search).toHaveValue('');
        }
        assert.equal(writes.length, 0, 'Scanning does not save a medication');
      }
      if (scenario === 'catalog-empty') {
        await search.fill('Borrador QA');
        await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await expect(search).toHaveCount(0);
        await page.getByRole('button', { name: 'Añadir medicamento', exact: true }).first().click();
        await expect(search).toHaveValue('');
      }
      if (scenario !== 'add-photo') {
        await search.fill(scenario === 'catalog-empty' ? 'Producto fuera del catálogo QA' : 'Tratamiento QA');
      }
      if (scenario === 'catalog-retry') {
        await expect(page.getByRole('alert')).toContainText('No pudimos consultar el catálogo');
        await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
      }
      await expect(save).toBeDisabled();
      if (scenario === 'catalog-empty') {
        await expect(page.getByText('Sin resultados en el catálogo')).toBeVisible();
        await page.getByRole('button', { name: 'Añadir sin catálogo', exact: true }).click();
        await expect(page.getByRole('textbox', { name: 'Nombre del medicamento', exact: true })).toHaveValue('Producto fuera del catálogo QA');
      } else {
        const result = page.getByRole('button', { name: /Tratamiento QA.*Presentación de prueba/ });
        await expect(result).toBeVisible();
        if (scenario === 'add-photo') {
          await page.screenshot({ path: path.join(output, 'add-photo-catalog-results.png') });
        }
        await result.click();
        assert(catalogSearches.includes('Tratamiento QA'), 'The selection comes from the API');
      }
      if (scenario === 'add-photo' || scenario === 'catalog-retry') {
        const form = page.locator('ion-modal.medications-entry-modal');
        for (const [width, height] of [[320, 740], [390, 844], [844, 390]]) {
          await page.setViewportSize({ width, height });
          assert(await form.locator('form').evaluate(element => element.scrollWidth <= element.clientWidth),
            'Form fits the viewport at ' + width + ' x ' + height);
          const type = form.locator('ion-select');
          const label = await type.locator('[part="label"]').boundingBox();
          const value = await type.locator('[part="text"]').boundingBox();
          assert(value.y - label.y - label.height >= 6, 'Product type label and value have room at ' + width + ' px');
          for (const field of await form.locator('ion-input').all()) {
            const fieldLabel = await field.locator('.label-text').boundingBox();
            const fieldValue = await field.locator('input').boundingBox();
            const gap = fieldValue.y - fieldLabel.y - fieldLabel.height;
            assert(gap >= 6, 'Text field label and value have room at ' + width + ' px (gap: ' + gap + ')');
          }
          const saveBox = await save.boundingBox();
          assert(saveBox.height >= 44 && saveBox.y + saveBox.height <= height, 'Save stays visible and tappable');
          await page.screenshot({ path: path.join(output, scenario + '-' + width + 'x' + height + '.png') });
        }
        await page.setViewportSize({ width: 390, height: 900 });
        if (scenario === 'add-photo') {
          await form.getByRole('textbox', { name: 'Indicaciones', exact: true }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, 'add-photo-schedule.png') });
        }
        const startDate = form.locator('ion-datetime-button').first();
        await startDate.click();
        const datePicker = page.locator('ion-modal.medications-date-modal');
        await datePicker.getByRole('button', { name: 'Listo', exact: true }).click();
        await expect(datePicker).toBeHidden();
        await expect(startDate).toBeVisible();
      }
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
      const customProduct = scenario === 'catalog-empty';
      await expect(page.locator('.medications-dose').filter({ hasText: customProduct ? 'Producto fuera del catálogo QA' : catalogProduct.name })).toBeVisible();
      assert.equal(writes[0].body.medicationId, customProduct ? null : catalogProduct.id);
      if (addPhoto || scenario === 'catalog-retry' || customProduct) {
        assert.deepEqual(writes.map(write => write.kind), ['create']);
        results.push({ scenario, passed: true });
        continue;
      }
      if (scenario === 'snooze') {
        await page.getByRole('button', { name: 'Posponer recordatorio', exact: true }).click();
        await page.getByRole('button', { name: '30 minutos', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Recordatorio pospuesto', exact: true })).toBeDisabled();
        const snoozes = writes.filter(write => write.kind === 'snooze');
        assert.equal(snoozes.length, 1);
        assert.equal(snoozes[0].body.minutes, 30);
        assert.equal(snoozes[0].body.scheduledAt, workspace.doses[0].scheduledAt);
      }
      if (scenario === 'omitted') {
        const skip = page.getByRole('button', { name: 'Omitir', exact: true });
        const confirm = page.locator('ion-alert').filter({ hasText: '¿Seguro que quieres omitir esta toma?' });
        await skip.click();
        await expect(confirm.getByText('Tratamiento QA', { exact: true })).toBeVisible();
        assert.equal(writes.filter(write => write.kind === 'event').length, 0);
        await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await expect(confirm).toBeHidden();
        await expect(page.locator('.medications-dose')).toContainText('Pendiente');
        assert.equal(writes.filter(write => write.kind === 'event').length, 0);
        await skip.click();
        await confirm.getByRole('button', { name: 'Omitir toma', exact: true }).click();
      } else {
        const dialog = page.locator('ion-modal.medications-capture-modal');
        await page.getByRole('button', { name: english ? 'Log dose' : 'Registrar toma', exact: true }).click();
        if (photo) {
          await expect(dialog.getByRole('button', { name: 'Registrar manualmente', exact: true })).toBeVisible();
          await dialog.getByRole('button', { name: 'Tomar foto', exact: true }).click();
          const scanStage = dialog.locator('.food-photo-stage.is-analyzing');
          await expect(scanStage).toBeVisible();
          await expect(scanStage.getByRole('img', { name: 'Fotografía del empaque' })).toBeVisible();
          await expect(dialog.getByRole('status')).toContainText(
            scenario === 'photo-match' ? 'El nombre coincide' : 'No hubo una coincidencia clara',
          );
          if (scenario === 'photo-mismatch') {
            await expect(dialog.getByRole('button', { name: 'Confirmar toma', exact: true })).toHaveCount(0);
          }
        }
        assert.equal(writes.filter(write => write.kind === 'event').length, 0, 'Opening or scanning must not record intake');
        if (scenario !== 'photo-match') {
          await dialog.getByRole('button', { name: english ? 'Log manually' : 'Registrar manualmente', exact: true }).click();
        }
        if (scenario === 'photo-match') {
          await dialog.screenshot({ path: path.join(output, 'photo-confirmation.png') });
        }
        const confirm = dialog.getByRole('button', { name: english ? 'Confirm intake' : 'Confirmar toma', exact: true });
        await confirm.click();
        if (scenario === 'dose-retry') {
          await expect(dialog.getByRole('alert')).toContainText('No pudimos guardar');
          await confirm.click();
          const events = writes.filter(write => write.kind === 'event');
          assert.equal(events[0].body.clientRequestId, events[1].body.clientRequestId);
          assert.equal(events[0].body.occurredAt, events[1].body.occurredAt);
        }
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

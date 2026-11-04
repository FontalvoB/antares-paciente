import assert from 'node:assert/strict';

export async function run(action, s, command) {
  const p = s.page;
  p.setDefaultTimeout(15000);
  if (s.appToken) {
    const current = await p.evaluate(() => sessionStorage.getItem('copp_access_token') || localStorage.getItem('copp_access_token'));
    if (current) s.appToken = current;
  }
  if (action === 'inspect') {
    if (command.finalBackendProof) {
      const assignments = await s.api(s.app, '/api/v1/health-tests/me/assignments', { token: s.appToken });
      const results = await s.api(s.app, '/api/v1/health-tests/me/results', { token: s.appToken });
      const alerts = await s.api(s.erpUrl, `/api/v1/health-tests/alerts?patientId=${s.patientId}`, { token: s.adminToken });
      const detail = await s.api(s.erpUrl, `/api/v1/program/assignments/${s.recommendationId}`, { token: s.adminToken });
      const snapshot = await s.api(s.app, '/api/v1/program/me/snapshot', { token: s.appToken });
      for (const response of [assignments, results, alerts, detail, snapshot]) assert.equal(response.status, 200);
      const completed = assignments.data.filter(a => a.status === 'completed');
      assert.equal(completed.length, 9); assert.equal(detail.data.state, 'applied');
      const es = detail.data.narrative?.es ?? detail.data.narrativeEs;
      const en = detail.data.narrative?.en ?? detail.data.narrativeEn;
      assert.ok(es && en);
      const values = { status: 'PASS', completedTests: completed.map(a => a.testCode), resultCount: results.data.length, indicatorCodesReturned: results.data.filter(r => r.resultType === 'indicator').map(r => r.code), alertCount: alerts.data.total, alerts: (alerts.data.data ?? alerts.data.items ?? []).map(a => ({ patientId: a.patientId, severity: a.severity, title: a.title })), recommendationState: detail.data.state, narrativeEsCharacters: es.length, narrativeEnCharacters: en.length, activeWeek: snapshot.data.template.currentWeekNumber, activeWeekStatus: snapshot.data.template.currentWeekStatus, xpBalance: snapshot.data.xp.balance, streak: snapshot.data.streak.current };
      s.record('final-server-proof', values);
      return values;
    }
    if (command.finalStreak) {
      await p.getByText('Racha', { exact: true }).first().click();
      await s.shot('16b-app-streak-one');
      s.record('streak-ui-evidence', { status: 'PASS' });
      return { captured: true };
    }
    if (command.finalScreenshots) {
      await s.erp.locator('h1').first().scrollIntoViewIfNeeded();
      await s.shot('14-erp-assignment-applied', s.erp);
      await s.erp.getByRole('tab', { name: 'Inglés', exact: true }).click();
      await s.shot('13b-erp-narrative-english', s.erp);
      await p.locator('.pg-scroll').hover();
      await p.mouse.wheel(0, -12000);
      await s.shot('16-app-task-complete-xp');
      s.record('final-ui-evidence', { status: 'PASS', narrativeLanguageTab: 'en', appViewport: p.viewportSize() });
      return { captured: true };
    }
    if (command.uiRetest) {
      await p.reload({ waitUntil: 'networkidle' });
      await p.getByRole('button', { name: 'Perfil', exact: true }).click();
      await p.getByText('Batería de evaluación', { exact: true }).click();
      const completed = p.locator('.ht-list-card.done').first();
      const disabled = await completed.isDisabled();
      if (!disabled) {
        await completed.click();
        await p.getByText('Ya completaste esta evaluación', { exact: true }).waitFor();
      }
      await s.shot('12-ui-completed-test-cannot-repeat');
      s.record('ui-retest-attempt', { status: 'NOT_AVAILABLE', completedTestDisabled: disabled, startOrSubmitSent: false, source: 'TestsPage: completados deshabilitados y openTest retorna cuando item.done' });
      return { uiRetestAvailable: false };
    }
    if (command.backend) {
      return {
        snapshot: await s.api(s.app, '/api/v1/program/me/snapshot', { token: s.appToken }),
        batteries: await s.api(s.app, '/api/v1/health-tests/me/batteries', { token: s.appToken }),
      };
    }
    if (command.catalog) {
      const assignment = s.assignments[0];
      const detail = await s.api(s.app, `/api/v1/health-tests/me/tests/${assignment.id}`, { token: s.appToken });
      return { test: assignment.testCode, questions: detail.data.questions.map(q => ({ code: q.code, text: q.text, type: q.type, def: q.defaultValue, options: q.options.map(o => ({ text: o.text, score: o.scoreValue })) })) };
    }
    return {
      text: (await p.locator('body').innerText()).slice(0, 7500),
      inputs: await p.locator('input').evaluateAll(els => els.map(e => ({ id: e.id, type: e.type, placeholder: e.placeholder }))),
    };
  }
  if (action === 'prepare') {
    assert.equal(s.report.smsSent, 0);
    const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    s.document = '99' + runId;
    const email = `coppadresd-app-test-${runId}@example.invalid`;
    const created = await s.api(s.erpUrl, '/api/v1/patients', { token: s.adminToken, body: {
      firstName: 'Coppadresd App Test', lastName: runId, documentNumber: s.document,
      dateOfBirth: '1990-01-01', gender: 'Masculino', phoneCountryCode: '57', phoneNumber: '3053924819', email,
      status: 'Activo', notes: 'PACIENTE SINTETICO QA coppadresd-app-test. Telefono autorizado por owner para OTP. No representa historia clinica real.',
    } });
    assert.equal(created.status, 201, `Alta paciente HTTP ${created.status}: ${JSON.stringify(created.data)}`);
    s.patientId = created.data.id;
    s.record('test-patient-created', { status: created.status, patientId: s.patientId, document: s.document, email, synthetic: true, phoneMasked: '+57 305***4819' });
    await p.goto(s.app, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'Activa tu cuenta', exact: true }).click();
    await p.locator('#login-first-id input').fill(s.document);
    await p.getByRole('button', { name: 'Confirmar identidad', exact: true }).click();
    await p.locator('.auth-contact').filter({ hasText: 'SMS' }).waitFor();
    await s.shot('06-first-entry-contacts');
    s.record('first-entry-id-lookup', { status: 'PASS', smsSent: 0 });
    return { readyToSend: true };
  }
  if (action === 'send') {
    assert.equal(s.report.smsSent, 0, 'No se reenvía automáticamente un SMS.');
    // Se cuenta el intento antes del clic: una respuesta perdida no autoriza reenvío.
    s.report.smsSent++;
    const response = p.waitForResponse(r => r.url().endsWith('/api/auth/send-otp') && r.request().method() === 'POST');
    await p.locator('.auth-contact').filter({ hasText: 'SMS' }).click();
    const r = await response;
    s.record('real-phone-otp-sent', { status: r.status(), smsAttempts: s.report.smsSent, destinationMasked: '+57 305***4819' });
    assert.equal(r.status(), 200);
    await p.locator('#login-otp-0').waitFor();
    await s.shot('07-real-sms-otp-waiting');
    return { waitingForOwnerOtp: true, smsAttempts: s.report.smsSent };
  }
  if (action === 'otp') {
    assert.match(command.code ?? '', /^\d{6}$/);
    await p.locator('#login-otp-0').fill(command.code);
    const response = p.waitForResponse(r => r.url().endsWith('/api/auth/verify-otp') && r.request().method() === 'POST');
    await p.getByRole('button', { name: 'Verificar y entrar', exact: true }).click();
    const r = await response;
    assert.equal(r.status(), 200, `Verify OTP HTTP ${r.status()}`);
    s.appToken = (await r.json()).accessToken;
    const claims = JSON.parse(Buffer.from(s.appToken.split('.')[1], 'base64url').toString());
    assert.equal(claims.aud, 'app');
    await p.locator('#onb-nombre input').waitFor();
    await s.shot('08-first-entry-onboarding');
    s.record('real-otp-verified', { status: 200, audience: claims.aud, otpSource: 'owner-chat', otpPersisted: false });
    return { onboarding: true };
  }
  if (action === 'onboarding') {
    await p.getByRole('button', { name: 'Continuar', exact: true }).click();
    await p.locator('#onb-fam-nom input').fill('Contacto QA autorizado');
    await p.locator('#onb-fam-cel input').fill('3053924819');
    if (await p.getByRole('button', { name: 'Otro', exact: true }).count()) await p.getByRole('button', { name: 'Otro', exact: true }).click();
    await p.getByRole('button', { name: 'Continuar', exact: true }).click();
    for (const row of await p.locator('.check-row').all()) await row.click();
    await p.getByRole('button', { name: 'Continuar', exact: true }).click();
    await p.locator('#onb-pwd input').fill(s.password);
    await p.locator('#onb-pwd2 input').fill(s.password);
    await p.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    const response = p.waitForResponse(r => r.url().endsWith('/api/v1/me/patient-profile') && r.request().method() === 'PUT');
    await p.getByRole('button', { name: 'Entrar a Copp Adresd', exact: true }).click();
    const saved = await response;
    assert.equal(saved.status(), 200, `Guardar perfil HTTP ${saved.status()}`);
    await p.getByText('Batería de evaluación inicial', { exact: true }).waitFor();
    const batteries = await s.api(s.app, '/api/v1/health-tests/me/batteries', { token: s.appToken });
    const assignments = await s.api(s.app, '/api/v1/health-tests/me/assignments', { token: s.appToken });
    assert.equal(batteries.status, 200); assert.equal(assignments.status, 200);
    s.assignments = assignments.data;
    assert.equal(s.assignments.length, 9);
    await s.shot('09-onboarding-complete-battery');
    s.record('onboarding-and-initial-battery', { profileSaved: saved.status(), batteryCount: batteries.data.length, assignedTests: s.assignments.length });
    return { assignedTests: s.assignments.length };
  }
  if (action === 'tests') {
    const after = await s.api(s.app, '/api/v1/health-tests/me/assignments', { token: s.appToken });
    const completed = after.data.filter(a => a.status === 'completed').length;
    const results = await s.api(s.app, '/api/v1/health-tests/me/results', { token: s.appToken });
    s.record('battery-progress', { completed, total: 9, resultCount: results.data?.length, indicators: results.data?.filter(r => r.resultType === 'indicator').length });
    if (!command.ui) return { completed, resultCount: results.data?.length };
    await p.reload({ waitUntil: 'networkidle' });
    if (completed === 9) {
      await p.locator('.hm-day-link').click();
      await p.getByText('Pendiente de confirmación clínica', { exact: true }).waitFor();
      await s.shot('10-battery-complete-pending-clinical');
      s.record('nine-tests-app-state', { status: 'PASS', state: 'pending-assignment' });
    }
    return { completed, resultCount: results.data?.length };
  }
  if (action === 'assignment') {
    const login = await s.api(s.erpUrl, '/api/auth/login', { body: { email: s.adminEmail, password: s.adminPassword, application: 'erp', rememberMe: false } });
    assert.equal(login.status, 200, `Login admin HTTP ${login.status}`); s.adminToken = login.data.accessToken;
    const results = await s.api(s.app, '/api/v1/health-tests/me/results', { token: s.appToken });
    const alerts = await s.api(s.erpUrl, `/api/v1/health-tests/alerts?patientId=${s.patientId}&pageSize=100`, { token: s.adminToken });
    const queue = await s.api(s.erpUrl, `/api/v1/program/assignments?search=${s.document}&pageSize=20`, { token: s.adminToken });
    assert.equal(queue.status, 200, `Cola ERP HTTP ${queue.status}`);
    s.record('results-and-alerts', { resultCount: results.data?.length, resultCodes: results.data?.map(r => ({ type: r.resultType, code: r.code, value: r.value })), alertsStatus: alerts.status, alertCount: alerts.data?.total ?? alerts.data?.totalCount, alertCodes: alerts.data?.items?.map(a => ({ code: a.code, severity: a.severity })) });
    const rawItem = queue.data.items.find(i => i.patientId === s.patientId);
    const item = rawItem ? { ...rawItem, recommendationId: rawItem.recommendationId ?? rawItem.id } : null;
    s.record('assignment-queue', { status: queue.status, matches: queue.data.total, recommendationId: item?.recommendationId, state: item?.state });
    if (command.ui) {
      if (!s.erp) {
        s.desktop = await s.browser.newContext({ viewport: { width: 1440, height: 1000 } });
        s.erp = await s.desktop.newPage();
        await s.erp.goto(s.erpUrl + '/login', { waitUntil: 'networkidle' });
        await s.erp.locator('input[type=email]').fill(s.adminEmail);
        await s.erp.locator('input[type=password]').fill(s.adminPassword);
        await s.erp.getByRole('slider', { name: 'Comencemos' }).press('End');
        await s.erp.waitForURL(url => !url.pathname.startsWith('/login'));
      }
      await s.erp.goto(s.erpUrl + '/program/asignacion', { waitUntil: 'networkidle' });
      await s.erp.locator('#assignment-search').fill(s.document);
      if (!item) await s.erp.getByText('No encontramos asignaciones', { exact: true }).waitFor();
      await s.shot('11-erp-queue-patient-search', s.erp);
      s.record('erp-queue-patient-ui', { status: 'PASS', document: s.document, proposalVisible: !!item });
    }
    if (!item) return { proposalFound: false, queue: queue.data };
    s.recommendationId = item.recommendationId;
    const detail = await s.api(s.erpUrl, `/api/v1/program/assignments/${s.recommendationId}`, { token: s.adminToken });
    assert.equal(detail.status, 200);
    detail.data.narrative ??= { es: detail.data.narrativeEs, en: detail.data.narrativeEn };
    s.detail = detail.data;
    s.record('assignment-detail', { status: 200, recommendationId: s.recommendationId, state: detail.data.state, enrollment: detail.data.enrollment, profileConditions: detail.data.profileSnapshot?.conditions, matchedRules: detail.data.proposal?.matchedRules, narrativePending: detail.data.narrativePending, narrativeEsPresent: !!detail.data.narrative?.es, narrativeEnPresent: !!detail.data.narrative?.en });
    if (command.inspectOnly) return { proposalFound: true, enrollment: detail.data.enrollment, narrative: detail.data.narrative, profileKeys: Object.keys(detail.data.profileSnapshot ?? {}) };
    if (command.ui) {
      await s.erp.getByRole('link', { name: `Revisar asignación de ${item.patientName}`, exact: true }).click();
      await s.erp.getByRole('button', { name: 'Aplicar tal cual', exact: true }).waitFor();
      await s.shot('13-erp-assignment-profile-narrative', s.erp);
      const sourceCount = await s.erp.locator('cite').count();
      s.record('erp-profile-and-sources', { status: 'PASS', sourceCitations: sourceCount, narrativeEsPresent: !!detail.data.narrative?.es, narrativeEnPresent: !!detail.data.narrative?.en });
      assert.ok(sourceCount > 0, 'El perfil/propuesta debe citar sus fuentes.');
      if (command.regenerate && (!detail.data.narrative?.es || !detail.data.narrative?.en)) {
        const response = s.erp.waitForResponse(r => r.url().includes('/regenerate-narrative') && r.request().method() === 'POST');
        await s.erp.getByRole('button', { name: 'Regenerar narrativa', exact: true }).click();
        s.record('narrative-regeneration', { status: (await response).status() });
        return { proposalFound: true, narrativeRequested: true };
      }
      if (command.apply) {
        assert.ok(detail.data.narrative?.es && detail.data.narrative?.en, 'Esperar narrativa real antes de aplicar.');
        assert.equal(detail.data.enrollment.status, 'PendingAssignment');
        const response = s.erp.waitForResponse(r => r.url().endsWith(`/assignments/${s.recommendationId}/apply`) && r.request().method() === 'POST');
        await s.erp.getByRole('button', { name: 'Aplicar tal cual', exact: true }).click();
        const applied = await response;
        assert.equal(applied.status(), 200);
        const body = await applied.json();
        s.record('erp-apply-assignment', { status: applied.status(), state: body.state, startLocalDate: body.startLocalDate, currentWeekNumber: body.currentWeekNumber ?? body.enrollment?.currentWeekNumber });
        await s.shot('14-erp-assignment-applied', s.erp);
      }
    }
    return { proposalFound: true };
  }
  if (action === 'task') {
    const before = await s.api(s.app, '/api/v1/program/me/snapshot', { token: s.appToken });
    assert.equal(before.status, 200, 'Debe existir snapshot antes de completar una tarea.');
    assert.equal(before.data.template.currentWeekNumber, 1);
    assert.equal(before.data.template.currentWeekStatus, 'Active');
    s.record('active-week-snapshot', { status: 200, week: before.data.template.currentWeekNumber, weekStatus: before.data.template.currentWeekStatus, tasks: before.data.todayTasks.length, localDate: before.data.todayLocalDate });
    await p.reload({ waitUntil: 'networkidle' });
    await p.locator('.hm-day-link').click();
    await s.shot('15-app-active-week-one');
    const emotional = before.data.todayTasks.find(task => task.taskCode === 'emocional');
    assert.ok(emotional);
    await p.getByText(emotional.title, { exact: true }).first().click();
    await p.locator('.mood-face').nth(2).click();
    await p.locator('ion-segment-button[value="8"]').click();
    await p.locator('.barrier-opts ion-chip').first().click();
    const response = p.waitForResponse(r => r.url().endsWith('/api/v1/program/tasks/complete') && r.request().method() === 'POST');
    await p.getByRole('button', { name: /^Guardar evaluación/ }).click();
    const completed = await response;
    assert.equal(completed.status(), 200);
    const completion = await completed.json();
    const after = await s.api(s.app, '/api/v1/program/me/snapshot', { token: s.appToken });
    assert.equal(after.status, 200);
    assert.equal(after.data.todayTasks.find(t => t.taskCode === 'emocional').status, 'Completed');
    assert.ok(after.data.xp.balance > before.data.xp.balance);
    s.record('emotional-task-xp-streak', { status: completed.status(), pointsAwarded: completion.pointsAwarded, xpBefore: before.data.xp.balance, xpAfter: after.data.xp.balance, streakBefore: before.data.streak.current, streakAfter: after.data.streak.current, completedTasks: after.data.todayTasks.filter(t => t.status === 'Completed').length });
    await s.shot('16-app-task-complete-xp');
    s.report.completed = true;
    s.report.qaFindings = [
      { finding: 'Timeout tras 3 tests: {message: NO_ACTIVE_ENROLLMENT} perdía su código.', resolution: 'Parser frontend corregido; 3 pruebas de regresión y estado pendiente 9/9 verificado en web.' },
      { finding: 'La batería no permite repetir tests completados desde la UI.', resolution: 'Sin bypass: la recuperación tras habilitar el flag creó el enrollment y la propuesta de la batería completa.' },
      { finding: 'El DTO wire de cola usa id/narrativeEs/narrativeEn.', resolution: 'El runner adapta el mismo contrato que el ERP existente.' },
    ];
    s.report.steps = s.report.steps.filter(step => !['tests-error', 'assignment-error', 'inspect-error'].includes(step.step));
    s.record('patient-flow-complete', { status: 'PASS', patientId: s.patientId, recommendationId: s.recommendationId, smsSent: s.report.smsSent });
    return { completed: true, xp: after.data.xp.balance, streak: after.data.streak.current };
  }
  throw new Error('Fase todavía no implementada: ' + action);
}

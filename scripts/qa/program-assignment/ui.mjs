/** 4.11 UI con login/servicios reales; solo envelopes IA se sustituyen en outage. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), root = resolve(appRoot, '../..'), ops = resolve(root, '.ai/operations/organizar-experiencia-bienestar');
const fixturePath = process.env.COP411_UI_METADATA ?? resolve(ops, '4.11-ui-app-fixture.json'), fixture = JSON.parse(readFileSync(fixturePath, 'utf8')), back = JSON.parse(readFileSync(resolve(ops, '4.11-back-fixture.json'), 'utf8'));
const submitRecord = fixturePath.replace(/\.json$/, '.ui-submit.json');
const output = process.env.COP411_UI_EVIDENCE ?? resolve(root, 'openspec/changes/organizar-experiencia-bienestar/revision-4.11/ui-premium'), app = process.env.E2E_APP_BASE_URL ?? 'http://127.0.0.1:5182', erp = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3067';
for (const origin of [app, erp])
    assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
mkdirSync(output, { recursive: true });
const { readQaPassword } = await import(pathToFileURL(resolve(appRoot, '../front-f3/e2e/helpers/nutrition-real-credentials.mjs')).href);
const password = account => {
    if (!account.credentialTarget.startsWith('CoppAddresd/QA/4.11/'))
        return readQaPassword(account.credentialTarget);
    const code = "import importlib.util,json,sys;from pathlib import Path;p=Path(sys.argv[1])/'3.20-fixture-helper.py';s=importlib.util.spec_from_file_location('h',p);h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(json.dumps(h.read_credential(sys.argv[2])))";
    return JSON.parse(execFileSync('python', ['-c', code, ops, account.credentialTarget], { encoding: 'utf8' })).password;
};
const db = () => JSON.parse(execFileSync('python', [resolve(appRoot, 'scripts/qa/program-assignment/read-ui.py')], { encoding: 'utf8', env: { ...process.env, COP411_UI_METADATA: fixturePath } }));
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scenario = process.argv[2] ?? 'assignment', result = { scenario, stubs: scenario === 'outage' ? 'solo envelopes ERP IA' : false, appSha: execFileSync('git', ['-C', appRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), before: db(), cases: [], traffic: [], pageErrors: [], console: [], passed: false };
const browser = await chromium.launch({ headless: true });
async function actor(account, origin, lang = 'es') {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: lang === 'en' ? 'en-US' : 'es-CO', timezoneId: 'America/Bogota', serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(lang => { localStorage.setItem('antares_lang', lang); localStorage.setItem('copp_lang', lang); }, lang);
    const page = await context.newPage();
    page.on('pageerror', error => result.pageErrors.push({ scenario, type: error.name }));
    page.on('console', message => { if (['error', 'warning'].includes(message.type()))
        result.console.push({ type: message.type(), text: message.text().replace(/https?:\/\/[^\s]+/g, '[URL]') }); });
    page.on('response', response => { const path = new URL(response.url()).pathname; if (path.startsWith('/api/'))
        result.traffic.push({ actor: origin === app ? 'app' : 'erp', method: response.request().method(), path, http: response.status() }); });
    await page.goto(origin + (origin === erp ? '/login' : ''));
    if (origin === app) {
        await page.locator('#login-id input').fill(account.documentNumber ?? account.login);
        await page.locator('#login-password input').fill(password(account));
    }
    else {
        await page.locator('#email').fill(account.login);
        await page.locator('#password').fill(password(account));
    }
    const login = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login');
    if (origin === app)
        await page.getByRole('button', { name: /^(Comencemos|Let's begin)$/ }).click();
    else {
        const slider = page.getByRole('slider', { name: /^(Comencemos|Let.s begin)$/ });
        await slider.focus();
        await slider.press('End');
    }
    const response = await login;
    assert.equal(response.status(), 200);
    const session = await response.json(), token = session.accessToken ?? session.token;
    if (origin === app)
        await page.locator('.premium-nav').waitFor({ state: 'visible', timeout: 30000 });
    else
        await page.waitForURL(/\/dashboard/);
    return { context, page, get: async (path) => { const response = await context.request.get(back.apiBaseUrl + path, { headers: { Authorization: 'Bearer ' + token, 'X-App-Language': lang } }); assert.equal(response.status(), 200, path); return response.json(); } };
}
async function shot(page, lang, width, name) { await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150); const overflow = await page.locator('.screen-scroll').evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth + 1)); if (overflow)
    save('overflow-diagnostic.json', await page.locator('.screen-scroll').evaluateAll(els => els.map(el => ({ className: el.className, width: el.clientWidth, scroll: el.scrollWidth, roots: [...el.querySelectorAll('.ntr-plan-view,.nutrition-plan-menu,.premium-days')].map(child => ({ className: child.className, width: child.getBoundingClientRect().width, cssWidth: getComputedStyle(child).width, minWidth: getComputedStyle(child).minWidth, maxWidth: getComputedStyle(child).maxWidth, display: getComputedStyle(child).display, columns: getComputedStyle(child).gridTemplateColumns })), children: [...el.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).slice(0, 20).map(child => ({ className: child.className, width: child.getBoundingClientRect().width, minWidth: getComputedStyle(child).minWidth, display: getComputedStyle(child).display })) })))); assert.equal(overflow, false, name + ' overflow'); await page.screenshot({ path: resolve(output, `${scenario}-${lang}-${width}-${name}.png`), scale: 'css' }); result.cases.push({ lang, width, name, overflow }); }
const protocol = page => page.getByRole('button', { name: /^(Protocolo diario|Daily protocol)$/ }).first().click();
async function openWeek(page) { await page.goto(erp + '/patients/' + back.accounts.aiPatient.patientId + '/360'); await page.getByRole('tab', { name: /^(Plan semanal|Weekly plan)$/ }).click(); await page.getByRole('row').filter({ has: page.getByRole('cell', { name: /^2 (Ver tareas|View tasks)$/ }) }).getByRole('button', { name: /^(Ver tareas|View tasks)$/ }).click(); const dialog = page.getByRole('dialog', { name: /^(Semana|Week) 2$/ }); await dialog.waitFor(); return dialog; }
try {
    if (scenario === 'assignment') {
        const a = await actor(fixture.accounts.patient, app), { page } = a;
        await protocol(page);
        await page.locator('.program-setup').waitFor();
        const before = result.before.state.patient;
        if (before.completedTests === 8) {
            assert.equal(before.enrollments.length, 0);
            assert.equal(before.recommendations.length, 0);
            await page.getByRole('button', { name: 'Completar mis evaluaciones', exact: true }).click();
            await page.getByText('8 de 9 evaluaciones', { exact: true }).waitFor();
            const [detailResponse] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/health-tests/me/tests/${fixture.lastTest.assignmentId}` && r.request().method() === 'GET'), page.locator('.ht-list-card:not(.done)').click()]);
            const detail = await detailResponse.json();
            await page.getByRole('button', { name: 'Comenzar evaluación', exact: true }).click();
            for (let i = 0; i < detail.questions.length; i++) {
                const question = detail.questions[i], choice = fixture.lastTest.choices.find(c => c.questionId === question.id);
                assert(choice);
                await page.getByText(`Pregunta ${i + 1} de ${detail.questions.length}`, { exact: true }).waitFor();
                await page.waitForFunction(text => { const step = document.querySelector('.ht-step'); return step?.querySelector('.ht-q-text')?.textContent === text && getComputedStyle(step).opacity === '1'; }, question.text);
                const options = page.locator('.ht-step .ht-card-opt,.ht-step .ht-orb,.ht-step .ht-scale-option');
                await options.nth(choice.optionIndex).click();
            }
            const submitted = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/' + fixture.lastTest.assignmentId + '/submit') && r.request().method() === 'POST');
            await page.getByRole('button', { name: 'Guardar evaluación', exact: true }).click();
            const response = await submitted;
            assert.equal(response.status(), 200);
            const evaluation = await response.json();
            const submittedByUi = { patientId: fixture.patientId, assignmentId: fixture.lastTest.assignmentId, http: response.status(), evaluationId: evaluation.id, source: 'clic UI único', at: new Date().toISOString() };
            save('assignment-submit.json', submittedByUi);
            writeFileSync(submitRecord, JSON.stringify(submittedByUi, null, 2) + '\n');
            await page.getByText('9 de 9 evaluaciones', { exact: true }).waitFor();
            await shot(page, 'es', 390, 'bateria-completada');
            await page.getByRole('button', { name: 'Resultados de tus evaluaciones', exact: true }).click();
            await page.locator('.ar-summary').waitFor();
            await shot(page, 'es', 390, 'resultados');
            await page.getByRole('button', { name: 'Volver a mi perfil', exact: true }).click();
            if (await page.locator('.ht-hero-back').isVisible())
                await page.locator('.ht-hero-back').click();
            await page.locator('.premium-nav').waitFor();
            await page.locator('.premium-nav ion-button').filter({ hasText: /^(Inicio|Home)$/ }).click();
            await protocol(page);
            result.transition = '8→9 mediante UI';
        }
        else {
            assert.equal(before.completedTests, 9);
            assert(existsSync(submitRecord), 'Fixture consumida sin evidencia de submit UI; usar otra fixture');
            const record = JSON.parse(readFileSync(submitRecord, 'utf8'));
            assert.equal(record.patientId, fixture.patientId);
            assert.equal(record.assignmentId, fixture.lastTest.assignmentId);
            save('assignment-submit.json', record);
            result.transition = 'relectura del submit UI previamente registrado';
        }
        await page.getByText('Tus evaluaciones ya están completas', { exact: true }).waitFor({ timeout: 30000 });
        await shot(page, 'es', 390, 'pendiente-clinico');
        await a.context.close();
        for (const lang of ['es', 'en']) {
            const a = await actor(fixture.accounts.patient, app, lang), p = a.page;
            await protocol(p);
            await p.locator('.program-setup').waitFor();
            for (const width of [320, 390, 1440])
                await shot(p, lang, width, 'pendiente-clinico');
            await p.locator('.premium-nav ion-button').filter({ hasText: /^(Inicio|Home)$/ }).click();
            await p.getByRole('button', { name: /^(Nutrición|Nutrition)$/ }).first().click();
            const legal = p.locator('.nutrition-legal-sheet');
            if (await legal.isVisible()) {
                await p.keyboard.press('Escape');
                await legal.waitFor({ state: 'hidden' });
            }
            await p.locator('[data-testid=nutrition-plan]').waitFor({ timeout: 120000 });
            for (const width of [320, 390, 1440])
                await shot(p, lang, width, 'plan-publicado');
            const plan = await a.get('/api/v1/me/nutrition-plan');
            assert.equal(plan.days.length, 30);
            await a.context.close();
        }
        result.after = db();
        const state = result.after.state.patient;
        assert.equal(state.completedTests, 9);
        assert.equal(state.enrollments.length, 1);
        assert.equal(state.recommendations.length, 1);
        assert.equal(state.enrollments[0].status, 'PendingAssignment');
        assert.equal(state.enrollments[0].current_week_number, 0);
        assert.equal(result.after.weekStatuses.length, 12);
        assert(result.after.weekStatuses.every(status => status === 'Locked'));
        const proposal = state.recommendations[0];
        assert(proposal.nutritionPlan?.id && proposal.exerciseRoutine?.id);
        assert(proposal.podcastSequence.length > 0);
        assert(proposal.podcastSequence.every(cell => cell.mediaId));
        result.podcastCells = proposal.podcastSequence.length;
        result.templatePolicy = result.after.templatePolicy;
        assert.equal(result.after.podcastMedia.length, new Set(proposal.podcastSequence.map(cell => cell.mediaId)).size);
        assert(result.after.podcastMedia.every(media => media.published && !media.blankKey));
        result.mediaSummary = { distinct: result.after.podcastMedia.length, demo: result.after.podcastMedia.filter(media => media.demo).length, blobsVerified: false };
        assert.deepEqual(result.after.protected, result.before.protected);
        assert.deepEqual(result.after.state.unapplied, result.before.state.unapplied);
        assert(!result.traffic.some(r => r.method === 'POST' && (/\/program\/enrollments\/me$|\/apply$/.test(r.path))));
    }
    else if (scenario === 'unapplied') {
        const a = await actor(back.accounts.generator, erp), page = a.page;
        let dialog = await openWeek(page);
        const panel = page.getByTestId('weekly-ai-suggestions');
        await panel.waitFor();
        const live = await a.get(back.aiScenario.suggestionsPath);
        assert.equal(live.draft.id, back.aiScenario.briefId);
        assert(live.draft.suggestions.every(s => s.state === 'draft' && s.appliedAt === null));
        const review = () => panel.getByTestId('weekly-ai-suggestion-0').getByRole('button', { name: /^(Revisar cambio|Review change)$/ });
        result.liveDraftStale = live.draft.stale;
        await shot(page, 'es', 390, 'sugerencias-reales');
        if (await review().isDisabled()) {
            assert.equal(live.draft.stale, true);
            result.stubs = 'solo GET IA: borrador sintetico vigente para comprobar cancelacion; lectura real stale conservada';
            await dialog.getByRole('button', { name: /^(Cerrar|Close)$/ }).last().click();
            await page.route('**' + back.aiScenario.suggestionsPath + '*', route => route.request().method() === 'GET' ? route.fulfill({ json: { ...live, draft: { ...live.draft, stale: false } } }) : route.continue());
            dialog = await openWeek(page);
            await panel.waitFor();
            result.controlledCancellation = true;
        }
        await review().click();
        const confirm = page.getByRole('alertdialog');
        await confirm.waitFor();
        const cancel = confirm.getByRole('button', { name: /^(Cancelar|Cancel)$/ });
        await cancel.waitFor();
        assert(await cancel.evaluate(el => el === document.activeElement));
        await shot(page, 'es', 390, 'confirmacion-cancelable');
        await page.keyboard.press('Escape');
        await confirm.waitFor({ state: 'hidden' });
        await dialog.getByRole('button', { name: /^(Cerrar|Close)$/ }).last().click();
        await page.unroute('**' + back.aiScenario.suggestionsPath + '*');
        await openWeek(page);
        await panel.waitFor();
        await shot(page, 'es', 390, 'sugerencias-relectura-real');
        await a.context.close();
        const companion = await actor(back.accounts.aiPatient, app);
        const before = await companion.get('/api/v1/program/me/snapshot');
        await protocol(companion.page);
        await companion.page.locator('.pcards').waitFor();
        await shot(companion.page, 'es', 390, 'app-contenido-sin-cambios');
        const after = await companion.get('/api/v1/program/me/snapshot');
        const projection = snapshot => ({ enrollmentId: snapshot.enrollmentId, localDate: snapshot.todayLocalDate, points: snapshot.todayPoints, xp: snapshot.xp, tasks: snapshot.todayTasks.map(task => ({ code: task.taskCode, status: task.status, points: task.points, ref: task.contentRefId, title: task.content?.title, routine: task.content?.exerciseRoutineName, exercises: task.content?.exercises?.map(ex => ({ name: ex.name, sets: ex.sets, repetitions: ex.repetitions })) })) });
        assert.equal(hash(projection(before)), hash(projection(after)));
        result.appProjectionUnchanged = true;
        await companion.context.close();
        result.after = db();
        assert.deepEqual(result.after.protected, result.before.protected);
        assert.deepEqual(result.after.state.unapplied, result.before.state.unapplied);
        assert.equal(result.after.state.unapplied.applicationAudits, 0);
        assert(!result.traffic.some(r => r.method === 'POST' && r.path.includes('/ai-suggestions')));
    }
    else if (scenario === 'outage') {
        const a = await actor(back.accounts.generator, erp);
        let injected = 0;
        const summary = `**/api/v1/program/erp/patients/${back.accounts.aiPatient.patientId}/ai-summary*`, suggestions = `**${back.aiScenario.suggestionsPath}*`;
        await a.page.route(summary, route => { injected++; return route.fulfill({ json: { status: 'unavailable', summary: null } }); });
        await a.page.route(suggestions, route => { injected++; return route.fulfill({ json: { status: 'unavailable', draft: null } }); });
        const dialog = await openWeek(a.page);
        await a.page.getByTestId('weekly-ai-suggestions-loading').waitFor({ state: 'hidden' });
        assert.equal(await a.page.getByTestId('weekly-ai-suggestions').count(), 0);
        await dialog.getByRole('button', { name: /^(Editar rutina|Edit routine)$/ }).first().waitFor();
        assert(await dialog.getByRole('article').count() > 0);
        await shot(a.page, 'es', 390, 'IA-unavailable-editor-manual');
        assert(injected > 0);
        await a.page.unroute(summary);
        await a.page.unroute(suggestions);
        await dialog.getByRole('button', { name: /^(Cerrar|Close)$/ }).last().click();
        await openWeek(a.page);
        await a.page.getByTestId('weekly-ai-suggestions').waitFor();
        await a.context.close();
        const companion = await actor(back.accounts.aiPatient, app);
        await protocol(companion.page);
        await companion.page.locator('.pcards').waitFor();
        await shot(companion.page, 'es', 390, 'app-programa-sano');
        await companion.page.locator('.premium-nav ion-button').filter({ hasText: /^(Nutrición|Nutrition)$/ }).click();
        await companion.page.locator('.ntr-screen').waitFor();
        const notice = companion.page.locator('.nutrition-legal-sheet');
        const noticeAppeared = await notice.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(error => { if (error.name !== 'TimeoutError') throw error; return false; });
        if (noticeAppeared) {
            await companion.page.keyboard.press('Escape');
            await notice.waitFor({ state: 'hidden' });
        }
        await shot(companion.page, 'es', 390, 'app-nutricion-sana');
        await companion.page.locator('.premium-nav ion-button').filter({ hasText: /^(Perfil|Profile)$/ }).click();
        await shot(companion.page, 'es', 390, 'app-perfil-sano');
        await companion.page.getByRole('button', { name: /Batería de evaluación|Assessment battery/ }).click();
        await companion.page.locator('.ht-list-card').first().waitFor();
        await shot(companion.page, 'es', 390, 'app-evaluaciones-sanas');
        await companion.context.close();
        result.after = db();
        assert.deepEqual(result.after.protected, result.before.protected);
        assert.deepEqual(result.after.state.unapplied, result.before.state.unapplied);
        assert(!result.traffic.some(r => r.method === 'POST' && r.path.includes('/ai-suggestions')));
        result.injectedEnvelopes = injected;
    }
    else
        throw new Error('Escenario desconocido');
    assert.deepEqual(result.pageErrors, []);
    result.passed = true;
}
catch (error) {
    for (const context of browser.contexts())
        for (const page of context.pages()) {
            if (!page.url().includes('/login')) {
                await page.screenshot({ path: resolve(output, scenario + '-diagnostic.png') }).catch(() => { });
                save(scenario + '-diagnostic.json', { urlPath: new URL(page.url()).pathname, body: (await page.locator('body').innerText()).slice(0, 14000) });
            }
        }
    throw error;
}
finally {
    await browser.close();
    save(scenario + '-results.json', result);
    console.log(JSON.stringify({ scenario, passed: result.passed, cases: result.cases.length, traffic: result.traffic.length, pageErrors: result.pageErrors }));
}

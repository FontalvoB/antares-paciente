/** Prueba LIVE: crea una cuenta de pruebas; nunca solicita OTP ni usa seeders. */
import { chromium, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const deployment = JSON.parse(readFileSync(new URL('../infra/coppadresd-app-test/resources.json', import.meta.url)));
const out = resolve('docs/test-web-evidence');
mkdirSync(out, { recursive: true });
const publicOnly = process.argv.includes('--public-only');
const resumeAdmin = process.argv.includes('--resume-admin');
const resultsPath = resolve(out, 'results.json');
const results = (publicOnly || resumeAdmin) && existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : { timestamp: new Date().toISOString(), app: deployment.url, device: 'iPhone 13 / Chromium mobile 390x844', steps: [], screenshots: [], blockers: [] };
if (resumeAdmin) results.blockers = results.blockers.filter(b => !b.startsWith('locator.') && !b.startsWith('page.waitForURL:'));
function record(step, details) { results.steps = results.steps.filter(s => s.step !== step); results.steps.push({ step, ...details }); console.log(JSON.stringify({ step, ...details })); }
function save() { writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2) + '\n'); }
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const mobile = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
const page = await mobile.newPage();
const network = [];
page.on('request', request => {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/')) network.push({ origin: url.origin, path: url.pathname, method: request.method() });
});
async function shot(name, target = page) {
  const filename = `${name}.png`;
  await target.screenshot({ path: resolve(out, filename), fullPage: true });
  if (!results.screenshots.includes(filename)) results.screenshots.push(filename);
}
async function request(base, path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, data, isHtml: /text\/html/.test(response.headers.get('content-type') ?? '') };
}
function secretValue(object, name) {
  if (!object || typeof object !== 'object') return undefined;
  for (const [key, value] of Object.entries(object)) {
    if (key === name || key.endsWith(`__${name}`) || key.endsWith(`:${name}`)) return value;
    if (typeof value === 'object') { const nested = secretValue(value, name); if (nested) return nested; }
  }
}
try {
  const root = await page.goto(deployment.url, { waitUntil: 'networkidle' });
  assert.equal(root.status(), 200);
  await page.locator('#login-id input').waitFor();
  record('web-root', { status: root.status(), title: await page.title(), viewport: page.viewportSize() });
  await shot('01-app-login-mobile');
  const health = await request(deployment.url, '/api/auth/health');
  const snapshot = await request(deployment.url, '/api/v1/program/me/snapshot');
  record('same-origin-proxy', { healthStatus: health.status, snapshotAnonymousStatus: snapshot.status, apiRequests: network, crossOriginApiRequests: network.filter(r => r.origin !== deployment.url).length });
  await page.getByRole('button', { name: 'Activa tu cuenta', exact: true }).click();
  await page.getByText('Verifica tu identidad para completar tu perfil').waitFor();
  await shot('02-app-activation-public');
  record('public-first-entry', { activation: 'ID -> contactos -> OTP; no se envió OTP', passwordLogin: 'documentNumber + password, application=app' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.getByText('Recupera tu contraseña').waitFor();
  await shot('03-app-recovery-public');

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Cambiar idioma a English' }).click();
  await page.getByRole('button', { name: "Let's begin", exact: true }).waitFor();
  await shot('05-app-login-english');
  record('public-language-switch', { status: 'PASS', language: 'en' });
  assert.equal(network.filter(r => r.origin !== deployment.url).length, 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  record('public-mobile-layout', { status: 'PASS', horizontalOverflow: false, crossOriginApiRequests: 0 });

  if (!publicOnly) {
  // El secreto y todos los tokens permanecen exclusivamente en memoria.
  const secret = process.env.COPPADRESD_APP_TEST_ADMIN_PASSWORD ? {} : JSON.parse(JSON.parse(execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', 'cooppadresd/auth', '--profile', 'fya-root', '--region', 'us-east-2', '--output', 'json', '--no-cli-pager'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).SecretString);
  const adminPassword = process.env.COPPADRESD_APP_TEST_ADMIN_PASSWORD ?? secretValue(secret, 'AdminPassword');
  if (!adminPassword) throw new Error('No se encontró la clave AdminPassword en el secreto autorizado.');
  let adminEmail = process.env.COPPADRESD_APP_TEST_ADMIN_EMAIL ?? secretValue(secret, 'AdminEmail') ?? (resumeAdmin ? 'admin@coppaddresd.com' : 'admin@coppadresd.com');
  let admin = await request('https://erp.coppadresd.com', '/api/auth/login', { body: { email: adminEmail, password: adminPassword, application: 'erp', rememberMe: false } });
  // El AGENTS del backend identifica el correo canónico con doble d.
  if (admin.status === 401 && adminEmail === 'admin@coppadresd.com') {
    adminEmail = 'admin@coppaddresd.com';
    admin = await request('https://erp.coppadresd.com', '/api/auth/login', { body: { email: adminEmail, password: adminPassword, application: 'erp', rememberMe: false } });
  }
  record('admin-login-api', { status: admin.status, authenticated: !!admin.data?.accessToken });
  if (!admin.data?.accessToken) throw new Error(`Login admin rechazado HTTP ${admin.status}; sin cambios a cuentas ni backend.`);
  const adminToken = admin.data.accessToken;
  const queue = await request('https://erp.coppadresd.com', '/api/v1/program/assignments?page=1&pageSize=10&search=Coppadresd%20App%20Test', { token: adminToken });
  record('assignment-queue-api', { status: queue.status, isHtml: queue.isHtml, responseKeys: queue.data ? Object.keys(queue.data) : [], matchingTestPatients: queue.data?.total ?? null });

  const proxyDiagnostic = await browser.newContext();
  const diagnosticLogin = await proxyDiagnostic.request.post(deployment.url + '/api/auth/login', { data: { email: adminEmail, password: adminPassword, application: 'erp', rememberMe: false } });
  assert.equal(diagnosticLogin.status(), 200);
  const cookies = await proxyDiagnostic.cookies(deployment.url + '/api/auth/refresh');
  const refreshCookie = cookies.find(c => c.name.startsWith('copp_refresh_token'));
  assert.equal(refreshCookie?.httpOnly, true);
  const refreshed = await proxyDiagnostic.request.post(deployment.url + '/api/auth/refresh', { data: { application: 'erp' } });
  assert.equal(refreshed.status(), 200);
  const refreshedBody = await refreshed.json();
  const diagnosticMe = await proxyDiagnostic.request.get(deployment.url + '/api/auth/me', { headers: { Authorization: `Bearer ${refreshedBody.accessToken}` } });
  assert.equal(diagnosticMe.status(), 200);
  record('proxy-auth-cookie-admin-diagnostic', { loginStatus: 200, refreshStatus: 200, bearerMeStatus: 200, cookie: { httpOnly: refreshCookie.httpOnly, secure: refreshCookie.secure, path: refreshCookie.path, domain: refreshCookie.domain }, patientAppSession: false });
  await proxyDiagnostic.close();

  if (!resumeAdmin) {
  const run = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const testEmail = `coppadresd-app-test-${run}@example.invalid`;
  const testPassword = `Aa1!${randomBytes(20).toString('hex')}`;
  const user = await request('https://erp.coppadresd.com', '/api/auth/users', { token: adminToken, body: { email: testEmail, password: testPassword, firstName: 'Coppadresd App Test', lastName: run } });
  results.testAccount = { email: testEmail, userId: user.data?.id ?? null, created: user.status === 201 };
  record('create-test-user', { status: user.status, userId: user.data?.id ?? null, contract: 'email,password,firstName,lastName; no acepta application/documentNumber' });
  if (user.status === 201) {
    const patientLogin = await request(deployment.url, '/api/auth/login', { body: { email: testEmail, password: testPassword, application: 'app', rememberMe: false } });
    record('new-user-app-access', { status: patientLogin.status, authenticated: !!patientLogin.data?.accessToken });
    if (!patientLogin.data?.accessToken) results.blockers.push('El alta /api/auth/users no concede UserApplication(app) ni vincula patient_profiles.user_id; login app por email devuelve 401. El formulario real usa documentNumber, que exige un paciente vinculado. La vinculación inicial se realiza tras OTP; no se solicita ni se falsifica.');
    else results.blockers.push('La cuenta auth puede entrar por email vía API, pero el formulario existente requiere identificación de un perfil de paciente vinculado; no se sustituye ni modifica la autenticación para QA.');
  } else results.blockers.push(`No se creó la cuenta: HTTP ${user.status}.`);
  }

  // Login ERP real por UI; el contexto y cookies de ERP están aislados de la app.
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const erp = await desktop.newPage();
  await erp.goto('https://erp.coppadresd.com/login', { waitUntil: 'networkidle' });
  const emailField = erp.locator('input[type="email"]');
  if (await emailField.count()) {
    await emailField.first().fill(adminEmail);
    await erp.locator('input[type="password"]').first().fill(adminPassword);
    await erp.getByRole('slider', { name: 'Comencemos' }).press('End');
    await erp.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30000 });
    record('erp-ui-login', { success: true, path: new URL(erp.url()).pathname });
  } else record('erp-ui-login', { success: false, reason: 'No se encontró input email en /login' });
  const assignmentPage = await erp.goto('https://erp.coppadresd.com/program/asignacion?search=coppadresd-app-test', { waitUntil: 'networkidle' });
  await erp.locator('#assignment-search').fill('Coppadresd App Test');
  await erp.getByText('No encontramos asignaciones', { exact: true }).waitFor();
  await shot('04-erp-assignment-route', erp);
  record('erp-assignment-ui', { status: assignmentPage.status(), path: new URL(erp.url()).pathname, notFound: await erp.getByText('404', { exact: true }).count() > 0, search: 'Coppadresd App Test', empty: true });
  if (queue.status !== 200) results.blockers.push(`La cola de asignación desplegada responde HTTP ${queue.status}; no se modificó ni desplegó ERP/backend.`);
  for (const step of ['onboarding-paciente', 'bateria-3-tests-y-escape', 'bateria-9-tests-results-indicators-alerts', 'pending-assignment-recommendation-narrative', 'erp-apply-week1', 'task-xp-streak']) {
    results.steps = results.steps.filter(s => s.step !== step);
    record(step, { status: 'BLOCKED', reason: 'Sin sesión app de un paciente autorizado; no se fabrican tokens, OTP, respuestas ni resultados clínicos.' });
  }
  await desktop.close();
  }
} catch (error) {
  // No se vuelcan objetos HTTP, comandos AWS, cabeceras ni datos de credenciales.
  const safe = error instanceof Error ? error.message.split('\n')[0] : 'Fallo de ejecución';
  results.blockers.push(safe);
  console.log(JSON.stringify({ step: 'runner', status: 'BLOCKED', reason: safe }));
} finally {
  // También se registra el acceso ERP público si falla la autenticación admin.
  try {
    if (!results.screenshots.includes('04-erp-assignment-route.png')) {
      const erpPublic = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const response = await erpPublic.goto('https://erp.coppadresd.com/program/asignacion?search=coppadresd-app-test', { waitUntil: 'networkidle' });
      await shot('04-erp-assignment-route', erpPublic);
      record('erp-assignment-public', { status: response.status(), path: new URL(erpPublic.url()).pathname, authenticated: false });
      await erpPublic.close();
    }
  } catch { results.blockers.push('No se pudo capturar la ruta pública ERP.'); }
  for (const step of ['create-test-user', 'onboarding-paciente', 'bateria-3-tests-y-escape', 'bateria-9-tests-results-indicators-alerts', 'pending-assignment-recommendation-narrative', 'erp-apply-week1', 'task-xp-streak']) {
    if (!results.steps.some(s => s.step === step)) record(step, { status: 'BLOCKED', reason: 'Login admin 401 / sin sesión app de paciente autorizado.' });
  }
  save();
  await browser.close();
  // Un flujo clínico bloqueado nunca se anuncia como un E2E verde.
  process.exitCode = results.blockers.length ? 2 : 0;
}

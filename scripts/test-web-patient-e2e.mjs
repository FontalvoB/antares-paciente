/** Runner LIVE con OTP humano. Tokens, contraseña y OTP viven solo en memoria. */
import { chromium, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const out = resolve('docs/test-web-evidence');
mkdirSync(out, { recursive: true });
const deployment = JSON.parse(readFileSync('infra/coppadresd-app-test/resources.json', 'utf8'));
const report = { startedAt: new Date().toISOString(), app: deployment.url, steps: [], screenshots: [], smsSent: 0 };
const state = { app: deployment.url, erpUrl: 'https://erp.coppadresd.com', report, password: `Aa1!${randomBytes(20).toString('hex')}` };
state.record = (step, data) => {
  report.steps = report.steps.filter(s => s.step !== step);
  report.steps.push({ step, ...data });
  writeFileSync(resolve(out, 'patient-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ step, ...data }));
};
state.shot = async (name, page = state.page) => {
  await page.screenshot({ path: resolve(out, name + '.png'), fullPage: true });
  if (!report.screenshots.includes(name + '.png')) report.screenshots.push(name + '.png');
};
state.api = async (base, path, { token, body, method = body ? 'POST' : 'GET' } = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45000) });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
};
function findSecret(object, name) {
  for (const [key, value] of Object.entries(object)) {
    if (key === name || key.endsWith('__' + name) || key.endsWith(':' + name)) return value;
    if (value && typeof value === 'object') { const found = findSecret(value, name); if (found) return found; }
  }
}
const secret = JSON.parse(JSON.parse(execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', 'cooppadresd/auth', '--profile', 'fya-root', '--region', 'us-east-2', '--output', 'json', '--no-cli-pager'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).SecretString);
state.adminPassword = findSecret(secret, 'AdminPassword');
state.adminEmail = 'admin@cooppaddresd.com';
const login = await state.api(state.erpUrl, '/api/auth/login', { body: { email: state.adminEmail, password: state.adminPassword, application: 'erp', rememberMe: false } });
if (login.status !== 200) throw new Error(`Admin autorizado rechazado: HTTP ${login.status}`);
state.adminToken = login.data.accessToken;
state.record('admin-authorized', { status: login.status, email: state.adminEmail });
state.browser = await chromium.launch({ headless: true, channel: 'chrome' });
state.mobile = await state.browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
state.page = await state.mobile.newPage();

// Control efímero exclusivamente en loopback. No admite CORS ni llamadas de sitios web.
const allowed = new Set(['prepare', 'send', 'otp', 'onboarding', 'tests', 'assignment', 'task', 'inspect']);
let busy = false;
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.headers.origin || !['127.0.0.1:17841', 'localhost:17841'].includes(req.headers.host)) { res.writeHead(403).end('{}'); return; }
  if (req.method === 'GET' && req.url === '/status') { res.end(JSON.stringify({ busy, smsSent: report.smsSent, steps: report.steps })); return; }
  if (req.method !== 'POST' || req.url !== '/command' || !req.headers['content-type']?.startsWith('application/json')) { res.writeHead(404).end('{}'); return; }
  if (busy) { res.writeHead(409).end('{"busy":true}'); return; }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 4096) { res.writeHead(413).end('{}'); return; } }
  let command; try { command = JSON.parse(body); } catch { res.writeHead(400).end('{}'); return; }
  if (command.action === 'stop') {
    await state.browser.close(); res.end('{"closed":true}'); server.close(); return;
  }
  if (!allowed.has(command.action)) { res.writeHead(400).end('{}'); return; }
  busy = true;
  try {
    const { run } = await import(`./test-web-patient-actions.mjs?run=${Date.now()}`);
    const result = await run(command.action, state, command);
    res.end(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    // Nunca serializar requests, body, cookies, tokens ni el OTP recibido.
    const reason = error instanceof Error ? error.message.split('\n')[0] : 'Fallo del runner';
    state.record(command.action + '-error', { status: 'FAILED', reason });
    res.writeHead(422).end(JSON.stringify({ ok: false, reason }));
  } finally { busy = false; }
});
server.listen(17841, '127.0.0.1', () => console.log('Runner de paciente listo en loopback; ningún SMS enviado.'));

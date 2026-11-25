import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, webkit } from "playwright";

function loopback(name) {
  const url = new URL(process.env[name]);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  return url;
}

const appUrl = loopback("COP_E2E_APP_URL");
const resetUrl = loopback("COP_E2E_RESET_URL");
const inboxUrl = loopback("COP_E2E_INBOX_URL");
assert.equal(resetUrl.protocol, "https:");
const { COP_E2E_PATIENT_EMAIL: email, COP_E2E_PATIENT_PASSWORD: oldPassword,
  COP_E2E_USER_ID: userId, COP_E2E_PROFILE_ID: profileId } = process.env;
assert.ok(email && oldPassword && userId && profileId);
const newPassword = process.env.COP_E2E_NEW_PASSWORD ?? "NuevaClaveQA!8432";
assert.notEqual(newPassword, oldPassword);
const absentEmail = "kan117-unknown@example.invalid";
const erpOnlyEmail = "kan117-admin@example.invalid";
const requestPath = "/api/auth/account/password-reset/request";
const confirmPath = "/api/auth/account/password-reset/confirm";

const responseFor = (page, path, method = "POST") => page.waitForResponse(
  (response) => new URL(response.url()).pathname === path &&
    response.request().method() === method,
);

async function messagesFor(address) {
  const response = await fetch(new URL("/api/v1/messages", inboxUrl));
  assert.ok(response.ok);
  const inbox = await response.json();
  return inbox.messages.filter((message) =>
    message.To.some(({ Address }) => Address.toLowerCase() === address.toLowerCase()),
  );
}

async function inboxLink(previousIds) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const message = (await messagesFor(email)).find(({ ID }) => !previousIds.has(ID));
    if (message) {
      const response = await fetch(new URL(`/api/v1/message/${message.ID}`, inboxUrl));
      assert.ok(response.ok);
      const body = await response.json();
      const link = body.Text.split(/\s+/).find((part) =>
        part.startsWith(`${resetUrl.href}#`),
      );
      assert.ok(link, "El correo debe contener un enlace HTTPS con fragmento.");
      return new URL(link);
    }
    await delay(250);
  }
  throw new Error("El correo de restablecimiento no llegó al buzón local.");
}

async function submitLogin(page, password) {
  await page.locator("#login-email input").fill(email);
  await page.locator("#login-password input").fill(password);
  const response = responseFor(page, "/api/auth/login");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  return (await response).status();
}

const browser = await (process.env.COP_E2E_BROWSER === "webkit" ? webkit : chromium).launch();
try {
  const browserOptions = {
    locale: "es-CO",
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  };
  const context = await browser.newContext(browserOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.goto(appUrl.href);
  await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
  const recovery = page.getByRole("form", { name: "Recuperar contraseña" });
  await recovery.waitFor({ timeout: 5_000 });
  const emailInput = recovery.getByRole("textbox", { name: "Correo electrónico" });
  await emailInput.waitFor();

  // Conserva la recuperación por identificación mientras se instala el endpoint de correo.
  for (const status of [404, 503]) {
    await page.route(`**${requestPath}`, (route) => route.fulfill({ status }), { times: 1 });
    await emailInput.fill(absentEmail);
    await recovery.getByRole("button", { name: "Enviar enlace" }).click();
    await page.locator("#login-first-id input").waitFor();
    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await recovery.waitFor();
  }

  const oldDevice = await browser.newPage(browserOptions);
  await oldDevice.goto(appUrl.href);
  assert.equal(await submitLogin(oldDevice, oldPassword), 200);
  await oldDevice.locator(".wh-hero").waitFor();

  async function requestLink(address) {
    await emailInput.fill(address);
    const response = responseFor(page, requestPath);
    await recovery.getByRole("button", { name: "Enviar enlace" }).click();
    const result = await response;
    assert.equal(result.status(), 202);
    const notice = page.getByRole("status").filter({ hasText: "Si hay una cuenta con ese correo" });
    await notice.waitFor();
    return (await notice.innerText()).trim();
  }

  const unknownNotice = await requestLink(absentEmail);
  assert.equal(await requestLink(erpOnlyEmail), unknownNotice);
  const previousIds = new Set((await messagesFor(email)).map(({ ID }) => ID));
  const knownNotice = await requestLink(email);
  assert.equal(unknownNotice, knownNotice);
  const link = await inboxLink(previousIds);
  assert.equal((await messagesFor(absentEmail)).length, 0);
  assert.equal((await messagesFor(erpOnlyEmail)).length, 0);
  const fragment = new URLSearchParams(link.hash.slice(1));
  assert.equal(fragment.get("userId"), userId);
  assert.ok(fragment.get("token"));
  assert.equal(link.search, "");

  async function openReset(url, browserContext = context) {
    const reset = await browserContext.newPage();
    await reset.goto(url.href);
    await reset.getByRole("heading", { name: "Restablecer contraseña" }).waitFor();
    assert.equal(new URL(reset.url()).hash, "");
    await reset.getByLabel("Nueva contraseña", { exact: true }).fill(newPassword);
    await reset.getByLabel("Confirmar contraseña", { exact: true }).fill(newPassword);
    return reset;
  }

  const reset = await openReset(link);
  if (process.env.COP_E2E_EXPIRE_RESET_LINKS === "true") {
    const expired = responseFor(reset, confirmPath);
    await reset.getByRole("button", { name: "Guardar contraseña" }).click();
    const response = await expired;
    assert.equal(response.status(), 400);
    assert.equal((await response.json()).code, "invalid_reset_link");
    await reset.getByRole("alert").filter({ hasText: "El enlace no es válido o ya venció." }).waitFor();

    const currentRefresh = responseFor(oldDevice, "/api/auth/refresh");
    await oldDevice.reload();
    assert.equal((await currentRefresh).status(), 200);
    await oldDevice.locator(".wh-hero").waitFor();
    console.log("El enlace vencido se rechazó y la sesión previa sigue activa.");
  } else {
    await reset.getByLabel("Nueva contraseña", { exact: true }).fill("lowercaseonly");
    await reset.getByLabel("Confirmar contraseña", { exact: true }).fill("lowercaseonly");
    const policy = responseFor(reset, confirmPath);
    await reset.getByRole("button", { name: "Guardar contraseña" }).click();
    const rejected = await policy;
    assert.equal(rejected.status(), 400);
    assert.equal((await rejected.json()).code, "password_policy");
    await reset.getByRole("alert").filter({ hasText: "La contraseña no cumple los requisitos." }).waitFor();
    await reset.getByLabel("Nueva contraseña", { exact: true }).fill(newPassword);
    await reset.getByLabel("Confirmar contraseña", { exact: true }).fill(newPassword);

    const replay = await openReset(link, await browser.newContext(browserOptions));
    const resetRequests = [reset, replay].map((tab) => responseFor(tab, confirmPath));
    await Promise.all([reset, replay].map((tab) =>
      tab.getByRole("button", { name: "Guardar contraseña" }).click(),
    ));
    const statuses = await Promise.all(resetRequests.map(async (promise) => (await promise).status()));
    assert.deepEqual(statuses.toSorted(), [204, 400], "El enlace permite una sola actualización concurrente.");
    const [success, failure] = statuses[0] === 204 ? [reset, replay] : [replay, reset];
    await success.getByRole("heading", { name: "Contraseña actualizada" }).waitFor();
    await failure.getByRole("alert").filter({ hasText: "El enlace no es válido o ya venció." }).waitFor();

    const en = await context.newPage();
    await en.goto(new URL("/recover-account", resetUrl).href);
    await en.getByRole("heading", { name: "Reset your password" }).waitFor();
    await en.getByRole("alert").filter({ hasText: "This link is invalid or has expired." }).waitFor();

    const oldRefresh = responseFor(oldDevice, "/api/auth/refresh");
    await oldDevice.reload();
    assert.equal((await oldRefresh).status(), 401);
    await oldDevice.locator("#login-email input").waitFor();
    assert.equal(await submitLogin(oldDevice, oldPassword), 401);

    const me = responseFor(oldDevice, "/api/auth/me", "GET");
    const profile = responseFor(oldDevice, "/api/v1/me/patient-profile", "GET");
    assert.equal(await submitLogin(oldDevice, newPassword), 200);
    assert.equal((await (await me).json()).id, userId);
    assert.equal((await (await profile).json()).patientId, profileId);
    await oldDevice.locator(".wh-hero").waitFor();
    console.log("Solicitud neutra, correo HTTPS, uso único concurrente, revocación y perfil verificados.");
  }
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import { chromium } from "playwright";

// Ejecutar contra Vite + Gateway + Auth + API con un paciente sintético en PostgreSQL.
const appUrl = new URL(process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5173");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(appUrl.hostname));

function required(name) {
  const value = process.env[name];
  assert.ok(value, `Falta ${name} del paciente sintético.`);
  return value;
}

const email = required("COP_E2E_PATIENT_EMAIL");
const password = required("COP_E2E_PATIENT_PASSWORD");
const userId = required("COP_E2E_USER_ID");
const profileId = required("COP_E2E_PROFILE_ID");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: "es-CO",
  });
  page.setDefaultTimeout(12_000);
  const responseFor = (path, method) =>
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === path &&
        response.request().method() === method,
    );
  const readIdentity = async (me, profile) => {
    const [authResponse, profileResponse] = await Promise.all([me, profile]);
    assert.equal(authResponse.status(), 200, "Auth debe devolver la sesión.");
    assert.equal(profileResponse.status(), 200, "La API debe devolver el perfil vinculado.");
    assert.equal((await authResponse.json()).id, userId);
    assert.equal((await profileResponse.json()).patientId, profileId);
  };

  await page.goto(appUrl.href);
  const form = page.locator("form.auth-form");
  const identityInput = form.locator("ion-input input").first();
  await identityInput.waitFor();
  assert.equal(
    await identityInput.getAttribute("type"),
    "email",
    "La entrada de la app debe pedir correo electrónico.",
  );

  const passwordInput = page.locator("#login-password input");
  const submit = form.getByRole("button", { name: "Ingresar" });
  await identityInput.fill(email);
  await passwordInput.fill("ContraseñaIncorrecta!123");
  const failure = responseFor("/api/auth/login", "POST");
  await submit.click();
  assert.equal((await failure).status(), 401);
  await form.getByRole("alert").waitFor();

  await identityInput.fill(email.toUpperCase());
  await passwordInput.fill(password);
  const signIn = responseFor("/api/auth/login", "POST");
  const me = responseFor("/api/auth/me", "GET");
  const profile = responseFor("/api/v1/me/patient-profile", "GET");
  await submit.click();
  const login = await signIn;
  assert.equal(login.status(), 200);
  const loginRequest = login.request().postDataJSON();
  assert.equal(loginRequest.email, email.toUpperCase());
  assert.equal(loginRequest.application, "app");
  assert.equal(loginRequest.documentNumber, undefined);
  await readIdentity(me, profile);
  await page.locator(".wh-hero").waitFor();

  const cookies = await page.context().cookies(new URL("/api/auth/refresh", appUrl).href);
  assert.ok(cookies.some((cookie) => cookie.name === "copp_refresh_token_app" && cookie.httpOnly));

  // La recarga debe funcionar aunque no haya token de acceso local.
  await page.evaluate(() => {
    localStorage.removeItem("copp_access_token");
    sessionStorage.removeItem("copp_access_token");
  });
  const refresh = responseFor("/api/auth/refresh", "POST");
  const restoredMe = responseFor("/api/auth/me", "GET");
  const restoredProfile = responseFor("/api/v1/me/patient-profile", "GET");
  await page.reload();
  assert.equal((await refresh).status(), 200);
  await readIdentity(restoredMe, restoredProfile);
  await page.locator(".wh-hero").waitFor();

  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  const logout = responseFor("/api/auth/logout", "POST");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  assert.equal((await logout).status(), 200);
  await form.waitFor();
  await page.reload();
  await form.waitFor();
  console.log("Correo, credenciales, perfil vinculado, restauración y cierre de sesión verificados.");
} finally {
  await browser.close();
}

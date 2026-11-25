/**
 * KAN-136 / KAN-146 — onboarding de 5 pasos + objetivo de 8 pasos.
 *
 * Recorre la app real en modo navegador con la API sintética (mismo patrón que
 * `onboarding-emergency-contacts.mjs`): login/activación → onboarding nuevo →
 * Inicio con generación en segundo plano. Captura evidencia en ES a 390/320 px.
 */
import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const out = process.env.COP_E2E_OUTPUT;
assert(out, "COP_E2E_OUTPUT is required");

const browser = await chromium.launch();
const results = [];
const tokenLifetimeSeconds = 2 * 24 * 60 * 60;

const token =
  "x." +
  Buffer.from(
    JSON.stringify({
      sub: "11111111-1111-4111-8111-111111111111",
      exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds,
    }),
  ).toString("base64url") +
  ".x";

async function mockApi(context) {
  let verified = false;
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const reply = (json) => route.fulfill({ json });
    if (p === "/api/auth/refresh") {
      return verified
        ? reply({ accessToken: token, expiresIn: tokenLifetimeSeconds })
        : route.fulfill({ status: 401, json: {} });
    }
    if (p === "/api/auth/id-lookup") {
      return reply({
        patientId: "11111111-1111-4111-8111-111111111111",
        firstName: "Paciente",
        lastName: "QA",
        documentNumber: "QA",
        contacts: [
          { id: "qa-contact", type: "Email", label: "qa@example.invalid" },
        ],
      });
    }
    if (p === "/api/auth/send-otp") return reply({ expiresInSeconds: 300 });
    if (p === "/api/auth/verify-otp") {
      verified = true;
      return reply({
        accessToken: token,
        tokenType: "Bearer",
        expiresIn: tokenLifetimeSeconds,
      });
    }
    if (p === "/api/auth/me") {
      return reply({
        id: "11111111-1111-4111-8111-111111111111",
        firstName: "Paciente",
        lastName: "QA",
        email: "qa@example.invalid",
        roles: [],
      });
    }
    if (p === "/api/auth/me/avatar") {
      return reply({
        version: 1,
        skin: "skin-03",
        gender: "female",
        hair: "hair-02",
        clothing: { shirt: "shirt-basic-01", pants: null, shoes: null },
        accessories: { glasses: null, watch: null, bracelet: null },
      });
    }
    if (p === "/api/v1/program/me/metrics-history") {
      return reply({ heightCm: null, metrics: [] });
    }
    if (p === "/api/v1/me/patient-profile") {
      return reply({
        patientId: "11111111-1111-4111-8111-111111111111",
        firstName: "Paciente",
        lastName: "QA",
        documentNumber: "QA",
        email: "qa@example.invalid",
        phone: "3001234567",
        emergencyName: "",
        emergencyPhone: "",
        emergencyRelationship: "",
        emergencyEmail: "",
        secondaryEmergencyContact: null,
        insurerId: null,
        memberId: "",
      });
    }
    return reply([]);
  });
}

async function enterOnboarding(page, baseUrl) {
  await page.goto(baseUrl);
  await page
    .getByRole("button", { name: "Activa tu cuenta", exact: true })
    .click();
  await page.locator("#login-first-id input").fill("QA");
  await page
    .getByRole("button", { name: "Confirmar identidad", exact: true })
    .click();
  await page.getByRole("radio").first().click();
  await page.locator("#login-otp-0").fill("123456");
  await page
    .getByRole("button", { name: "Verificar y entrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Correo", exact: true }),
  ).toBeVisible();
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(out, `${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  assert.equal(overflow, false, `horizontal overflow in ${name}`);
}

async function continueButton(page) {
  return page.getByRole("button", { name: "Continuar", exact: true }).first();
}

async function fillNumeric(page, field, value) {
  const input = page.locator(`ion-input[data-wl-field="${field}"] input`);
  await input.fill(String(value));
}

async function answerAllNo(page, count) {
  for (let index = 0; index < count; index += 1) {
    const question = page.locator(".wl-question").nth(index);
    await question.getByRole("button", { name: "No", exact: true }).click();
  }
}

async function verifyNavigation(page, baseUrl, width) {
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  const tab = (name) => nav.getByRole("button", { name, exact: true });
  const assertDock = async (active) => {
    await expect(nav.locator("ion-button")).toHaveText([
      "Inicio",
      "Nutrición",
      "SOS",
      "Ejercicio",
      "Perfil",
    ]);
    await expect(tab(active)).toHaveAttribute("aria-current", "page");
    await expect(tab("Abrir SOS de emergencia")).toBeInViewport({ ratio: 1 });
  };
  const openProfile = async () => {
    await tab("Perfil").click();
    await expect(
      page.getByRole("heading", { name: "Perfil", exact: true }),
    ).toBeVisible();
    await assertDock("Perfil");
  };

  await tab("Inicio").click();
  await assertDock("Inicio");
  const quick = page.getByRole("region", { name: "Accesos rápidos" });
  await quick.getByRole("button", { name: "Nutrición", exact: true }).click();
  const diet = page.getByRole("heading", { name: "Dieta de hoy", exact: true });
  await expect(diet).toBeVisible();
  await assertDock("Nutrición");
  await shot(page, `20-nav-nutricion-${width}`);
  await tab("Ejercicio").click();
  const exercise = page.getByRole("heading", {
    name: "Antes de empezar",
    exact: true,
  });
  // Tras una sesion completada, la vista del dia restaura el resumen.
  const completed = page.getByRole("heading", {
    name: "Sesión completada",
    exact: true,
  });
  await expect(exercise.or(completed)).toBeVisible();
  await assertDock("Ejercicio");
  await shot(page, `21-nav-ejercicio-${width}`);

  await openProfile();
  const avatar = page.getByRole("button", { name: "Mi Avatar", exact: true });
  const plan = page.getByRole("region", { name: "Mi plan" });
  await expect(avatar).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cuenta y preferencias" }),
  ).toBeAttached();
  await expect(plan.getByRole("heading", { level: 3 })).toHaveText([
    "Evaluaciones de bienestar",
    "Plan nutricional",
    "Plan de ejercicios",
    "Cambiar objetivo",
  ]);
  await expect(
    page.getByText(
      /^(Mi historial de bienestar|Calendario de citas|Fuentes y referencias médicas|Equipo Copp Adresd)$/,
    ),
  ).toHaveCount(0);
  await shot(page, `22-nav-perfil-${width}`);
  await plan.scrollIntoViewIfNeeded();
  await shot(page, `23-nav-plan-${width}`);

  await avatar.click();
  const avatarDialog = page.locator('ion-modal[aria-label="Mi Avatar"]');
  await expect(avatarDialog).toBeVisible();
  await expect(
    page.locator(".avatar-experience [data-avatar-configuration]"),
  ).toBeAttached();
  await shot(page, `24-nav-avatar-${width}`);
  await page
    .locator(".avatar-experience")
    .getByText("Volver", { exact: true })
    .click();
  await expect(avatarDialog).toBeHidden();

  const openNotifications = () =>
    page.getByRole("button", { name: /Preferencias de notificaciones/ }).click();
  const preferences = page.getByRole("heading", { name: "Preferencias de notificaciones", exact: true });
  const protocolReminder = page.getByRole("switch", { name: "Recordatorio del protocolo" });
  await openNotifications();
  await expect(preferences).toBeVisible();
  await expect(protocolReminder).toHaveAttribute("aria-checked", "true");
  await protocolReminder.click();
  await expect(protocolReminder).toHaveAttribute("aria-checked", "false");
  await page.locator(".wn-scroll").evaluate((element) => { element.scrollTop = 0; });
  await shot(page, `26-notificaciones-${width}`);
  await page.getByRole("button", { name: "Volver al perfil" }).click();
  await assertDock("Perfil");
  await openNotifications();
  await expect(protocolReminder).toHaveAttribute("aria-checked", "false");
  const chestTime = page.getByRole("button", { name: "Hora del aviso de Cofre listo, 00:00" });
  await chestTime.click();
  const timePicker = page.locator("ion-popover").filter({ has: page.locator("ion-datetime") });
  await expect(timePicker).toBeVisible();
  await timePicker.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(timePicker).toBeHidden();
  await chestTime.click();
  await timePicker.locator('ion-picker-column[aria-label="Select an hour"]')
    .locator("ion-picker-column-option").nth(1).click();
  await timePicker.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hora del aviso de Cofre listo, 01:00" })).toBeVisible();
  await page.getByRole("button", { name: "Probar aviso en la app" }).click();
  await expect(page.locator(".app-toast").getByText(/Aviso de prueba en la app/)).toBeVisible();
  await page.getByRole("button", { name: "Volver al perfil" }).click();
  await assertDock("Perfil");

  await plan.getByText("Plan nutricional", { exact: true }).click();
  await expect(diet).toBeVisible();
  await assertDock("Nutrición");
  await openProfile();
  await plan.getByText("Plan de ejercicios", { exact: true }).click();
  await expect(exercise.or(completed)).toBeVisible();
  await assertDock("Ejercicio");
  await openProfile();
  await plan.getByText("Cambiar objetivo", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Antes de cambiar tu objetivo" }),
  ).toBeVisible();
  await shot(page, `25-nav-objetivo-${width}`);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(plan).toBeVisible();
  await plan.getByText("Evaluaciones de bienestar", { exact: true }).click();
  await expect(
    page.getByText("Tests de evaluación", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await assertDock("Perfil");

  for (const target of [
    "/chat",
    "/hc",
    "/book",
    "/program-podcast",
    "/room",
    "/marketplace",
  ]) {
    await page.goto(new URL(target, baseUrl).href);
    await expect(
      page.getByRole("heading", { name: "Protocolo de hoy" }),
    ).toBeVisible();
    await assertDock("Inicio");
  }
}

async function runFlow(page, baseUrl, width) {
  await page.setViewportSize({ width, height: width <= 320 ? 720 : 860 });
  await enterOnboarding(page, baseUrl);

  await shot(page, `01-email-${width}`);
  await page
    .locator('ion-input[name="email"] input')
    .fill(`ana.qa.${width}@example.com`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Contactos de emergencia", { exact: true }),
  ).toBeVisible();
  await shot(page, `02-emergencia-${width}`);
  await (await continueButton(page)).click();
  await expect(
    page.getByText("El contacto principal requiere nombre y teléfono.", {
      exact: true,
    }),
  ).toBeVisible();
  const contact = page.locator(
    ".emergency-contact-card-primary ion-input input",
  );
  await contact.nth(0).fill("Ana Torres");
  await contact.nth(1).fill("3001234567");
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Términos de bienestar", { exact: true }),
  ).toBeVisible();
  await shot(page, `03-terminos-${width}`);
  await page.locator("ion-checkbox").first().click();
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Crea tu contraseña", { exact: true }),
  ).toBeVisible();
  await shot(page, `04-contrasena-${width}`);
  await page.locator('ion-input[name="new-password"] input').fill("Segura123!");
  await page
    .locator('ion-input[name="confirm-password"] input')
    .fill("Segura123!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Tu objetivo", exact: true }),
  ).toBeVisible();
  await shot(page, `05-objetivo-${width}`);
  await page.locator('button[aria-label="Bajar de peso"]').click();
  await (await continueButton(page)).click();

  await expect(page.getByText("Tus datos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Femenino", exact: true }).click();
  await page.locator('ion-input[data-wl-field="name"] input').fill("Ana");
  await fillNumeric(page, "age", 34);
  await fillNumeric(page, "heightCm", 165);
  await fillNumeric(page, "weightKg", 72);
  await fillNumeric(page, "waistCm", 82);
  await fillNumeric(page, "targetWeightKg", 65);
  await shot(page, `06-datos-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Actividad y ritmo", { exact: true }),
  ).toBeVisible();
  await page.locator(".wl-option").filter({ hasText: "Ligero" }).click();
  await shot(page, `07-actividad-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Preferencias de alimentación", { exact: true }),
  ).toBeVisible();
  await shot(page, `08-preferencias-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Seguridad del ejercicio", { exact: true }),
  ).toBeVisible();
  await answerAllNo(page, 7);
  await shot(page, `09-parq-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Seguridad de la nutrición", { exact: true }),
  ).toBeVisible();
  await answerAllNo(page, 6);
  await shot(page, `10-nqs-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Términos y aviso de bienestar", { exact: true }),
  ).toBeVisible();
  await shot(page, `11-terminos-plan-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Revisa tus elecciones", { exact: true }),
  ).toBeVisible();
  await shot(page, `12-revision-${width}`);
  await page
    .getByRole("button", { name: "Generar mi plan", exact: true })
    .click();

  const generation = page.getByRole("region", { name: "Preparación del plan" });
  await expect(
    generation.getByRole("heading", { name: "Estamos preparando tu plan" }),
  ).toBeVisible({ timeout: 3000 });
  await expect(generation.locator("ion-progress-bar")).toHaveCount(3);
  await Promise.all([
    shot(page, `13-home-generando-${width}`),
    expect(generation).toBeHidden({ timeout: 3000 }),
  ]);
  const generationMs = await page.evaluate(() => {
    const job = JSON.parse(localStorage.getItem("wellness.generation.v1"));
    return Date.now() - job.startedAt;
  });
  assert(generationMs <= 3000, `generation took ${generationMs} ms`);
  await expect(
    page.getByRole("heading", { name: /tu plan de bienestar está listo/i }),
  ).toHaveCount(0);

  const inbox = page.getByRole("region", { name: "Bandeja" });
  for (const title of [
    "Te damos la bienvenida",
    "Tu plan de ejercicio está listo",
    "Tu plan de nutrición está listo",
    "Tus cuestionarios",
  ]) {
    await expect(
      inbox.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await expect(inbox.locator("time")).toHaveCount(4);
  await expect(page.locator(".wh-day")).toContainText("Día 1 de 365");
  await expect(
    page.getByText("Protocolo de hoy", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0/5", { exact: true })).toBeVisible();
  await expect(page.getByText("0 de 7", { exact: true })).toBeVisible();
  await expect(page.getByText(/^(IMC|HbA1c|% de grasa)$/)).toHaveCount(0);
  const afterEnter = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 400),
    nodes: document.body.querySelectorAll("*").length,
  }));
  await shot(page, `14-inicio-${width}`);
  await inbox.scrollIntoViewIfNeeded();
  await shot(page, `14-bandeja-${width}`);
  await page.locator(".wh-batteries").scrollIntoViewIfNeeded();
  await shot(page, `15-cuestionarios-${width}`);

  await page
    .getByRole("region", { name: "Accesos rápidos" })
    .getByRole("button", { name: "Ejercicio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Antes de empezar", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wx-list > li")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Empezar sesión", exact: true })
    .click();
  await expect(page.getByRole("timer")).toBeVisible();
  for (let exercise = 1; exercise <= 4; exercise += 1) {
    await expect(
      page.getByText(`Ejercicio ${exercise} de 4`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: exercise === 4 ? "Terminar sesión" : "Siguiente",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Sesión completada", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al protocolo", exact: true })
    .click();
  await expect(
    page.getByText("Tu día de bienestar", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 de 5 pasos", { exact: true })).toBeVisible();
  await shot(page, `16-protocolo-${width}`);
  for (let step = 0; step < 3; step += 1) {
    await page
      .getByRole("button", { name: "Marcar como hecho", exact: true })
      .first()
      .click();
  }
  await expect(page.getByText("4 de 5 pasos", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir mi cofre", exact: true })
    .click();
  await expect(
    page.getByText("¡Cofre abierto!", { exact: true }),
  ).toBeVisible();
  await shot(page, `17-cofre-${width}`);
  await page.getByRole("button", { name: "Seguir", exact: true }).click();
  await expect(page.getByText("5 de 5 pasos", { exact: true })).toBeVisible();
  await shot(page, `18-protocolo-completo-${width}`);
  await page
    .getByRole("button", { name: "Cerrar el día", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cerrar el día", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".app-toast").getByText(/\+10 puntos/),
  ).toBeHidden();
  await shot(page, `20-cierre-formulario-${width}`);
  await page
    .getByRole("button", { name: "Cerrar el día", exact: true })
    .click();
  await expect(page.locator(".wc-error")).toBeFocused();
  await expect(
    page.locator('ion-input[name="adherence"] input'),
  ).toHaveAttribute("aria-invalid", "true");
  for (const [name, value] of [
    ["adherence", "75"],
    ["sleepHours", "5"],
    ["energy", "3"],
    ["pain", "0"],
  ]) {
    await page.locator(`ion-input[name="${name}"] input`).fill(value);
  }
  await page.getByRole("checkbox", { name: "Hambre", exact: true }).click();
  await page.getByRole("checkbox", { name: "Insomnio", exact: true }).click();
  await page.getByRole("radio", { name: "Sí", exact: true }).click();
  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Cerrar el día", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu plan para mañana" }),
  ).toBeVisible();
  await expect(page.getByText(/guardado en este dispositivo/i)).toBeVisible();
  await expect(page.getByText(/ejercicio será más suave/i)).toBeVisible();
  await expect(page.getByText(/hambre que registraste/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Día cerrado", exact: true }),
  ).toBeFocused();
  await shot(page, `21-cierre-pendiente-${width}`);
  await page.context().setOffline(false);
  await expect(
    page.getByText("Cierre sincronizado.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Conexión restablecida", { exact: true }),
  ).toBeHidden();
  await shot(page, `22-cierre-sincronizado-${width}`);
  await page
    .getByRole("button", { name: "Volver al inicio", exact: true })
    .click();
  await expect(page.getByText("5/5", { exact: true })).toBeVisible();
  await shot(page, `19-home-completo-${width}`);
  await page
    .getByRole("button", { name: "Ver cierre del día", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Día cerrado", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cerrar el día", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Volver al inicio", exact: true })
    .click();
  const tomorrow = await page.evaluate(() => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    return now.getTime();
  });
  await page.clock.setFixedTime(tomorrow);
  await page.getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Ejercicio", exact: true }).click();
  await expect(page.getByText(/ejercicio será más suave/i)).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al protocolo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver al inicio", exact: true })
    .click();
  await page
    .getByLabel("Accesos rápidos")
    .getByRole("button", { name: "Nutrición", exact: true })
    .click();
  await expect(page.getByText(/cena más temprana y ligera/i)).toBeVisible();

  await verifyNavigation(page, baseUrl, width);
  return { ...afterEnter, generationMs };
}

const baseUrl = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5173";

try {
  for (const width of process.env.COP_E2E_WIDTH
    ? [Number(process.env.COP_E2E_WIDTH)]
    : [390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 860 },
    });
    await mockApi(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const runtimeErrors = [];
    page.on("pageerror", (error) =>
      runtimeErrors.push(
        `pageerror: ${error.message} @ ${String(error.stack).slice(0, 700)}`,
      ),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        runtimeErrors.push(`console: ${message.text()}`);
    });
    try {
      const afterEnter = await runFlow(page, baseUrl, width);
      results.push({
        width,
        result: "passed",
        afterEnter,
        runtimeErrors: runtimeErrors.slice(0, 8),
      });
    } catch (error) {
      results.push({
        width,
        result: "failed",
        error: String(error).slice(0, 900),
      });
      await page
        .screenshot({
          path: path.join(out, `failure-${width}.png`),
          fullPage: true,
        })
        .catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(out, process.env.COP_E2E_RESULTS ?? "kan146-results.json"),
  JSON.stringify(results, null, 2),
  "utf8",
);
console.log(JSON.stringify(results));
if (results.some((r) => r.result === "failed")) process.exitCode = 1;
